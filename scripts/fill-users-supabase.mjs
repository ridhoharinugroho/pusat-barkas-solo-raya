import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const demoAccounts = [
  {
    id: 'user-102',
    name: 'Joko Supriyanto',
    store_name: 'Toko Pak Joko',
    email: 'joko.kra@gmail.com',
    phone: '085725012345',
    region: 'karanganyar',
    district: 'Jaten',
    password: 'barkas123',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    bio: 'Pusat perabot rumah tangga & elektronik seken berkualitas Karanganyar.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'user-103',
    name: 'Rian Kurniawan',
    store_name: 'Rian Gadget Kartasura',
    email: 'rian.gadget@gmail.com',
    phone: '089678123456',
    region: 'sukoharjo',
    district: 'Kartasura',
    password: 'barkas123',
    avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80',
    bio: 'Thrift & gadget bekas garansi personal area UMS Kartasura & Solo Baru.',
    updated_at: new Date().toISOString()
  },
  {
    id: 'user-104',
    name: 'Siti Aisyah',
    store_name: "Aisyah's Crafts Solo",
    email: 'aisyah.crafts@example.com',
    phone: '081234567890',
    region: 'solo',
    district: 'Mojosongo',
    password: 'barkas123',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    bio: 'Handmade crafts, artwork, dan souvenir khas Solo. Fast WA response.',
    updated_at: new Date().toISOString()
  }
];

async function updateDemos() {
  console.log('--- Mengisi dan Memperbarui Data Akun di Supabase ---');
  for (const acc of demoAccounts) {
    const { data, error } = await sb.from('users').update(acc).eq('id', acc.id).select('*');
    if (error) {
      console.error(`Gagal update ${acc.id} (${acc.store_name}):`, error.message);
    } else {
      console.log(`Berhasil update ${acc.id} (${acc.store_name}):`, data);
    }
  }

  const { data: allUsers } = await sb.from('users').select('*');
  console.log('\n--- DATA TERKINI DI TABEL USERS SUPABASE ---');
  console.log(JSON.stringify(allUsers, null, 2));
}

updateDemos();
