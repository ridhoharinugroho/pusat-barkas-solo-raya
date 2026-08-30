-- ============================================================
-- solosatset - Supabase Database Schema
-- Jalankan script ini di: Supabase Dashboard > SQL Editor > New Query
-- ============================================================


-- ============================================================
-- 1. TABEL: listings (Iklan Barang)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listings (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  price         BIGINT DEFAULT 0,
  category      TEXT,
  condition     TEXT,
  nego_type     TEXT DEFAULT 'bisa_nego',
  region        TEXT,
  district      TEXT,
  seller_id     TEXT,
  seller_name   TEXT,
  seller_phone  TEXT,
  seller_avatar TEXT,
  images        JSONB DEFAULT '[]'::jsonb,
  status        TEXT DEFAULT 'active',   -- 'active' | 'sold' | 'paused' | 'deleted'
  views         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query umum
CREATE INDEX IF NOT EXISTS idx_listings_status    ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_region    ON public.listings(region);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_listings_created   ON public.listings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Policy: Siapapun bisa baca listing aktif
CREATE POLICY "listings_read_public" ON public.listings
  FOR SELECT USING (status != 'deleted');

-- Policy: User bisa insert listing (anonymous juga boleh sementara)
CREATE POLICY "listings_insert_all" ON public.listings
  FOR INSERT WITH CHECK (true);

-- Policy: User bisa update/delete listing miliknya
CREATE POLICY "listings_update_own" ON public.listings
  FOR UPDATE USING (true);

CREATE POLICY "listings_delete_own" ON public.listings
  FOR DELETE USING (true);


-- ============================================================
-- 2. TABEL: users (Akun Penjual)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  store_name    TEXT,
  email         TEXT UNIQUE,
  phone         TEXT,
  region        TEXT,
  district      TEXT,
  password      TEXT,
  avatar        TEXT,
  bio           TEXT,
  is_demo       BOOLEAN DEFAULT false,
  is_verified   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_public" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "users_insert_all" ON public.users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (true);

CREATE POLICY "users_delete_own" ON public.users
  FOR DELETE USING (true);


-- ============================================================
-- 3. TABEL: site_settings (Pengaturan Tampilan Admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id          TEXT PRIMARY KEY DEFAULT 'global',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read_public" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "settings_write_all" ON public.site_settings
  FOR ALL USING (true);


-- ============================================================
-- 4. TABEL: custom_texts (Teks Branding)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_texts (
  id          TEXT PRIMARY KEY DEFAULT 'global',
  texts       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.custom_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "texts_read_public" ON public.custom_texts
  FOR SELECT USING (true);

CREATE POLICY "texts_write_all" ON public.custom_texts
  FOR ALL USING (true);


-- ============================================================
-- 5. TABEL: seller_reviews (Ulasan Penjual)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id            TEXT PRIMARY KEY,
  seller_id     TEXT NOT NULL,
  buyer_id      TEXT,
  buyer_name    TEXT,
  buyer_avatar  TEXT,
  product_image TEXT,
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_hidden     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_seller ON public.seller_reviews(seller_id);

ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_read_public" ON public.seller_reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert_all" ON public.seller_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "reviews_update_all" ON public.seller_reviews
  FOR UPDATE USING (true);

CREATE POLICY "reviews_delete_all" ON public.seller_reviews
  FOR DELETE USING (true);


-- ============================================================
-- 6. TABEL: app_reviews (Ulasan Aplikasi / Komunitas Pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_reviews (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  user_name     TEXT,
  user_location TEXT,
  rating        NUMERIC(2,1) NOT NULL DEFAULT 5,
  category      TEXT DEFAULT 'Pengalaman Pengguna',
  review_text   TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_reviews_user ON public.app_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_created ON public.app_reviews(created_at DESC);

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_reviews_read_public" ON public.app_reviews
  FOR SELECT USING (true);

CREATE POLICY "app_reviews_insert_all" ON public.app_reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "app_reviews_update_all" ON public.app_reviews
  FOR UPDATE USING (true);

CREATE POLICY "app_reviews_delete_all" ON public.app_reviews
  FOR DELETE USING (true);


-- ============================================================
-- 7. FUNCTION: increment_listing_views (atomic counter)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_listing_views(listing_id TEXT)
RETURNS void AS $$
  UPDATE public.listings
  SET views = views + 1
  WHERE id = listing_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- ============================================================
-- 8. Enable Realtime untuk semua tabel
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_texts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;


-- ============================================================
-- Selesai! Cek tabel di: Supabase Dashboard > Table Editor
-- ============================================================
