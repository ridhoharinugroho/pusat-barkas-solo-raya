-- ============================================================
-- SQL Migration: Hapus Akun Danang Solo Manahan & Bersihkan Database
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Hapus akun Danang Solo Manahan dari tabel users
DELETE FROM public.users
WHERE id = 'user-101' 
   OR email = 'danang.solo@gmail.com'
   OR name ILIKE '%Danang Prasetyo%'
   OR store_name ILIKE '%Danang Solo Manahan%';

-- 2. Hapus atau alihkan listing terkait Danang Solo Manahan ke Zamir Shop jika ada
DELETE FROM public.listings
WHERE seller_id = 'user-101' 
   OR seller_email = 'danang.solo@gmail.com';

-- 3. Hapus ulasan yang terkait dengan seller_id Danang Solo
DELETE FROM public.reviews
WHERE seller_id = 'user-101';

-- 4. Pastikan akun-akun demo aktif lainnya tetap aman & utuh
-- (Joko Supriyanto, Rian Kurniawan, Siti Aisyah, dan Ridho Hari Nugroho)
SELECT id, name, store_name, email, phone, region, district 
FROM public.users 
ORDER BY id ASC;
