import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BOMPQQn3bQc9vJt68WlanKbCfTpN-N2HLoTkB34G0348Cqoh1P1SD5wt4aK40fBG090yDkkAoCVBICK0IigZ07Y';

/**
 * Serverless Push Subscription Handler
 * Saves & manages W3C Web Push subscriptions in Supabase
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
      service: 'Pusat Jual Beli Solo Raya - Web Push Subscription Engine',
      vapidPublicKey: VAPID_PUBLIC_KEY,
      status: 'active'
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

    const { action = 'subscribe', subscription, userId, userEmail } = body || {};

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Subscription data with endpoint is required.' });
    }

    const endpoint = subscription.endpoint;
    const p256dh = subscription.keys?.p256dh || '';
    const auth = subscription.keys?.auth || '';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (action === 'unsubscribe') {
      // 1. Remove from push_subscriptions table
      try {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      } catch (e) {}

      // 2. Remove from site_settings fallback
      try {
        const { data } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
        const settings = (data && data.settings) || {};
        if (settings.push_subscriptions && settings.push_subscriptions[endpoint]) {
          delete settings.push_subscriptions[endpoint];
          await supabase.from('site_settings').upsert([{ id: 'global', settings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
        }
      } catch (e) {}

      return res.status(200).json({ success: true, message: 'Unsubscribed successfully.' });
    }

    // ACTION: SUBSCRIBE
    if (!p256dh || !auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription keys (p256dh and auth are required).' });
    }

    const subRecord = {
      endpoint,
      p256dh,
      auth,
      user_id: userId || null,
      user_email: userEmail || null,
      user_agent: userAgent,
      updated_at: new Date().toISOString()
    };

    // 1. Try to save into push_subscriptions table
    let savedToTable = false;
    try {
      const { error: upsertErr } = await supabase
        .from('push_subscriptions')
        .upsert([subRecord], { onConflict: 'endpoint' });

      if (!upsertErr) savedToTable = true;
    } catch (e) {}

    // 2. Save into site_settings cloud storage fallback
    try {
      const { data } = await supabase.from('site_settings').select('settings').eq('id', 'global').maybeSingle();
      const settings = (data && data.settings) || {};
      if (!settings.push_subscriptions) settings.push_subscriptions = {};
      settings.push_subscriptions[endpoint] = {
        ...subRecord,
        created_at: settings.push_subscriptions[endpoint]?.created_at || new Date().toISOString()
      };

      await supabase
        .from('site_settings')
        .upsert([{ id: 'global', settings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
    } catch (e) {
      console.warn('[Push Subscribe] site_settings sync notice:', e);
    }

    return res.status(200).json({
      success: true,
      message: 'Perangkat Anda berhasil terdaftar untuk menerima Notifikasi Web Push SoloSatSet.',
      savedToTable
    });
  } catch (error) {
    console.error('[Push Subscribe Handler Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
