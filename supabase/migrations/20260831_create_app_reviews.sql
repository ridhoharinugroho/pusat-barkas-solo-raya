-- ============================================================
-- TABEL: app_reviews (Ulasan Aplikasi / Komunitas Pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;
