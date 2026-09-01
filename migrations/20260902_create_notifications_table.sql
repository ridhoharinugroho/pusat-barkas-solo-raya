-- ============================================================
-- TABEL: notifications (Notifikasi Broadcast & In-App Alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,
  title         TEXT NOT NULL,
  message       TEXT,
  body          TEXT,
  type          TEXT DEFAULT 'bu_interest',
  category_id   TEXT,
  product_id    TEXT,
  listing_id    TEXT,
  url           TEXT,
  image         TEXT,
  is_read       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing untuk query cepat
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable Row Level Security (RLS) & Kebijakan Akses (Policies)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_select_public') THEN
    CREATE POLICY "notifications_select_public" ON public.notifications FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_insert_all') THEN
    CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_update_all') THEN
    CREATE POLICY "notifications_update_all" ON public.notifications FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'notifications_delete_all') THEN
    CREATE POLICY "notifications_delete_all" ON public.notifications FOR DELETE USING (true);
  END IF;
END $$;

-- Berikan izin akses penuh ke role anon, authenticated, dan service_role
GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

-- Aktifkan realtime Supabase untuk tabel notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
