/**
 * solosatset - Supabase Client Connection
 * Koneksi database utama menggunakan Supabase v2
 *
 * CARA KONFIGURASI:
 * 1. Ganti SUPABASE_URL dan SUPABASE_ANON_KEY di bawah ini
 *    dengan nilai dari Supabase Dashboard > Project Settings > API
 * 2. Di Vercel: tambahkan environment variable SUPABASE_URL dan SUPABASE_ANON_KEY
 *
 * Supabase anon key AMAN untuk diekspos di frontend karena dilindungi oleh Row Level Security (RLS)
 */

// ============================================================
// GANTI DUA BARIS INI DENGAN CREDENTIALS SUPABASE ANDA:
// ============================================================
const SUPABASE_URL = 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';
// ============================================================

// Load Supabase JS v2 dari CDN (ESM-compatible, no build tool needed)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

function validateConfig() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('XXXX')) {
    console.error('[Supabase] SUPABASE_URL belum dikonfigurasi! Edit js/lib/supabase.js');
    return false;
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('XXXX')) {
    console.error('[Supabase] SUPABASE_ANON_KEY belum dikonfigurasi! Edit js/lib/supabase.js');
    return false;
  }
  return true;
}

let supabase = null;

if (validateConfig()) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { 'x-app-name': 'solosatset' } }
  });
  console.log('[Supabase] Client terhubung:', SUPABASE_URL.replace(/https:\/\/(.{8}).*\.supabase\.co/, 'https://$1****.supabase.co'));
}

export default supabase;
export { supabase };
