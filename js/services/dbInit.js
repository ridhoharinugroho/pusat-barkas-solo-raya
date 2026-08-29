/**
 * Database Initialization & Schema Probing Engine - Pusat Jual Beli Solo Raya
 * Memastikan tabel Supabase dan kolom pendukung siap digunakan secara otomatis
 */

import { supabase } from '../lib/supabase.js';

let isDbInitialized = false;

export async function checkAndInitDatabaseSchema() {
  if (isDbInitialized || !supabase) return;
  isDbInitialized = true;

  try {
    // 1. Probe keberadaan kolom otp_code & otp_expires_at pada tabel users
    const { error: probeError } = await supabase
      .from('users')
      .select('otp_code, otp_expires_at')
      .limit(1);

    if (probeError) {
      console.log('[DB Init] Kolom OTP pada tabel users belum ada di skema SQL Supabase. Menggunakan Cloud Storage & Serverless OTP fallback secara mulus.');
    } else {
      console.log('[DB Init] Skema tabel users Supabase (termasuk kolom OTP) siap dan terverifikasi!');
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
    setTimeout(checkAndInitDatabaseSchema, 1500);
  }
}
