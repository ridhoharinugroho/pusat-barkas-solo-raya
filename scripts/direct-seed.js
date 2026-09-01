import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rwjqqoulqdmtsweuvbef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anFxb3VscWRtdHN3ZXV2YmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzY0MjYsImV4cCI6MjEwMzI1MjQyNn0.xof6x2BoNkNp2ssXIiPJ4Dr3m-l7rFP9MaZFCSxfvZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_REGISTERED_USERS = [
  {
    id: "user-102",
    name: "Joko Supriyanto",
    email: "joko.kra@gmail.com",
    phone: "085725012345",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "user-103",
    name: "Rian Kurniawan",
    email: "rian.gadget@gmail.com",
    phone: "089678123456",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "user-104",
    name: "Siti Aisyah",
    email: "aisyah.crafts@example.com",
    phone: "081234567890",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
  },
  {
    id: "user-1787309560138",
    name: "Ridho Hari Nugroho",
    email: "ridho.harinugroho@gmail.com",
    phone: "081251018765",
    avatar: null
  }
];

const SAMPLE_LISTINGS = [
  {
    id: "barkas-001",
    title: "Honda Beat FI ESP 2018 Surat Lengkap Pajak Jalan Klaten",
    price: 9800000,
    category: "kendaraan",
    condition: "good",
    nego_type: "nego_alus",
    payment_method: "cod",
    region: "klaten",
    district: "Delanggu",
    cod_point: "COD SPBU Delanggu / Stasiun Delanggu Klaten",
    description: "Honda Beat ESP 2018 warna merah putih plat AD Klaten. Surat komplit STNK, BPKB, Faktur ready di rumah. Pajak tertib panjang sampai November 2026. Mesin halus kering no rembes, ban depan belakang tebal tubeless. Langsung pakai no PR!",
    images: [
      "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80"
    ],
    seller_id: "user-102",
    seller_name: "Toko Pak Joko",
    seller_phone: "085725012345",
    seller_avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    status: "active",
    views: 450,
    created_at: "2026-08-20T11:45:00Z"
  },
  {
    id: "barkas-002",
    title: "iPhone 11 128GB Black iBox Mulus Fullset BH 84%",
    price: 3950000,
    category: "elektronik",
    condition: "good",
    nego_type: "nego_alus",
    payment_method: "cod",
    region: "sukoharjo",
    district: "Kartasura",
    cod_point: "COD Kampus UMS / Goro Assalam Kartasura",
    description: "iPhone 11 128 GB Region PA/A (iBox Resmi Indonesia), sinyal semua operator aman seumur hidup. Face ID ON, TrueTone ON, 3uTools hijau semua 98%. Kelengkapan dusbook original, kabel c-to-lightning, bonus 3 case premium. COD dicek sepuasnya di kafe sekitar UMS.",
    images: [
      "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80"
    ],
    seller_id: "user-103",
    seller_name: "Rian Gadget Kartasura",
    seller_phone: "089678123456",
    seller_avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    status: "active",
    views: 310,
    created_at: "2026-08-20T08:00:00Z"
  },
  {
    id: "barkas-003",
    title: "Mesin Cuci Sharp 2 Tabung 8 Kg Bersih Siap Pakai",
    price: 850000,
    category: "perabot",
    condition: "good",
    nego_type: "nego_tipis",
    payment_method: "cod",
    region: "karanganyar",
    district: "Jaten",
    cod_point: "COD Rumah Palur / Sekitar UNS Solo - Jaten",
    description: "Barang rumahan mesin cuci Sharp Aquamagic 2 tabung kapasitas 8 kg. Tabung cuci & pengering normal kencang semua. Selang pembuangan & kabel utuh. Dijual karena ganti yang 1 tabung otomatis. Monggo diangkut bawa pick-up / mobil sendiri ya lur.",
    images: [
      "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=800&q=80"
    ],
    seller_id: "user-102",
    seller_name: "Toko Pak Joko",
    seller_phone: "085725012345",
    seller_avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    status: "active",
    views: 89,
    created_at: "2026-08-19T14:15:00Z"
  },
  {
    id: "barkas-004",
    title: "Meja Belajar Anak Sekolah & Rak Buku Kayu Jati Kokoh",
    price: 350000,
    category: "perabot",
    condition: "good",
    nego_type: "nego_alus",
    payment_method: "cod",
    region: "sragen",
    district: "Gemolong",
    cod_point: "COD Pasar Gemolong Sragen",
    description: "Meja belajar anak sekolah bahan kayu jati asli + rak buku susun. Rangka kokoh, laci normal, tidak goyang. Cocok untuk belajar anak SD/SMP/SMA maupun mahasiswa. Lokasi Gemolong Sragen.",
    images: [
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80"
    ],
    seller_id: "user-104",
    seller_name: "Aisyah's Crafts Solo",
    seller_phone: "081234567890",
    seller_avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    status: "active",
    views: 115,
    created_at: "2026-08-17T09:10:00Z"
  }
];

async function run() {
  console.log('1. Inserting official users...');
  const { data: users, error: uErr } = await supabase.from('users').upsert(DEFAULT_REGISTERED_USERS, { onConflict: 'id' }).select();
  if (uErr) {
    console.error('Users Insert Error:', uErr);
  } else {
    console.log('Users Inserted Success:', users ? users.length : 0);
  }

  console.log('2. Inserting official sample listings...');
  const { data: listings, error: lErr } = await supabase.from('listings').upsert(SAMPLE_LISTINGS, { onConflict: 'id' }).select();
  if (lErr) {
    console.error('Listings Insert Error:', lErr);
  } else {
    console.log('Listings Inserted Success:', listings ? listings.length : 0);
  }
}

run();
