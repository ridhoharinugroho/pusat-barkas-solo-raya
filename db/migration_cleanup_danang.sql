-- ============================================================
-- SQL Migration: Hapus Total Akun & Iklan Danang Solo Manahan
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Hapus akun Danang Solo Manahan dari tabel users
DELETE FROM public.users
WHERE id = 'user-101' 
   OR email ILIKE '%danang%'
   OR name ILIKE '%Danang%'
   OR store_name ILIKE '%Danang%';

-- 2. Hapus seluruh data iklan/listing milik Danang Solo Manahan dari tabel listings
DELETE FROM public.listings
WHERE seller_id = 'user-101' 
   OR seller_email ILIKE '%danang%'
   OR seller_name ILIKE '%Danang%';

-- 3. Hapus seluruh ulasan yang berkaitan dengan Danang Solo dari tabel reviews
DELETE FROM public.reviews
WHERE seller_id = 'user-101'
   OR comment ILIKE '%Danang%';

-- 4. Verifikasi sisa data pengguna (memastikan akun demo lain & Ridho Hari Nugroho tetap aman)
SELECT id, name, store_name, email, phone, region, district 
FROM public.users 
ORDER BY id ASC;

-- 5. Verifikasi sisa data listing aktif
SELECT id, title, price, region, seller_name, status 
FROM public.listings 
ORDER BY created_at DESC;
