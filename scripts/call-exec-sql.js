const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

async function run() {
  const query = "CREATE TABLE IF NOT EXISTS public.app_reviews (id uuid default gen_random_uuid() primary key, user_id text, user_name text, user_location text, rating numeric, category text, review_text text, created_at timestamp with time zone default timezone('utc'::text, now()) not null);";
  
  console.log('Sending request to /rest/v1/rpc/exec_sql...');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({ query: query, sql: query })
    });
    console.log('Status Code:', res.status);
    const body = await res.text();
    console.log('Response Body:', body);
  } catch (e) {
    console.error('Request failed:', e.message);
  }
}

run();
