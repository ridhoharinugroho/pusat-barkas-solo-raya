/**
 * Database Initialization & Schema Probing Engine - Pusat Jual Beli Solo Raya
 * Memastikan tabel Supabase dan kolom pendukung siap digunakan secara otomatis
 */

import { supabase } from '../lib/supabase.js';

let isDbInitialized = false;
let hasOtpDbColumns = false;

if (typeof window !== 'undefined') {
  window._hasOtpDbColumns = false;
}

export function isOtpDbColumnSupported() {
  return hasOtpDbColumns || (typeof window !== 'undefined' && Boolean(window._hasOtpDbColumns));
}

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
          if (data.report && data.report.otp_columns_status === 'columns_verified') {
            hasOtpDbColumns = true;
            if (typeof window !== 'undefined') window._hasOtpDbColumns = true;
          }
        }
      })
      .catch(() => {});

    // 2. Probe tabel users dengan select generic '*' agar tidak memicu error 400 jika kolom belum ada
    if (supabase && !hasOtpDbColumns) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .limit(1);

      if (data && data.length > 0 && ('otp_code' in data[0] || 'otp_expires_at' in data[0])) {
        hasOtpDbColumns = true;
        if (typeof window !== 'undefined') window._hasOtpDbColumns = true;
        console.log('[DB Init] Kolom OTP (otp_code & otp_expires_at) pada tabel users Supabase terverifikasi aktif!');
      } else {
        hasOtpDbColumns = false;
        if (typeof window !== 'undefined') window._hasOtpDbColumns = false;
        console.log('[DB Init] Database menggunakan mode Cloud Storage & Serverless Engine untuk OTP.');
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
