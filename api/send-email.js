import nodemailer from 'nodemailer';

/**
 * Serverless Email Dispatcher & SMTP Gateway for Pusat Jual Beli Solo Raya
 * Supports Gmail SMTP (smtp.gmail.com), Brevo, SendGrid, Mailgun, and Custom Mail Servers
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
      service: 'Pusat Jual Beli Solo Raya - SMTP Mail Engine',
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

    // 1. Resolve SMTP Configuration from Environment Variables & Admin Payload
    const host = (
      process.env.SMTP_HOST || 
      process.env.MAIL_HOST || 
      smtpConfig?.host || 
      'smtp.gmail.com'
    ).trim();

    const port = Number(
      process.env.SMTP_PORT || 
      process.env.MAIL_PORT || 
      smtpConfig?.port || 
      (host === 'smtp.gmail.com' ? 465 : 587)
    );

    const secure = process.env.SMTP_SECURE !== undefined 
      ? (process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1')
      : (smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : (port === 465));

    const user = (
      process.env.SMTP_USER || 
      process.env.GMAIL_USER || 
      process.env.EMAIL_USER || 
      process.env.MAIL_USER || 
      smtpConfig?.user || 
      'solosatset.soloraya@gmail.com'
    ).trim();

    const pass = (
      process.env.SMTP_PASS || 
      process.env.SMTP_PASSWORD || 
      process.env.GMAIL_APP_PASSWORD || 
      process.env.GMAIL_PASS || 
      process.env.GMAIL_PASSWORD || 
      process.env.EMAIL_PASS || 
      process.env.EMAIL_PASSWORD || 
      process.env.APP_PASSWORD || 
      smtpConfig?.pass || 
      ''
    ).replace(/\s+/g, '');

    const fromName = (
      process.env.SMTP_FROM_NAME || 
      process.env.MAIL_FROM_NAME || 
      smtpConfig?.fromName || 
      'Pusat Jual Beli Solo Raya'
    ).trim();

    const fromEmail = (
      process.env.SMTP_FROM || 
      process.env.MAIL_FROM || 
      process.env.SMTP_USER || 
      smtpConfig?.from || 
      user || 
      'no-reply@solosatset.com'
    ).trim();

    // 2. Handle Test Connection Request from Admin Studio
    if (action === 'test_connection') {
      if (!pass) {
        console.warn('[SMTP Verification Warning] Password/App Password belum dikonfigurasi di Environment Variables maupun Admin Panel.');
        return res.status(200).json({
          success: false,
          status: 'unconfigured',
          message: 'Password / App Password SMTP belum diatur. Masukkan password aplikasi Gmail Anda pada Environment Variables Vercel (SMTP_PASS) atau melalui Admin Panel.'
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
      console.error('[SMTP Config Error] App Password / SMTP_PASS kosong. Harap pasang SMTP_PASS di Vercel Environment Variables.');
      return res.status(500).json({
        success: false,
        error: 'Konfigurasi SMTP belum lengkap: App Password Gmail (SMTP_PASS) belum diatur pada Environment Variables backend.'
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

