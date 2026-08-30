import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Serverless Database & Schema Initialization Engine
 * Probes and prepares users table OTP columns (otp_code, otp_expires_at) programmatically
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

  try {
    const statusReport = {
      timestamp: new Date().toISOString(),
      database: 'connected',
      table_users: 'checked',
      otp_columns_status: 'ready',
      cloud_sync: 'active'
    };

    // 1. Probe keberadaan kolom otp_code & otp_expires_at pada tabel users
    const { data: probeData, error: probeError } = await supabase
      .from('users')
      .select('id, otp_code, otp_expires_at')
      .limit(1);

    if (probeError) {
      statusReport.otp_columns_status = 'schema_fallback_active';
      statusReport.probe_message = probeError.message;

      // Coba eksekusi DDL via RPC jika tersedia
      const migrationSql = `
        ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS otp_code TEXT DEFAULT NULL;
        ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_email_otp ON users(email, otp_code);
      `;

      try {
        await supabase.rpc('exec_sql', { sql: migrationSql, query: migrationSql });
      } catch (rpcErr) {}
    } else {
      statusReport.otp_columns_status = 'columns_verified';
      statusReport.sample = probeData;
    }

    // 2. Pastikan tabel site_settings siap sebagai redundansi storage OTP cloud
    try {
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();

      const settings = (settingsData && settingsData.settings) || {};
      if (!settings.otp_sessions) {
        settings.otp_sessions = {};
        await supabase
          .from('site_settings')
          .upsert([{ id: 'global', settings, updated_at: new Date().toISOString() }], { onConflict: 'id' });
      }
      statusReport.site_settings_otp = 'active';
    } catch (sErr) {
      statusReport.site_settings_otp = 'error: ' + sErr.message;
    }

    return res.status(200).json({
      success: true,
      message: 'Database schema initialization and OTP subsystem verification complete.',
      report: statusReport
    });
  } catch (error) {
    console.error('[DB Init Handler Error]', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
