import { createClient } from '@supabase/supabase-js';

const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRefs = ['rwjqqoulqdmtsweuvbef', 'rwjqgoulqmtsweuvbef', 'rwjqgoulqdmtsweuvbef'];

const sqlStatement = `
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
`;

async function executeQuery() {
  console.log('=== Attempting SQL Migration with Secret Key ===');

  for (const ref of projectRefs) {
    const baseUrl = `https://${ref}.supabase.co`;
    console.log(`\n--- Testing project ref: ${ref} (${baseUrl}) ---`);

    // 1. Try Supabase Management API
    try {
      const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
          'apikey': secretKey
        },
        body: JSON.stringify({ query: sqlStatement })
      });
      const mgmtText = await mgmtRes.text();
      console.log(`[Management API] Status ${mgmtRes.status}: ${mgmtText.substring(0, 200)}`);
    } catch (e) {
      console.log(`[Management API] Error: ${e.message}`);
    }

    // 2. Try REST RPC endpoints
    const rpcEndpoints = [
      `${baseUrl}/rest/v1/rpc/exec_sql`,
      `${baseUrl}/rest/v1/rpc/execute_sql`,
      `${baseUrl}/rest/v1/rpc/run_sql`,
      `${baseUrl}/rest/v1/rpc/query`,
      `${baseUrl}/pg/query`
    ];

    for (const ep of rpcEndpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': secretKey,
            'Authorization': `Bearer ${secretKey}`
          },
          body: JSON.stringify({ query: sqlStatement, sql: sqlStatement })
        });
        const text = await res.text();
        console.log(`[RPC Endpoint ${ep}] Status ${res.status}: ${text.substring(0, 200)}`);
      } catch (e) {
        console.log(`[RPC Endpoint ${ep}] Error: ${e.message}`);
      }
    }
  }

  // Check if app_reviews table now exists on the primary url
  const supabase = createClient('https://rwjqqoulqdmtsweuvbef.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY');
  const { data, error } = await supabase.from('app_reviews').select('*').limit(1);
  console.log('\n=== Final app_reviews table check in Supabase ===');
  if (error) {
    console.log('❌ Error querying app_reviews:', error.message);
  } else {
    console.log('✅ SUCCESS! Table app_reviews is live in Supabase! Rows:', data.length);
  }
}

executeQuery();
