-- Migration: create_app_reviews_table
CREATE TABLE IF NOT EXISTS public.app_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  user_name text,
  user_location text,
  rating numeric,
  category text,
  review_text text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_reviews_user ON public.app_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_created ON public.app_reviews(created_at DESC);

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_reviews' AND policyname = 'app_reviews_read_public') THEN
    CREATE POLICY "app_reviews_read_public" ON public.app_reviews FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_reviews' AND policyname = 'app_reviews_insert_all') THEN
    CREATE POLICY "app_reviews_insert_all" ON public.app_reviews FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_reviews' AND policyname = 'app_reviews_update_all') THEN
    CREATE POLICY "app_reviews_update_all" ON public.app_reviews FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_reviews' AND policyname = 'app_reviews_delete_all') THEN
    CREATE POLICY "app_reviews_delete_all" ON public.app_reviews FOR DELETE USING (true);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;
