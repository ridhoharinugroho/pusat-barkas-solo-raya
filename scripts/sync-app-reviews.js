import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const INITIAL_APP_REVIEWS = [
  {
    id: "app-rev-01",
    user_id: "user-102",
    user_name: "Toko Pak Joko (Jaten)",
    user_location: "Jaten",
    rating: 5,
    category: "Fitur & Kemudahan",
    review_text: "Sangat membantu jualan barang bekas di area Solo & Karanganyar. Tampilan simpel, pembeli langsung chat WhatsApp tanpa ribet.",
    created_at: "2026-08-15T10:00:00Z"
  },
  {
    id: "app-rev-02",
    user_id: "user-103",
    user_name: "Rian Gadget (Kartasura)",
    user_location: "Kartasura",
    rating: 5,
    category: "Kecepatan Transaksi",
    review_text: "Proses listing cepat dan tampilan responsif di HP. Sangat direkomendasikan untuk pedagang barkas dan UMKM Solo Raya.",
    created_at: "2026-08-18T14:30:00Z"
  },
  {
    id: "app-rev-03",
    user_id: "buyer-03",
    user_name: "Siti Rahayu (Delanggu)",
    user_location: "Delanggu",
    rating: 5,
    category: "Saran & Masukan",
    review_text: "Inisiatif bagus untuk Solo Raya! Saran untuk pengembang: pertahankan kemudahan pasang iklan tanpa ribet ini.",
    created_at: "2026-08-21T09:00:00Z"
  },
  {
    id: "app-rev-04",
    user_id: "user-1787309560138",
    user_name: "Zamir Shop (Jaten)",
    user_location: "Jaten",
    rating: 5,
    category: "Pengalaman Pengguna",
    review_text: "Solusi jual beli sat set se-Solo Raya. Mudah, praktis, dan langsung terhubung ke WhatsApp penjual!",
    created_at: "2026-08-28T12:00:00Z"
  }
];

async function syncAppReviews() {
  console.log('[Migration] Menjalankan migrasi data ulasan aplikasi ke tabel app_reviews Supabase...');
  try {
    const { data, error } = await supabase.from('app_reviews').upsert(INITIAL_APP_REVIEWS, { onConflict: 'id' }).select();
    if (error) {
      console.error('❌ Gagal sinkronisasi data ke app_reviews:', error.message);
    } else {
      console.log('✅ Berhasil migrasi ulasan aplikasi ke tabel app_reviews:', data?.length || INITIAL_APP_REVIEWS.length, 'ulasan.');
    }
  } catch (err) {
    console.error('❌ Exception saat migrasi app_reviews:', err);
  }
}

syncAppReviews();
