import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

let supabase = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (sbInitErr) {
  console.warn('[Push Dispatcher] Supabase client init warning:', sbInitErr.message);
}

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOMPQQn3bQc9vJt68WlanKbCfTpN-N2HLoTkB34G0348Cqoh1P1SD5wt4aK40fBG090yDkkAoCVBICK0IigZ07Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'EQt1IRRijBEx-zYI7DhuLyjg4EdwhF0XwPObVPC2GFg';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:solosatset.soloraya@gmail.com';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.warn('[Push Dispatcher] VAPID configuration notice:', vapidErr.message);
}

/**
 * Serverless Push Notification Broadcast & Dispatch Engine
 */
export default async function handler(req, res) {
  // CORS Configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Pusat Jual Beli Solo Raya - Web Push Notification Dispatcher',
      status: 'active',
      vapidPublicKey: VAPID_PUBLIC_KEY,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    // Tangani jika body dikirimkan dalam bentuk array objek notifikasi
    let itemPayload = body;
    if (Array.isArray(body)) {
      itemPayload = body.length > 0 ? body[0] : {};
    }

    if (!itemPayload || typeof itemPayload !== 'object') {
      itemPayload = {};
    }

    const title = itemPayload.title || '📢 Pusat Jual Beli Solo Raya';
    const message = itemPayload.body || itemPayload.message || 'Ada pembaruan sistem dan barang seken terbaru di Solo Raya! Buka aplikasi sekarang.';
    const url = itemPayload.url || 'https://solosatset.vercel.app/';
    const icon = itemPayload.icon || itemPayload.image || '/assets/img/app-logo.png?v=2.1';
    const badge = itemPayload.badge || '/assets/img/app-logo.png?v=2.1';
    const tag = itemPayload.tag || 'solosatset-update';

    // Ekstrak dan sanitasi targetUserIds
    let cleanTargetUserIds = [];
    let isTargetSpecified = false;

    if (itemPayload.targetUserIds !== undefined && itemPayload.targetUserIds !== null) {
      isTargetSpecified = true;
      if (Array.isArray(itemPayload.targetUserIds)) {
        cleanTargetUserIds = itemPayload.targetUserIds
          .map(u => (typeof u === 'object' && u !== null ? (u.user_id || u.id || u.userId) : u))
          .filter(Boolean)
          .map(u => String(u).trim());
      } else if (typeof itemPayload.targetUserIds === 'string' && itemPayload.targetUserIds.trim()) {
        cleanTargetUserIds = [itemPayload.targetUserIds.trim()];
      }
    }

    const cleanTargetUserId = itemPayload.targetUserId ? String(itemPayload.targetUserId).trim() : null;
    if (cleanTargetUserId) {
      isTargetSpecified = true;
      if (!cleanTargetUserIds.includes(cleanTargetUserId)) {
        cleanTargetUserIds.push(cleanTargetUserId);
      }
    }

    const targetEmail = itemPayload.targetEmail ? String(itemPayload.targetEmail).toLowerCase().trim() : null;

    // Jika target pengguna ditentukan secara eksplisit namun kosong (misal tidak ada user berminat), lewati pengiriman dengan sukses
    if (isTargetSpecified && cleanTargetUserIds.length === 0 && !targetEmail) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        totalTargets: 0,
        message: 'Tidak ada daftar target pengguna yang sesuai untuk broadcast push.'
      });
    }

    const pushPayload = JSON.stringify({
      title,
      body: message,
      url,
      icon,
      badge,
      tag,
      timestamp: Date.now()
    });

    // 1. Kumpulkan seluruh langganan push yang aktif
    const subscriptionsMap = new Map();

    if (supabase) {
      // A. Dari tabel push_subscriptions Supabase
      try {
        let query = supabase.from('push_subscriptions').select('*');
        if (cleanTargetUserIds.length > 0) {
          query = query.in('user_id', cleanTargetUserIds);
        }
        if (targetEmail) {
          query = query.eq('user_email', targetEmail);
        }

        const { data: dbSubs, error: dbErr } = await query;
        if (dbErr) {
          console.warn('[Push Dispatcher] query push_subscriptions notice:', dbErr.message);
        }

        if (Array.isArray(dbSubs)) {
          dbSubs.forEach(s => {
            if (s && s.endpoint && s.p256dh && s.auth) {
              subscriptionsMap.set(s.endpoint, {
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth }
              });
            }
          });
        }
      } catch (e) {
        console.warn('[Push Dispatcher] DB subscriptions query exception:', e.message);
      }

      // B. Dari fallback site_settings
      try {
        const { data: settingsData } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
        const rawMap = settingsData?.settings?.push_subscriptions || {};
        Object.values(rawMap).forEach(s => {
          if (s && s.endpoint && s.p256dh && s.auth) {
            if (cleanTargetUserIds.length > 0 && !cleanTargetUserIds.includes(String(s.user_id))) return;
            if (targetEmail && (!s.user_email || String(s.user_email).toLowerCase().trim() !== targetEmail)) return;
            if (!subscriptionsMap.has(s.endpoint)) {
              subscriptionsMap.set(s.endpoint, {
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth }
              });
            }
          }
        });
      } catch (e) {
        console.warn('[Push Dispatcher] site_settings subscriptions query exception:', e.message);
      }
    }

    const allSubs = Array.from(subscriptionsMap.values());
    console.log(`[Push Dispatcher] Mengirim notifikasi ke ${allSubs.length} perangkat terdaftar...`);

    if (allSubs.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        totalTargets: 0,
        message: 'Belum ada perangkat pengguna yang mendaftarkan izin Web Push Notification.'
      });
    }

    // 2. Kirim notifikasi secara concurrent
    const expiredEndpoints = [];
    let sentCount = 0;
    let failedCount = 0;

    const sendPromises = allSubs.map(async (sub) => {
      try {
        if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
        await webpush.sendNotification(sub, pushPayload);
        sentCount++;
      } catch (err) {
        failedCount++;
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.warn(`[Push Error] Endpoint failed (${err.statusCode || 'network'}):`, err.message);
      }
    });

    await Promise.allSettled(sendPromises);

    // 3. Bersihkan endpoint yang sudah expired (404/410)
    if (expiredEndpoints.length > 0 && supabase) {
      try {
        for (const ep of expiredEndpoints) {
          try {
            await supabase.from('push_subscriptions').delete().eq('endpoint', ep);
          } catch (e) {}
        }
        const { data: setObj } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
        const curSettings = (setObj && setObj.settings) || {};
        if (curSettings.push_subscriptions) {
          expiredEndpoints.forEach(ep => delete curSettings.push_subscriptions[ep]);
          await supabase.from('site_settings').upsert([{ id: 'global', settings: curSettings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      totalTargets: allSubs.length,
      sentCount,
      failedCount,
      purgedExpired: expiredEndpoints.length,
      message: `Notifikasi push berhasil dikirim ke ${sentCount} dari ${allSubs.length} perangkat aktif.`
    });
  } catch (error) {
    console.error('[Push Dispatch Handler Error]', error);
    // Kembalikan response JSON yang rapi dan aman
    return res.status(200).json({
      success: false,
      error: error.message || 'Internal error occurred during push notification dispatch',
      sentCount: 0
    });
  }
}

// Auto-run when executed directly via "node api/push-notify.js"
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('api/push-notify')) {
  console.log('--- MENJALANKAN DISPATCHER NOTIFIKASI DARI TERMINAL ---');
  const customTitle = process.argv[2] || "📢 Pembaruan Sistem SoloSatset";
  const customBody = process.argv[3] || "Halo! Kami telah melakukan peningkatan sistem demi keamanan dan kenyamanan transaksi Anda. Buka aplikasi sekarang untuk merasakannya!";
  const customUrl = process.argv[4] || "https://solosatset.vercel.app/";

  const mockReq = {
    method: 'POST',
    body: {
      title: customTitle,
      body: customBody,
      url: customUrl,
      tag: 'solosatset-system-update'
    },
    headers: {}
  };
  const mockRes = {
    setHeader: () => {},
    status: (code) => ({
      json: (data) => console.log(`HTTP ${code}:`, JSON.stringify(data, null, 2)),
      end: () => console.log(`HTTP ${code} END`)
    })
  };
  await handler(mockReq, mockRes);
}

