import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper untuk mengambil data konfigurasi SMTP dinamis langsung dari database Supabase
 */
async function getDynamicSmtpConfig(fallbackPayloadConfig = {}) {
  let config = { ...fallbackPayloadConfig };

  try {
    // Ambil dari tabel 'app_smtp_config' (id: 'config')
    const { data: dbRow, error: dbErr } = await supabase
      .from('app_smtp_config')
      .select('settings_json')
      .eq('id', 'config')
      .maybeSingle();

    if (!dbErr && dbRow && dbRow.settings_json) {
      const parsed = typeof dbRow.settings_json === 'string' ? JSON.parse(dbRow.settings_json) : dbRow.settings_json;
      if (parsed && typeof parsed === 'object') {
        config = { ...config, ...parsed };
      }
    }
  } catch (err) {
    console.warn('[SMTP Backend Supabase Fetch Warning]', err);
  }

  // Sanitasi data
  const host = (config.host || 'smtp.gmail.com').trim();
  const port = Number(config.port) || (host === 'smtp.gmail.com' ? 465 : 587);
  const secure = config.secure !== undefined ? Boolean(config.secure) : (port === 465);
  const user = (config.user || 'solosatset.soloraya@gmail.com').trim();
  const pass = (config.pass || '').replace(/\s+/g, '');
  const fromName = (config.senderName || config.fromName || 'Pusat Jual Beli Solo Raya').trim();
  const fromEmail = (config.senderEmail || config.from || user || 'no-reply@solosatset.com').trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail
  };
}

/**
 * Serverless Email Dispatcher & SMTP Gateway for Pusat Jual Beli Solo Raya
 * Fully Dynamic from Supabase Database 'app_smtp_config' Table
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
      service: 'Pusat Jual Beli Solo Raya - SMTP Mail Engine (Supabase-driven)',
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
    const { action, to, subject, html, text, type, metadata, smtpConfig } = body || {};

    // Ambil konfigurasi SMTP murni secara dinamis dari tabel app_smtp_config di Supabase
    const { host, port, secure, user, pass, fromName, fromEmail } = await getDynamicSmtpConfig(smtpConfig);

    // 2. Handle Test Connection Request from Admin Studio
    if (action === 'test_connection') {
      if (!pass) {
        console.warn('[SMTP Verification Warning] Password/App Password belum dikonfigurasi di tabel app_smtp_config Supabase.');
        return res.status(200).json({
          success: false,
          status: 'unconfigured',
          message: 'Password / App Password SMTP belum diatur di database Supabase (app_smtp_config). Silakan simpan sandi aplikasi melalui panel Admin.'
        });
      }

      const testTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000
      });

      await testTransporter.verify();
      console.log(`[SMTP Verify Success] Terhubung ke ${host}:${port} dengan user: ${user}`);
      return res.status(200).json({
        success: true,
        status: 'connected',
        message: `Koneksi SMTP ke ${host}:${port} (${user}) berhasil terverifikasi!`
      });
    }

    // 3. Validation for Sending Email
    if (!to || (!html && !text)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Penerima email (to) dan isi pesan (html/text) wajib diisi.' 
      });
    }

    // 4. Validate Credentials Before Dispatch
    if (!pass) {
      console.error('[SMTP Config Error] App Password kosong di tabel app_smtp_config.');
      return res.status(500).json({
        success: false,
        error: 'Konfigurasi SMTP belum lengkap: App Password Gmail belum diatur pada database Supabase (app_smtp_config).'
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000
    });

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to.trim(),
      subject: subject || 'Pemberitahuan Akun - Pusat Jual Beli Solo Raya',
      text: text || '',
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP EMAIL SUCCESS] Sent to: ${to} | MessageID: ${info.messageId}`);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Email berhasil dikirim ke ${to}`
    });
  } catch (error) {
    console.error('[SMTP Server Error Details]', {
      name: error.name,
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      command: error.command
    });

    const isAuthError = error.code === 'EAUTH' || 
                        error.responseCode === 535 || 
                        (error.message && (error.message.includes('535') || error.message.includes('Username and Password not accepted') || error.message.includes('BadCredentials')));

    let userFriendlyError = error.message || 'Gagal mengirim email melalui server SMTP.';
    if (isAuthError) {
      userFriendlyError = 'Autentikasi SMTP Gagal (Error 535-5.7.8): Kredensial App Password Gmail salah atau sudah kedaluwarsa. Silakan perbarui App Password 16-digit Google pada Environment Variables (SMTP_PASS) tanpa spasi.';
    }

    return res.status(500).json({
      success: false,
      code: error.code || (isAuthError ? 'EAUTH' : 'SMTP_ERROR'),
      responseCode: error.responseCode || (isAuthError ? 535 : 500),
      error: userFriendlyError
    });
  }
}

