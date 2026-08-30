import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Server-side in-memory active OTP store (fast cache)
const activeOtpMemoryStore = new Map();

/**
 * Serverless OTP Lifecycle & Multi-Device Synchronization Engine
 */
export default async function handler(req, res) {
  // CORS Configuration for Multi-Device & Mobile Access
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Pusat Jual Beli Solo Raya - OTP & Password Reset Engine',
      status: 'active',
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

    const { action, email, otpCode, newPassword } = body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (otpCode || '').toString().trim().replace(/\D/g, '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Alamat email tidak valid.' });
    }

    // ACTION 1: CREATE & STORE OTP TOKEN
    if (action === 'create' || action === 'store') {
      if (!cleanCode || cleanCode.length < 4) {
        return res.status(400).json({ success: false, error: 'Kode OTP tidak valid.' });
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const otpRecord = {
        code: cleanCode,
        expires_at: expiresAt,
        created_at: Date.now()
      };

      // Simpan di memory cache serverless
      activeOtpMemoryStore.set(cleanEmail, otpRecord);

      // Simpan di Supabase site_settings cloud storage
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle();

        const settings = (data && data.settings) || {};
        if (!settings.otp_sessions) settings.otp_sessions = {};
        settings.otp_sessions[cleanEmail] = otpRecord;

        await supabase
          .from('site_settings')
          .upsert([{ id: 'global', settings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
      } catch (e) {
        console.warn('[OTP Serverless] Supabase site_settings sync error:', e);
      }

      // Coba simpan ke kolom users jika kolom sudah terpasang
      try {
        const { data: userProbe } = await supabase.from('users').select('*').limit(1);
        if (userProbe && userProbe.length > 0 && ('otp_code' in userProbe[0] || 'otp_expires_at' in userProbe[0])) {
          await supabase
            .from('users')
            .update({
              otp_code: cleanCode,
              otp_expires_at: expiresAt,
              updated_at: new Date().toISOString()
            })
            .eq('email', cleanEmail);
        }
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: 'Kode OTP berhasil dicatat di serverless memory & database Supabase.',
        expiresAt
      });
    }

    // ACTION 2: VERIFY OTP TOKEN & UPDATE PASSWORD
    if (action === 'verify' || action === 'reset_password') {
      if (!cleanCode || cleanCode.length < 4) {
        return res.status(400).json({ success: false, error: 'Masukkan kode OTP 6 digit.' });
      }

      let isValid = false;

      // 1. Cek dari memory cache
      const memRecord = activeOtpMemoryStore.get(cleanEmail);
      if (memRecord && memRecord.code === cleanCode) {
        const exp = memRecord.expires_at ? new Date(memRecord.expires_at).getTime() : 0;
        if (exp === 0 || Date.now() <= exp) {
          isValid = true;
        } else {
          activeOtpMemoryStore.delete(cleanEmail);
          return res.status(400).json({ success: false, error: 'Kode OTP telah kadaluarsa (lebih dari 15 menit).' });
        }
      }

      // 2. Cek dari Supabase site_settings cloud storage
      if (!isValid) {
        try {
          const { data } = await supabase
            .from('site_settings')
            .select('settings')
            .eq('id', 'global')
            .maybeSingle();

          const cloudSession = data?.settings?.otp_sessions?.[cleanEmail];
          if (cloudSession && cloudSession.code === cleanCode) {
            const exp = cloudSession.expires_at ? new Date(cloudSession.expires_at).getTime() : 0;
            if (exp === 0 || Date.now() <= exp) {
              isValid = true;
            } else {
              return res.status(400).json({ success: false, error: 'Kode OTP telah kadaluarsa (lebih dari 15 menit).' });
            }
          }
        } catch (e) {}
      }

      // 3. Cek dari kolom users Supabase jika kolom tersedia
      if (!isValid) {
        try {
          const { data: userProbe } = await supabase.from('users').select('*').eq('email', cleanEmail).maybeSingle();
          if (userProbe && userProbe.otp_code && userProbe.otp_code.toString().trim().replace(/\D/g, '') === cleanCode) {
            const exp = userProbe.otp_expires_at ? new Date(userProbe.otp_expires_at).getTime() : 0;
            if (exp === 0 || Date.now() <= exp) {
              isValid = true;
            } else {
              return res.status(400).json({ success: false, error: 'Kode OTP telah kadaluarsa (lebih dari 15 menit).' });
            }
          }
        } catch (e) {}
      }

      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Kode verifikasi yang Anda masukkan salah atau kadaluarsa.'
        });
      }

      // Jika ada permintaan update password sekaligus
      const cleanNewPass = (newPassword || '').trim();
      if (cleanNewPass && cleanNewPass.length >= 5) {
        try {
          const { error: sbUpdateErr } = await supabase
            .from('users')
            .update({
              password: cleanNewPass,
              updated_at: new Date().toISOString()
            })
            .eq('email', cleanEmail);

          if (sbUpdateErr) {
            console.error('[OTP API Password Update Error]', sbUpdateErr);
          } else {
            console.log(`[OTP API Password Update Success] Password updated in Supabase users table for ${cleanEmail}`);
          }
        } catch (e) {
          console.warn('[OTP API Password Update Exception]', e);
        }
      }

      // Bersihkan memory dan cloud store
      activeOtpMemoryStore.delete(cleanEmail);
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('settings')
          .eq('id', 'global')
          .maybeSingle();

        const settings = (data && data.settings) || {};
        if (settings.otp_sessions && settings.otp_sessions[cleanEmail]) {
          delete settings.otp_sessions[cleanEmail];
          await supabase
            .from('site_settings')
            .upsert([{ id: 'global', settings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
        }
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: 'Kode OTP berhasil diverifikasi dan password berhasil diperbarui.'
      });
    }

    // ACTION 3: CLEAR
    if (action === 'clear') {
      activeOtpMemoryStore.delete(cleanEmail);
      return res.status(200).json({ success: true, message: 'OTP session cleared' });
    }

    return res.status(400).json({ success: false, error: 'Action not supported' });
  } catch (error) {
    console.error('[OTP API Error]', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
