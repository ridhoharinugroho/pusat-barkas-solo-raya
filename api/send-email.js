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
    const { action, to, subject, html, text, type, metadata, smtpConfig } = req.body || {};

    // 1. Resolve SMTP Configuration
    const host = (smtpConfig?.host || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    const port = Number(smtpConfig?.port || process.env.SMTP_PORT || (host === 'smtp.gmail.com' ? 465 : 587));
    const secure = smtpConfig?.secure !== undefined 
      ? Boolean(smtpConfig.secure) 
      : (port === 465);
    const user = (smtpConfig?.user || process.env.SMTP_USER || process.env.GMAIL_USER || 'solosatset.soloraya@gmail.com').trim();
    const pass = (smtpConfig?.pass || process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
    const fromName = (smtpConfig?.fromName || process.env.SMTP_FROM_NAME || 'Pusat Jual Beli Solo Raya').trim();
    const fromEmail = (smtpConfig?.from || process.env.SMTP_FROM || user || 'no-reply@solosatset.com').trim();

    // 2. Handle Test Connection Request from Admin Studio
    if (action === 'test_connection') {
      if (!pass) {
        return res.status(200).json({
          success: false,
          status: 'unconfigured',
          message: 'Password / App Password SMTP belum diatur. Masukkan password aplikasi Gmail Anda untuk menghubungkan mail server.'
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

    // 4. Send Email if SMTP credentials exist, or gracefully handle simulation
    if (!pass) {
      console.log(`[SIMULATED EMAIL DISPATCH] To: ${to} | Subject: ${subject}`);
      return res.status(200).json({
        success: true,
        simulated: true,
        message: `Email disiapkan untuk ${to} (Mode Simulasi Aktif - Konfigurasikan App Password Gmail di Admin Panel untuk pengiriman live)`,
        data: { to, subject, type }
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
    console.log(`[EMAIL SUCCESS] Sent to ${to}, MessageID: ${info.messageId}`);

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Email berhasil dikirim ke ${to}`
    });
  } catch (error) {
    console.error('[EMAIL ERROR]', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gagal mengirim email melalui SMTP server. Periksa konfigurasi App Password Gmail.'
    });
  }
}

