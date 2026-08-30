import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRpcs() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.app_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT,
      user_name TEXT,
      user_location TEXT,
      rating NUMERIC(2,1) NOT NULL DEFAULT 5,
      category TEXT DEFAULT 'Pengalaman Pengguna',
      review_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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
  `;

  console.log('Testing RPC calls on Supabase...');
  const fnNames = ['exec_sql', 'execute_sql', 'exec', 'run_sql', 'sql_query', 'pg_query', 'query', 'execute', 'run'];
  for (const fn of fnNames) {
    const res = await supabase.rpc(fn, { query: sql, sql_query: sql, sql: sql, p_sql: sql });
    console.log('RPC ' + fn + ' result:', res.error ? res.error.message : res.data);
  }
}
testRpcs();
