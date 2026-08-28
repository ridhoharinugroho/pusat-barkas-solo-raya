// sync-users.js – temporary script to upsert default users to Supabase
import supabase from '../js/lib/supabase.js';
import { DEFAULT_REGISTERED_USERS } from '../js/services/auth.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SUPABASE_URL or SUPABASE_ANON_KEY missing in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function sync() {
  const payload = DEFAULT_REGISTERED_USERS.map(u => ({
    id: u.id,
    name: u.name,
    store_name: u.storeName,
    email: u.email,
    phone: u.phone,
    region: u.region,
    district: u.district,
  }));
  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Supabase upsert error:', error.message);
    process.exit(1);
  } else {
    console.log('Default users synced successfully');
    process.exit(0);
  }
}

sync();
