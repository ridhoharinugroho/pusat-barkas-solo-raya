import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const sqlStatement = `
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

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  title text not null,
  message text,
  body text,
  type text default 'bu_interest',
  category_id text,
  product_id text,
  listing_id text,
  url text,
  image text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.app_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

ALTER PUBLICATION supabase_realtime ADD TABLE public.app_reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
`;

async function main() {
  console.log('--- Probing Supabase Endpoints to Force Create Table app_reviews & notifications ---');
  
  // 1. Check REST endpoints
  const endpoints = [
    `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    `${SUPABASE_URL}/rest/v1/rpc/execute_sql`,
    `${SUPABASE_URL}/rest/v1/rpc/run_sql`,
    `${SUPABASE_URL}/rest/v1/rpc/query`,
    `${SUPABASE_URL}/pg/query`,
    `${SUPABASE_URL}/database/query`,
    `https://api.supabase.com/v1/projects/rwjqqoulqdmtsweuvbef/database/query`
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ query: sqlStatement, sql: sqlStatement })
      });
      const text = await resp.text();
      console.log(`Endpoint [${ep}] -> Status ${resp.status}: ${text.substring(0, 150)}`);
    } catch (e) {
      console.log(`Endpoint [${ep}] -> Error: ${e.message}`);
    }
  }

  // 2. Check if tables now exist
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: arData, error: arError } = await supabase.from('app_reviews').select('*').limit(1);
  console.log('Result checking app_reviews table:', arError ? arError.message : `SUCCESS! Rows: ${arData.length}`);

  const { data: notifData, error: notifError } = await supabase.from('notifications').select('*').limit(1);
  console.log('Result checking notifications table:', notifError ? notifError.message : `SUCCESS! Rows: ${notifData.length}`);
}

main();
