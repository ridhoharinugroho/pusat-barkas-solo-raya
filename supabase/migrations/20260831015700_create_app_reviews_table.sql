-- ============================================================
-- TABEL: app_reviews (Ulasan Aplikasi / Komunitas Pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_reviews (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  user_name text,
  user_location text,
  rating numeric,
  category text,
  review_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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
