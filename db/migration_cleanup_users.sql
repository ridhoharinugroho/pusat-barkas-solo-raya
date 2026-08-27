-- ============================================================
-- SQL Migration: Hapus Akun Duplikat & Aktifkan RLS DELETE
-- Jalankan di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. Berikan hak akses DELETE untuk public/anon di tabel users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND policyname = 'users_delete_own'
  ) THEN
    CREATE POLICY "users_delete_own" ON public.users FOR DELETE USING (true);
  END IF;
END $$;

-- 2. Hapus baris data duplikat lama
DELETE FROM public.users
WHERE id = 'user-ridho' OR email = 'ridho.merged.unused@example.com';

-- 3. Pastikan hanya tersisa satu akun aktif Ridho Hari Nugroho
UPDATE public.users
SET
  name = 'Ridho Hari Nugroho',
  store_name = 'Zamir Shop',
  email = 'ridho.harinugroho@gmail.com',
  phone = '081251018765',
  region = 'karanganyar',
  district = 'Tawangmangu',
  password = 'Semangat.45',
  bio = 'Dodol Opo Wae'
WHERE id = 'user-1787309560138' OR email = 'ridho.harinugroho@gmail.com';
