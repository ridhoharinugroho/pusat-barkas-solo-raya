/**
 * Database Initialization & Schema Probing Engine - Pusat Jual Beli Solo Raya
 * Memastikan tabel Supabase dan kolom pendukung siap digunakan secara otomatis
 */

import { supabase } from '../lib/supabase.js';

let isDbInitialized = false;

export async function checkAndInitDatabaseSchema() {
  if (isDbInitialized) return;
  isDbInitialized = true;

  try {
    // 1. Panggil serverless database initialization endpoint
    fetch('/api/init-db', { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          console.log('[DB Init] Backend Database Initialization Report:', data.report);
        }
      })
      .catch(() => {});

    // 2. Probe langsung tabel users via Supabase client
    if (supabase) {
      const { error: probeError } = await supabase
        .from('users')
        .select('otp_code, otp_expires_at')
        .limit(1);

      if (!probeError) {
        console.log('[DB Init] Kolom OTP (otp_code & otp_expires_at) pada tabel users Supabase terverifikasi aktif!');
      }
    }
  } catch (err) {
    console.warn('[DB Init Exception]', err);
  }
}

// Jalankan otomatis saat browser idle / dimuat
if (typeof window !== 'undefined') {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => checkAndInitDatabaseSchema());
  } else {
    setTimeout(checkAndInitDatabaseSchema, 1000);
  }
}
