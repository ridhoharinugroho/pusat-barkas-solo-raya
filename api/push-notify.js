import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOMPQQn3bQc9vJt68WlanKbCfTpN-N2HLoTkB34G0348Cqoh1P1SD5wt4aK40fBG090yDkkAoCVBICK0IigZ07Y';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'EQt1IRRijBEx-zYI7DhuLyjg4EdwhF0XwPObVPC2GFg';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:solosatset.soloraya@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

    const {
      title = '📢 Pusat Jual Beli Solo Raya',
      body: message = 'Ada pembaruan sistem dan barang seken terbaru di Solo Raya! Buka aplikasi sekarang.',
      url = 'https://solosatset.vercel.app/',
      icon = '/assets/img/app-logo.png?v=2.1',
      badge = '/assets/img/app-logo.png?v=2.1',
      tag = 'solosatset-update',
      targetUserId = null,
      targetEmail = null
    } = body || {};

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      icon,
      badge,
      tag,
      timestamp: Date.now()
    });

    // 1. Gather all active subscriptions from Supabase table and site_settings
    const subscriptionsMap = new Map();

    // A. From push_subscriptions table
    try {
      let query = supabase.from('push_subscriptions').select('*');
      if (targetUserId) query = query.eq('user_id', targetUserId);
      if (targetEmail) query = query.eq('user_email', targetEmail.toLowerCase().trim());

      const { data: dbSubs } = await query;
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
    } catch (e) { }

    // B. From site_settings cloud storage fallback
    try {
      const { data: settingsData } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
      const rawMap = settingsData?.settings?.push_subscriptions || {};
      Object.values(rawMap).forEach(s => {
        if (s && s.endpoint && s.p256dh && s.auth) {
          if (targetUserId && s.user_id !== targetUserId) return;
          if (targetEmail && (!s.user_email || s.user_email.toLowerCase() !== targetEmail.toLowerCase().trim())) return;
          if (!subscriptionsMap.has(s.endpoint)) {
            subscriptionsMap.set(s.endpoint, {
              endpoint: s.endpoint,
              keys: { p256dh: s.p256dh, auth: s.auth }
            });
          }
        }
      });
    } catch (e) { }

    const allSubs = Array.from(subscriptionsMap.values());
    console.log(`[Push Dispatcher] Mengirim notifikasi ke ${allSubs.length} perangkat terdaftar...`);

    if (allSubs.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: 'Belum ada perangkat pengguna yang mendaftarkan izin Web Push Notification.'
      });
    }

    // 2. Dispatch notifications concurrently
    const expiredEndpoints = [];
    let sentCount = 0;
    let failedCount = 0;

    const sendPromises = allSubs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        sentCount++;
      } catch (err) {
        failedCount++;
        // If subscription is 404 or 410 Gone, mark for cleanup
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
        console.warn(`[Push Error] Endpoint failed (${err.statusCode}):`, err.message);
      }
    });

    await Promise.allSettled(sendPromises);

    // 3. Clean up expired endpoints if any
    if (expiredEndpoints.length > 0) {
      try {
        for (const ep of expiredEndpoints) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', ep).catch(() => { });
        }
        const { data: setObj } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
        const curSettings = (setObj && setObj.settings) || {};
        if (curSettings.push_subscriptions) {
          expiredEndpoints.forEach(ep => delete curSettings.push_subscriptions[ep]);
          await supabase.from('site_settings').upsert([{ id: 'global', settings: curSettings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
        }
      } catch (e) { }
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
    return res.status(500).json({ success: false, error: error.message });
  }
}
