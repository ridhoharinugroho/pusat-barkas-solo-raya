/**
 * Pusat Jual Beli Solo Raya - Persistent Storage & Cloud Real-Time Engine
 * Synchronizes across PC, Laptop, and Mobile/HP via Cloud Real-time PubSub + Supabase
 */

import { SAMPLE_LISTINGS } from '../data/sampleListings.js';
import { getCurrentUser, getUserById, getUserByReviewAuthor, DEFAULT_REGISTERED_USERS } from './auth.js';
import { supabase } from '../lib/supabase.js';
import { sbUploadMultipleImages, sbDeleteAvatar, sbBroadcastBuNotification, updateUserInterest } from './supabaseDB.js';
export { sbDeleteAvatar };

/**
 * Hapus fisik file avatar dari Supabase Storage bucket 'avatars'
 */
export async function deleteAvatarFile(avatarUrlOrPath) {
  if (!avatarUrlOrPath || typeof avatarUrlOrPath !== 'string') return true;
  const rawUrl = avatarUrlOrPath.trim();
  if (!rawUrl || rawUrl.includes('dicebear.com') || rawUrl.includes('unsplash.com') || rawUrl.startsWith('data:')) {
    return true; // Dilewati dengan aman untuk URL kosong, data URL, atau aset eksternal
  }

  try {
    let rawCleaned = rawUrl;
    if (rawUrl.includes('/avatars/')) {
      rawCleaned = rawUrl.split('/avatars/').pop();
    } else if (rawUrl.includes('avatars/')) {
      rawCleaned = rawUrl.split('avatars/').pop();
    }

    const cleanPath = decodeURIComponent(rawCleaned.split('?')[0].split('#')[0].trim());
    if (!cleanPath || cleanPath === '') return true;

    console.log(`[Storage deleteAvatarFile] Target cleanPath hapus avatar: "${cleanPath}" (URL asal: "${rawUrl}")`);

    if (supabase && supabase.storage) {
      const { error } = await supabase.storage.from('avatars').remove([cleanPath]);
      if (error) {
        console.warn(`[Storage deleteAvatarFile Notice] Gagal menghapus file avatar "${cleanPath}":`, error.message || error);
      } else {
        console.log(`✅ [Storage deleteAvatarFile Success] File avatar "${cleanPath}" berhasil dihapus dari bucket 'avatars'.`);
      }
      return true;
    }
  } catch (err) {
    console.warn('[Storage deleteAvatarFile Exception]:', err.message || err);
    return true;
  }
  return true;
}

import { initCloudRealtimeSync, broadcastToCloud } from './cloudSync.js';

// Safe broadcast helper to prevent unhandled reference or network errors
function safeBroadcastToCloud(type, data) {
  try {
    if (typeof broadcastToCloud === 'function') {
      broadcastToCloud(type, data).catch((e) => console.warn('[CloudSync Broadcast Warning]', e));
    }
  } catch (e) {
    console.warn('[CloudSync Broadcast Exception]', e);
  }
}

const STORAGE_KEY_LISTINGS = 'pusat_barkas_listings';
const STORAGE_KEY_FAVORITES = 'pusat_barkas_favorites';
const STORAGE_KEY_SETTINGS = 'pusat_barkas_site_settings';
const STORAGE_KEY_TEXTS = 'pusat_barkas_custom_texts';
const STORAGE_KEY_REVIEWS = 'pusat_barkas_seller_reviews';

export function formatRegionTitle(rawRegion) {
  if (!rawRegion) return 'Solo Raya';
  const reg = rawRegion.toString().trim().toLowerCase();
  const map = {
    'solo': 'Solo',
    'surakarta': 'Solo',
    'karanganyar': 'Karanganyar',
    'sukoharjo': 'Sukoharjo',
    'wonogiri': 'Wonogiri',
    'sragen': 'Sragen',
    'boyolali': 'Boyolali',
    'klaten': 'Klaten',
    'soloraya': 'Solo Raya',
    'solo raya': 'Solo Raya'
  };
  if (map[reg]) return map[reg];
  return reg.charAt(0).toUpperCase() + reg.slice(1);
}

export function formatDistrictTitle(rawDistrict) {
  if (!rawDistrict) return '';
  const clean = rawDistrict.toString().trim().replace(/^Kec\.?\s*/i, '').replace(/\.+$/, '');
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Default Sample Reviews for Initial Trust & Moderation
// Default Sample Reviews for Initial Trust & Moderation (22+ Positive Reviews for Seed Verified Seller)
export const DEFAULT_REVIEWS = [
  {
    id: "rev-001",
    sellerId: "user-1787309560138",
    buyerId: "buyer-01",
    buyerName: "Bagus Setiawan (Solo)",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Barang sangat sesuai deskripsi, sepeda lipat mulus dan bonus helm masih bagus. COD di Manahan fast response & ramah!",
    createdAt: "2026-08-18T14:30:00Z"
  },
  {
    id: "rev-002",
    sellerId: "user-1787309560138",
    buyerId: "buyer-02",
    buyerName: "Dewi Anggraini (Solo Baru)",
    buyerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Penjual terpercaya se-Solo. Komunikasi lewat WhatsApp sangat cepat dan ramah.",
    createdAt: "2026-08-19T09:15:00Z"
  },
  {
    id: "rev-003",
    sellerId: "user-1787309560138",
    buyerId: "buyer-03",
    buyerName: "Agus Triyanto (Banjarsari)",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Smart TV LG gambar bening banget, dicoba di lokasi lancar jaya. Zamir Shop top!",
    createdAt: "2026-08-17T11:00:00Z"
  },
  {
    id: "rev-004",
    sellerId: "user-1787309560138",
    buyerId: "buyer-04",
    buyerName: "Fajar Nugraha (Kartasura)",
    buyerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Kamera Sony A6000 shutter count rendah sesuai janji. Recommended seller Solo!",
    createdAt: "2026-08-16T16:45:00Z"
  },
  {
    id: "rev-005",
    sellerId: "user-1787309560138",
    buyerId: "buyer-05",
    buyerName: "Rudi Hartono (Laweyan)",
    buyerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Sofa L-Shape sudah sampai rumah, busa tebal dan kain bersih. Transaksi amanah.",
    createdAt: "2026-08-15T10:20:00Z"
  },
  {
    id: "rev-006",
    sellerId: "user-1787309560138",
    buyerId: "buyer-06",
    buyerName: "Hendra Wijaya (Jebres)",
    buyerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Kulkas Polytron dingin pol! Terima kasih mas Ridho dibantu angkut ke mobil.",
    createdAt: "2026-08-14T13:10:00Z"
  },
  {
    id: "rev-007",
    sellerId: "user-1787309560138",
    buyerId: "buyer-07",
    buyerName: "Siti Rahayu (Pasar Kliwon)",
    buyerAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Helm KYT TTC wangi dan mulus seperti baru. Packing rapi, penjual ramah pol.",
    createdAt: "2026-08-13T17:40:00Z"
  },
  {
    id: "rev-008",
    sellerId: "user-1787309560138",
    buyerId: "buyer-08",
    buyerName: "Budi Santoso (Serengan)",
    buyerAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Drone DJI Mini 2 normal pol, terbang stabil 4K jernih. Mantap banget pelayanannya!",
    createdAt: "2026-08-12T15:00:00Z"
  },
  {
    id: "rev-009",
    sellerId: "user-1787309560138",
    buyerId: "buyer-09",
    buyerName: "Eko Prasetyo (Palur)",
    buyerAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=400&q=80",
    rating: 4,
    comment: "PS4 Slim lancar jaya buat main bareng anak-anak. Respon WA cepat dan sopan.",
    createdAt: "2026-08-11T12:30:00Z"
  },
  {
    id: "rev-010",
    sellerId: "user-1787309560138",
    buyerId: "buyer-10",
    buyerName: "Wahyu Saputra (Colomadu)",
    buyerAvatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Jaket kulit Garut tebal dan asli kulit domba. Harga nego bersahabat. Matur nuwun mas!",
    createdAt: "2026-08-10T18:00:00Z"
  },
  {
    id: "rev-011",
    sellerId: "user-1787309560138",
    buyerId: "buyer-11",
    buyerName: "Bayu Anggoro (Kartasura)",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Gitar Yamaha F310 action ceper no fret buzz, suara renyah. Sukses terus Zamir Shop!",
    createdAt: "2026-08-09T08:45:00Z"
  },
  {
    id: "rev-012",
    sellerId: "user-1787309560138",
    buyerId: "buyer-12",
    buyerName: "Indra Permana (Gilingan)",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Toko paling recommended di Karanganyar & Solo. Barang berkualitas dan no tipu-tipu.",
    createdAt: "2026-08-08T19:15:00Z"
  },
  {
    id: "rev-013",
    sellerId: "user-1787309560138",
    buyerId: "buyer-13",
    buyerName: "Dimas Arianto (Solo)",
    buyerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Pelayanan sangat memuaskan, fast response WA dan jujur apa adanya terkait kondisi barang.",
    createdAt: "2026-08-07T14:10:00Z"
  },
  {
    id: "rev-014",
    sellerId: "user-1787309560138",
    buyerId: "buyer-14",
    buyerName: "Rina Kusuma (Mojosongo)",
    buyerAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "COD aman di Shelter Manahan, transaksi santai sambil ngobrol. Mantap toko lokal Solo!",
    createdAt: "2026-08-06T11:25:00Z"
  },
  {
    id: "rev-015",
    sellerId: "user-1787309560138",
    buyerId: "buyer-15",
    buyerName: "Galih Pratama (Solo)",
    buyerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80",
    rating: 4,
    comment: "Barang bagus, kondisi fisik 90% sesuai foto. Nego harga juga gampang.",
    createdAt: "2026-08-05T16:00:00Z"
  },
  {
    id: "rev-016",
    sellerId: "user-1787309560138",
    buyerId: "buyer-16",
    buyerName: "Lukman Hakim (Kerten)",
    buyerAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Sudah langganan beli barang hobi disini. Selalu puas dengan kualitasnya.",
    createdAt: "2026-08-04T10:40:00Z"
  },
  {
    id: "rev-017",
    sellerId: "user-1787309560138",
    buyerId: "buyer-17",
    buyerName: "Ahmad Fauzi (Kadipiro)",
    buyerAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Penjual ramah dan tepat waktu saat COD di Kota Barat. Sukses terus lapaknya!",
    createdAt: "2026-08-03T15:50:00Z"
  },
  {
    id: "rev-018",
    sellerId: "user-1787309560138",
    buyerId: "buyer-18",
    buyerName: "Bambang Irawan (Solo Baru)",
    buyerAvatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Barang elektronik dites bareng-bareng sampai tuntas. Sangat transparan dan profesional.",
    createdAt: "2026-08-02T13:20:00Z"
  },
  {
    id: "rev-019",
    sellerId: "user-1787309560138",
    buyerId: "buyer-19",
    buyerName: "Tri Wibowo (Banjarsari)",
    buyerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Harga barang paling masuk akal di Solo. Kualitas terjamin!",
    createdAt: "2026-08-01T09:10:00Z"
  },
  {
    id: "rev-020",
    sellerId: "user-1787309560138",
    buyerId: "buyer-20",
    buyerName: "Surya Kencana (Manahan)",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1507457379470-08b800bebc67?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Layanan cepat dan ramah, barang sesuai ekspektasi. Terima kasih mas Ridho!",
    createdAt: "2026-07-30T17:30:00Z"
  },
  {
    id: "rev-021",
    sellerId: "user-1787309560138",
    buyerId: "buyer-21",
    buyerName: "Wahid Hasyim (Solo)",
    buyerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Penjual sangat amanah. Barang sesuai janji, no minus tersembunyi.",
    createdAt: "2026-07-28T11:15:00Z"
  },
  {
    id: "rev-022",
    sellerId: "user-1787309560138",
    buyerId: "buyer-22",
    buyerName: "Nur Hidayat (Solo)",
    buyerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Pusat Jual Beli Solo Raya memang mantap, nemu toko Zamir Shop yang terpercaya.",
    createdAt: "2026-07-25T14:00:00Z"
  },
  {
    id: "rev-023",
    sellerId: "user-102",
    buyerId: "buyer-23",
    buyerName: "Agus Triyanto (Palur)",
    buyerAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "Mesin cuci sudah dites di tempat lancar jaya. Pak Joko ramah dan ngasih tips perawatan. Mantap Toko Lokal Karanganyar!",
    createdAt: "2026-08-17T11:00:00Z"
  },
  {
    id: "rev-024",
    sellerId: "user-103",
    buyerId: "buyer-24",
    buyerName: "Fajar Nugraha (Kartasura)",
    buyerAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80",
    productImage: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80",
    rating: 5,
    comment: "HP iPhone & gadget kondisi oke banget, batre awet dan garansi personal jelas. Recommended seller Kartasura!",
    createdAt: "2026-08-20T16:45:00Z"
  }
];

// Native Browser BroadcastChannel for 0ms Instant Real-Time Cross-Tab Synchronization
const realtimeChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('pusat_barkas_realtime_v2')
  : null;

// Default Constants
export const DEFAULT_SITE_SETTINGS = {
  fontFamily: 'sans',           // 'sans', 'serif', 'mono', 'poppins', 'inter', 'roboto', 'montserrat', 'outfit', 'playfair'
  layoutStyle: 'grid',          // 'grid', 'list'
  layoutColumns: 'grid2',       // 'grid2', 'grid3'
  filterPosition: 'below_hero', // 'below_hero', 'above_hero'
  announcementText: '📢 Selamat Datang di Pusat Jual Beli Solo Raya! Jual Beli Sat-Set Ra Nggo Ribet!!!',
  showAnnouncement: true,
  logoIcon: 'shopping-bag',
  logoGradient: 'from-rose-900 to-rose-700',
  logoImageUrl: 'assets/img/app-logo.png',
  detailImageSettings: {
    aspectRatio: 'aspect-square',
    maxWidth: 448,
    maxHeight: 560,
    objectFit: 'cover',
    isAspectLocked: true
  },
  textStyles: {},
  updatedAt: null
};

export const DEFAULT_CUSTOM_TEXTS = {
  // 0. Pengumuman Header Atas
  announcement_text: "📢 Selamat Datang di Pusat Jual Beli Solo Raya! Jual Beli Sat-Set Ra Nggo Ribet!!!",

  // 1. Header & Branding
  brand_name: "solosatset",
  brand_tagline: "",
  brand_subtagline: "Pantau Cocok Bayar • Nego Langsung WA",
  search_placeholder: "Cari sepeda, HP, motor, sofa se-Solo Raya...",
  
  // 2. Banner Sambutan / Hero Section
  hero_badge: "Pusat Jual Beli Komunitas Terpercaya Solo Raya",
  hero_title: "Cari & Jual Barang di 7 Wilayah Solo Raya",
  hero_subtitle: "Temukan barang murah berkualitas di Solo, Karanganyar, Sukoharjo, Wonogiri, Sragen, Boyolali, & Klaten. Hubungi penjual langsung lewat WhatsApp!",
  hero_coverage_label: "Cakupan Wilayah:",
  
  // 3. Tombol & Aksi
  btn_pasang_iklan: "Pasang Iklan",
  btn_filter: "Filter",
  btn_reset_filter: "Reset Semua Filter",
  btn_chat_wa_card: "Chat WA",
  btn_detail_card: "Detail",
  btn_hubungi_wa_detail: "Hubungi Penjual via WhatsApp",
  btn_bagikan: "Bagikan",
  
  // 4. Judul Bagian & Status
  region_section_title: "Pilih Wilayah Solo Raya",
  region_indicator_all: "Menampilkan: 7 Wilayah Solo Raya",
  sort_label: "Urutkan:",
  empty_title: "Tidak ada barang ditemukan",
  empty_desc: "Coba ganti kata kunci pencarian, ubah pilihan wilayah Solo Raya, atau atur ulang filter Anda.",
  
  // 5. Footer, Syarat & Ketentuan, & Info Komunitas
  footer_title: "Pusat Jual Beli Solo Raya",
  footer_desc: "Platform jual beli barang terpercaya berbasis komunitas untuk 7 wilayah Solo Raya. Transaksi aman, mudah, dan langsung terhubung dengan penjual via WhatsApp.",
  terms_title: "Ketentuan Transaksi & Tips COD Aman di Solo Raya",
  terms_content: "1. Selalu utamakan transaksi sistem Cash on Delivery (COD) di tempat umum yang ramai seperti Manahan, Solo Baru, atau SPBU.\n2. Periksa fisik, fungsi, dan kelengkapan barang secara teliti bersama penjual sebelum melakukan pembayaran.\n3. Jangan pernah mentransfer uang muka (DP) atau biaya booking tanpa bertemu penjual dan memeriksa barang secara langsung.",
  copyright_text: "© 2026 Pusat Jual Beli Solo Raya - Komunitas Terpercaya 7 Wilayah",
  updatedAt: null
};

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
let isStorageInitialized = false;

export async function initializeStorage() {
  if (isStorageInitialized) return;
  isStorageInitialized = true;

  try {
    // 1. In-memory listings fallback & purge any Danang references
    if (!Array.isArray(inMemoryListings) || inMemoryListings.length === 0) {
      inMemoryListings = [...SAMPLE_LISTINGS];
    }

    // Auto-seed ke Supabase jika tabel kosong
    if (supabase) {
      seedListingsToSupabaseIfEmpty().catch(() => {});
    }

    window.__siteSettings = { ...DEFAULT_SITE_SETTINGS };

    try {
      const { data: textsData } = await supabase.from('custom_texts').select('*').limit(1);
      const firstText = (textsData && textsData.length > 0) ? textsData[0] : null;
      window.__customTexts = firstText ? { ...DEFAULT_CUSTOM_TEXTS, ...firstText } : { ...DEFAULT_CUSTOM_TEXTS };
    } catch (tErr) {
      window.__customTexts = { ...DEFAULT_CUSTOM_TEXTS };
    }

    // Initialize reviews from Supabase or fallback to default
    let reviews = [];
    try {
      const { data, error } = await supabase.from('reviews').select('*');
      if (error) {
        console.warn('[Supabase] fetch reviews error:', error.message);
        reviews = DEFAULT_REVIEWS;
      } else {
        reviews = data.length ? data : DEFAULT_REVIEWS;
      }
    } catch (e) {
      console.error('[Supabase] exception fetching reviews:', e);
      reviews = DEFAULT_REVIEWS;
    }
    // Store in memory (no localStorage) for further use
    window.__reviews = reviews;

    // Fetch static database file fallback with Cache-Busting for fresh user sessions
    try {
      const cb = Date.now();
      fetch(`db/site_settings.json?_cb=${cb}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
        .then(r => r.ok ? r.json() : null)
        .then(dbSettings => {
          if (dbSettings) {
            const curRaw = window.__siteSettingsCache;
            if (!curRaw) {
              window.__siteSettingsCache = dbSettings;
              window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: dbSettings }));
            }
          }
        }).catch(() => {});

      fetch(`db/custom_texts.json?_cb=${cb}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
      })
        .then(r => r.ok ? r.json() : null)
        .then(dbTexts => {
          if (dbTexts) {
            const curRaw = window.__siteTextsCache;
            if (!curRaw) {
              window.__siteTextsCache = dbTexts;
              window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: dbTexts }));
            }
          }
        }).catch(() => {});
    } catch (e) {}

    // 2. Setup BroadcastChannel listener for 0ms cross-tab sync
    if (realtimeChannel) {
      realtimeChannel.onmessage = (event) => {
        try {
          const msg = event.data;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'SETTINGS_UPDATED') {
            window.__siteSettings = msg.payload;
            window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: msg.payload }));
          } else if (msg.type === 'TEXTS_UPDATED') {
            window.__customTexts = msg.payload;
            window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: msg.payload }));
          } else if (msg.type === 'LISTINGS_UPDATED') {
            inMemoryListings = msg.payload;
            window.dispatchEvent(new CustomEvent('listingsChanged', { detail: msg.payload }));
          }
        } catch (err) {
          console.info('[BroadcastChannel Message Info]:', err.message || err);
        }
      };
    }

    // 3. Initialize Worldwide Cloud Real-Time Synchronization
    initCloudRealtimeSync(
      (cloudTexts) => {
        if (!cloudTexts || typeof cloudTexts !== 'object') return;
        window.__customTexts = cloudTexts;
        window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: cloudTexts }));
      },
      (cloudSettings) => {
        if (!cloudSettings || typeof cloudSettings !== 'object') return;
        window.__siteSettings = cloudSettings;
        window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: cloudSettings }));
      },
      (cloudListings) => {
        if (Array.isArray(cloudListings) && cloudListings.length > 0) {
          inMemoryListings = cloudListings;
          window.dispatchEvent(new CustomEvent('listingsChanged', { detail: cloudListings }));
        }
      },
      (cloudUsers) => {
        if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
          window.dispatchEvent(new CustomEvent('registeredUsersChanged', { detail: cloudUsers }));
        }
      }
    );

  } catch (err) {
    console.error("Storage init:", err);
  }
}

// -------------------------------------------------------------
// GLOBAL CUSTOM TEXTS (GET / SAVE / RESET)
// -------------------------------------------------------------
export function getCustomTexts() {
  return window.__customTexts ? { ...window.__customTexts } : { ...DEFAULT_CUSTOM_TEXTS };
}

export async function saveCustomTexts(newTexts) {
  const current = getCustomTexts();
  const updated = { ...current, ...newTexts, updatedAt: new Date().toISOString() };
  window.__customTexts = updated;

  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: updated }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'TEXTS_UPDATED', payload: updated });
  }
  safeBroadcastToCloud('TEXTS_UPDATED', updated);

  if (supabase) {
    await supabase.from('custom_texts').upsert([{ id: 'global', texts: updated, updated_at: new Date().toISOString() }], { onConflict: 'id' });
  }
  return updated;
}

export async function resetCustomTexts() {
  const resetObj = { ...DEFAULT_CUSTOM_TEXTS, updatedAt: new Date().toISOString() };
  window.__customTexts = resetObj;

  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: resetObj }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'TEXTS_UPDATED', payload: resetObj });
  }
  safeBroadcastToCloud('TEXTS_UPDATED', resetObj);

  if (supabase) {
    await supabase.from('custom_texts').upsert([{ id: 'global', texts: resetObj, updated_at: new Date().toISOString() }], { onConflict: 'id' });
  }
  return resetObj;
}

// -------------------------------------------------------------
// PENGATURAN SITUS / FONT & LAYOUT (GET / SAVE)
// -------------------------------------------------------------
export function getSiteSettings() {
  return window.__siteSettings ? { ...window.__siteSettings } : { ...DEFAULT_SITE_SETTINGS };
}

export async function saveSiteSettings(newSettings) {
  const cur = getSiteSettings();
  const updated = { ...cur, ...newSettings, updatedAt: new Date().toISOString() };
  window.__siteSettings = updated;

  window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: updated }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'SETTINGS_UPDATED', payload: updated });
  }
  safeBroadcastToCloud('SETTINGS_UPDATED', updated);
  return updated;
}

// -------------------------------------------------------------
// LISTINGS MANAGEMENT (GET / SAVE / MODERATION)
// -------------------------------------------------------------

/**
 * 2. Sinkronisasi Data Murni ke Supabase:
 * Pengecekan otomatis saat aplikasi pertama kali dimuat: jika tabel 'listings' di Supabase masih kosong,
 * lakukan INSERT otomatis 4 barang demo resmi (Honda Beat, iPhone 11, Mesin Cuci Sharp, Meja Belajar).
 */
export async function seedListingsToSupabaseIfEmpty() {
  if (!supabase) return;
  try {
    const { data: existing, error } = await supabase.from('listings').select('id');
    if (!error && Array.isArray(existing) && existing.length === 0) {
      console.log('[Supabase Listings Seed] Tabel listings kosong di Supabase. Melakukan INSERT otomatis 4 barang demo resmi...');
      
      // 1. Ensure seller users exist in Supabase 'users' table first (to prevent foreign key constraint violation)
      const sellerUsers = SAMPLE_LISTINGS.map(l => ({
        id: l.seller.id,
        name: l.seller.name || l.seller.storeName,
        store_name: l.seller.storeName || l.seller.name,
        email: l.seller.email || `seller-${l.seller.id}@solosatset.my.id`,
        phone: l.seller.phone || '081234567890',
        region: l.seller.region || l.regionId || 'solo',
        district: l.seller.district || l.district || 'Banjarsari',
        avatar: l.seller.avatar || null,
        bio: (DEFAULT_REGISTERED_USERS.find(u => u.id === l.seller.id)?.bio) || `Penjual Resmi ${l.seller.storeName || l.seller.name}`,
        password: 'demo123password',
        is_demo: true,
        updated_at: new Date().toISOString()
      }));
      try {
        await supabase.from('users').upsert(sellerUsers, { onConflict: 'id' });
      } catch (uErr) {}

      // 2. Insert sample listings into Supabase
      const seedRows = SAMPLE_LISTINGS.map(l => ({
        id: l.id,
        title: l.title,
        description: l.description,
        price: l.price,
        category: l.category,
        condition: l.condition,
        nego_type: l.negoType,
        payment_method: l.paymentMethod || 'cod',
        region: l.regionId,
        district: l.district,
        cod_point: l.codPoint,
        seller_id: l.seller.id,
        seller_name: l.seller.storeName || l.seller.name,
        seller_phone: l.seller.phone,
        seller_avatar: l.seller.avatar,
        images: l.images,
        status: l.status || 'active',
        views: l.views || 0,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: l.createdAt || new Date().toISOString()
      }));

      const { error: insErr } = await supabase.from('listings').upsert(seedRows, { onConflict: 'id' });
      if (!insErr) {
        console.log('[Supabase Listings Seed Success] Berhasil insert 4 barang demo resmi');
      } else {
        console.warn('[Supabase Listings Seed Error]', insErr.message);
      }
    }
  } catch (err) {
    console.warn('[Supabase Listings Seed Exception]', err);
  }
}

let inMemoryListings = [...SAMPLE_LISTINGS];

export function getAllListings() {
  if (!Array.isArray(inMemoryListings) || inMemoryListings.length === 0) {
    inMemoryListings = [...SAMPLE_LISTINGS];
  }
  return inMemoryListings;
}

export function processAndBroadcastSupabaseListings(cloudData) {
  if (!Array.isArray(cloudData)) return [];
  const cleanCloud = cloudData.filter((c) => {
    if (!c) return false;
    const sEmail = c.seller_email || (c.seller && c.seller.email) || '';
    const sName = c.seller_name || (c.seller && (c.seller.storeName || c.seller.name)) || '';
    return !sEmail.toLowerCase().includes('danang.solo') && !sName.toLowerCase().includes('danang') && c.status !== 'deleted';
  }).map((c) => {
    let parsedImages = [];
    if (Array.isArray(c.images)) {
      parsedImages = c.images;
    } else if (typeof c.images === 'string') {
      try {
        const p = JSON.parse(c.images);
        if (Array.isArray(p)) parsedImages = p;
        else if (c.images.startsWith('http')) parsedImages = [c.images];
      } catch (e) {
        if (c.images.startsWith('http')) parsedImages = [c.images];
      }
    }
    if (!parsedImages || parsedImages.length === 0) {
      parsedImages = ["https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"];
    }

    return {
      id: c.id,
      title: c.title || 'Barang Jualan',
      price: Number(c.price) || 0,
      category: c.category || 'lainnya',
      condition: c.condition || 'good',
      negoType: c.nego_type || c.negoType || 'nego_alus',
      paymentMethod: c.payment_method || c.paymentMethod || 'cod',
      regionId: c.region || c.regionId || 'solo',
      district: c.district || '',
      codPoint: c.cod_point || c.codPoint || ('COD ' + (c.district || 'Solo Raya')),
      description: c.description || '',
      images: parsedImages,
      seller: {
        id: c.seller_id || 'user-anon',
        name: c.seller_name || 'Penjual Solo',
        storeName: c.seller_name || 'Penjual Solo',
        phone: c.seller_phone || '081234567890',
        avatar: c.seller_avatar || '',
        region: c.region || 'solo'
      },
      status: c.status || 'active',
      isSold: c.status === 'sold',
      is_bu: Boolean(c.is_bu || c.isBu),
      isBu: Boolean(c.is_bu || c.isBu),
      bu_expires_at: c.bu_expires_at || null,
      bu_activated_at: c.bu_activated_at || null,
      qris_verified: Boolean(c.qris_verified),
      payment_status: c.payment_status || (c.is_bu ? 'verified' : 'none'),
      views: Number(c.views) || 0,
      createdAt: c.created_at || c.createdAt || new Date().toISOString()
    };
  });

  const finalData = cleanCloud.length > 0 ? cleanCloud : [...SAMPLE_LISTINGS];
  inMemoryListings = finalData;
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: finalData }));
  return finalData;
}

let isFetchingListingsFromSupabase = false;
let lastFetchListingsTime = 0;

export async function fetchPublicListingsFromSupabase(force = false) {
  const now = Date.now();
  if (isFetchingListingsFromSupabase || (!force && (now - lastFetchListingsTime < 30000))) {
    return getPublicListings();
  }

  isFetchingListingsFromSupabase = true;
  lastFetchListingsTime = now;

  if (!supabase) {
    isFetchingListingsFromSupabase = false;
    return getPublicListings();
  }

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      if (data.length === 0) {
        await seedListingsToSupabaseIfEmpty();
        const { data: freshData } = await supabase.from('listings').select('*').order('created_at', { ascending: false });
        if (freshData && freshData.length > 0) {
          return processAndBroadcastSupabaseListings(freshData);
        }
      } else {
        return processAndBroadcastSupabaseListings(data);
      }
    }
  } catch (err) {
    console.warn('[Supabase Fetch Exception]', err);
  } finally {
    isFetchingListingsFromSupabase = false;
  }
  return getPublicListings();
}

export function getPublicListings() {
  const all = getAllListings();
  let localListings = all.filter((item) => !item.isHidden && item.status !== 'deleted');

  if (localListings.length === 0 && Array.isArray(SAMPLE_LISTINGS) && SAMPLE_LISTINGS.length > 0) {
    localListings = [...SAMPLE_LISTINGS];
  }

  return localListings;
}

/** Helper: merge Supabase listings dengan local listings tanpa duplikasi */
function mergeListings(local, cloud) {
  const map = new Map();
  local.forEach(l => {
    map.set(l.id, l);
  });
  cloud.forEach(c => {
    const existing = map.get(c.id);
    if (!existing) {
      map.set(c.id, c);
    } else {
      const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const cloudTime = c.updated_at ? new Date(c.updated_at).getTime() : (c.updatedAt ? new Date(c.updatedAt).getTime() : 0);
      if (cloudTime >= localTime) {
        map.set(c.id, c);
      }
    }
  });
  return Array.from(map.values());
}

export function getListingById(id) {
  const listings = getAllListings();
  return listings.find((item) => item.id === id) || null;
}

export function saveListing(listingData) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.id) {
    throw new Error("Silakan masuk atau daftar akun terlebih dahulu untuk memasang iklan.");
  }

  const activeSellerId = currentUser.id;
  const activeSellerName = currentUser.storeName || currentUser.name || 'Penjual';
  const activeSellerPhone = currentUser.phone || '081234567890';
  const activeSellerEmail = currentUser.email || '';
  const activeSellerAvatar = currentUser.avatar || '';
  const activeSellerRegion = currentUser.region || listingData.regionId || 'solo';

  const isBu = Boolean(listingData.is_bu || listingData.isBu);
  const buExpiresAt = isBu ? (listingData.bu_expires_at || null) : null;
  const buActivatedAt = isBu ? (listingData.bu_activated_at || new Date().toISOString()) : null;

  const newListing = {
    id: `barkas-${Date.now()}`,
    title: listingData.title.trim(),
    price: Number(listingData.price) || 0,
    category: listingData.category || 'lainnya',
    condition: listingData.condition || 'good',
    negoType: listingData.negoType || 'nego_alus',
    paymentMethod: listingData.paymentMethod || 'cod',
    storeMapsUrl: listingData.storeMapsUrl || '',
    is_bu: isBu,
    isBu: isBu,
    bu_expires_at: buExpiresAt,
    bu_activated_at: buActivatedAt,
    qris_verified: Boolean(listingData.qris_verified || listingData.isQrisVerified || listingData.payment_status === 'verified'),
    payment_status: listingData.payment_status || (listingData.qris_verified ? 'verified' : (isBu ? 'verified' : 'none')),
    regionId: listingData.regionId || activeSellerRegion,
    district: listingData.district || currentUser.district || 'Banjarsari',
    codPoint: listingData.codPoint || 'COD di ' + (listingData.district || 'Solo Raya'),
    description: listingData.description ? listingData.description.trim() : '',
    images: listingData.images && listingData.images.length > 0 ? listingData.images : [],
    seller: {
      id: activeSellerId,
      name: activeSellerName,
      storeName: activeSellerName,
      phone: activeSellerPhone,
      email: activeSellerEmail,
      avatar: activeSellerAvatar,
      region: activeSellerRegion
    },
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  // 1. Simpan ke in-memory listings (instant)
  const listings = getAllListings();
  listings.unshift(newListing);

  // Trigger BU Notification Broadcast if is_bu is active
  if (newListing.is_bu) {
    if (typeof sbBroadcastBuNotification === 'function') {
      sbBroadcastBuNotification(newListing.id, newListing.category, {
        title: newListing.title,
        price: newListing.price,
        image: (newListing.images && newListing.images[0]) || ''
      }).catch((e) => console.warn('[BU Broadcast saveListing Error]', e));
    } else if (typeof window !== 'undefined' && typeof window.triggerBuNotification === 'function') {
      window.triggerBuNotification(newListing.id, newListing.category);
    }
  }

  // Otomatis catat kategori barang yang dipasang sebagai salah satu minat akun pembuat iklan
  if (activeSellerId && newListing.category) {
    try {
      if (typeof updateUserInterest === 'function') {
        updateUserInterest(activeSellerId, newListing.category);
      }
    } catch (e) {
      console.warn('[saveListing updateUserInterest error]', e);
    }
  }

  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }
  safeBroadcastToCloud('LISTINGS_UPDATED', listings);

  // 2. Async sync ke Supabase (non-blocking)
  if (supabase) {
    (async () => {
      let finalImages = newListing.images;
      if (finalImages && Array.isArray(finalImages) && finalImages.some(img => typeof img === 'string' && img.startsWith('data:'))) {
        try {
          const uploadedUrls = await sbUploadMultipleImages(finalImages, '');
          if (uploadedUrls && uploadedUrls.length > 0) {
            finalImages = uploadedUrls;
            newListing.images = finalImages;
            const currentListings = getAllListings();
            const idx = currentListings.findIndex((item) => item.id === newListing.id);
            if (idx !== -1) {
              currentListings[idx].images = finalImages;
            }
          }
        } catch (e) {
          console.warn('[Supabase Storage] Listing image upload error:', e);
        }
      }

      const sbRow = {
        id: newListing.id,
        title: newListing.title,
        description: newListing.description,
        price: Number(newListing.price) || 0,
        category: newListing.category,
        condition: newListing.condition,
        nego_type: newListing.negoType || newListing.nego_type || 'nego_alus',
        region: newListing.regionId || newListing.region || activeSellerRegion,
        district: newListing.district || '',
        seller_id: activeSellerId,
        seller_name: activeSellerName,
        seller_phone: activeSellerPhone,
        seller_avatar: activeSellerAvatar,
        images: finalImages,
        status: newListing.status || 'active',
        is_bu: newListing.is_bu,
        bu_expires_at: newListing.bu_expires_at,
        views: Number(newListing.views) || 0,
        created_at: newListing.createdAt || new Date().toISOString(),
        updated_at: newListing.createdAt || new Date().toISOString()
      };
      supabase.from('listings').upsert([sbRow], { onConflict: 'id' })
        .then(({ error }) => {
          if (error) console.warn('[Supabase] saveListing sync error:', error.message);
          else console.log(`✅ [Supabase] Listing ${newListing.id} synced to DB directly with is_bu=${newListing.is_bu} and expires_at=${newListing.bu_expires_at}`);
        }).catch(() => {});
    })();
  }

  return newListing;
}

export function updateListing(id, updatedFields) {
  const targetId = String(id || '').trim();
  const listings = getAllListings();
  let index = listings.findIndex((item) => String(item.id).trim() === targetId);

  let updatedFieldsCopy = { ...updatedFields };
  if (updatedFieldsCopy.is_bu !== undefined || updatedFieldsCopy.isBu !== undefined) {
    const isBuVal = Boolean(updatedFieldsCopy.is_bu !== undefined ? updatedFieldsCopy.is_bu : updatedFieldsCopy.isBu);
    updatedFieldsCopy.is_bu = isBuVal;
    updatedFieldsCopy.isBu = isBuVal;
    updatedFieldsCopy.bu_expires_at = isBuVal ? (updatedFieldsCopy.bu_expires_at || null) : null;
    updatedFieldsCopy.bu_activated_at = isBuVal ? (updatedFieldsCopy.bu_activated_at || new Date().toISOString()) : null;
  }

  if (index === -1) {
    const newEntry = {
      id: targetId,
      ...updatedFieldsCopy,
      updatedAt: new Date().toISOString()
    };
    listings.unshift(newEntry);
    index = 0;
  } else {
    listings[index] = {
      ...listings[index],
      ...updatedFieldsCopy,
      updatedAt: new Date().toISOString()
    };
  }

  // Trigger BU Notification Broadcast if is_bu is active
  const updatedItem = listings[index];
  if (updatedItem.is_bu) {
    if (typeof sbBroadcastBuNotification === 'function') {
      sbBroadcastBuNotification(updatedItem.id, updatedItem.category, {
        title: updatedItem.title,
        price: updatedItem.price,
        image: (updatedItem.images && updatedItem.images[0]) || ''
      }).catch((e) => console.warn('[BU Broadcast updateListing Error]', e));
    } else if (typeof window !== 'undefined' && typeof window.triggerBuNotification === 'function') {
      window.triggerBuNotification(updatedItem.id, updatedItem.category);
    }
  }

  // Otomatis catat kategori barang yang diperbarui sebagai salah satu minat akun pembuat iklan
  const activeSellerUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const currentSellerId = activeSellerUser?.id || updatedItem?.seller?.id || updatedItem?.seller_id;
  if (currentSellerId && updatedItem?.category) {
    try {
      if (typeof updateUserInterest === 'function') {
        updateUserInterest(currentSellerId, updatedItem.category);
      }
    } catch (e) {
      console.warn('[updateListing updateUserInterest error]', e);
    }
  }
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  safeBroadcastToCloud('LISTINGS_UPDATED', listings);

  // Supabase sync
  if (supabase) {
    (async () => {
      if (updatedFieldsCopy.images && Array.isArray(updatedFieldsCopy.images) && updatedFieldsCopy.images.some(img => typeof img === 'string' && img.startsWith('data:'))) {
        try {
          const uploadedUrls = await sbUploadMultipleImages(updatedFieldsCopy.images, '');
          if (uploadedUrls && uploadedUrls.length > 0) {
            updatedFieldsCopy.images = uploadedUrls;
            const currentListings = getAllListings();
            const idx = currentListings.findIndex((item) => String(item.id).trim() === targetId);
            if (idx !== -1) {
              currentListings[idx].images = uploadedUrls;
            }
          }
        } catch (e) {
          console.warn('[Supabase Storage] Update image upload error:', e);
        }
      }

      // Sanitize payload agar kolom valid tabel listings (termasuk is_bu & bu_expires_at) dikirim ke Supabase
      const cleanUpdatePayload = {};
      if (updatedFieldsCopy.title !== undefined) cleanUpdatePayload.title = updatedFieldsCopy.title;
      if (updatedFieldsCopy.description !== undefined) cleanUpdatePayload.description = updatedFieldsCopy.description;
      if (updatedFieldsCopy.price !== undefined) cleanUpdatePayload.price = Number(updatedFieldsCopy.price) || 0;
      if (updatedFieldsCopy.category !== undefined) cleanUpdatePayload.category = updatedFieldsCopy.category;
      if (updatedFieldsCopy.condition !== undefined) cleanUpdatePayload.condition = updatedFieldsCopy.condition;
      if (updatedFieldsCopy.negoType !== undefined || updatedFieldsCopy.nego_type !== undefined) cleanUpdatePayload.nego_type = updatedFieldsCopy.negoType || updatedFieldsCopy.nego_type;
      if (updatedFieldsCopy.regionId !== undefined || updatedFieldsCopy.region !== undefined) cleanUpdatePayload.region = updatedFieldsCopy.regionId || updatedFieldsCopy.region;
      if (updatedFieldsCopy.district !== undefined) cleanUpdatePayload.district = updatedFieldsCopy.district;
      if (updatedFieldsCopy.status !== undefined) cleanUpdatePayload.status = updatedFieldsCopy.status;
      if (updatedFieldsCopy.views !== undefined) cleanUpdatePayload.views = Number(updatedFieldsCopy.views) || 0;
      if (updatedFieldsCopy.images !== undefined) cleanUpdatePayload.images = updatedFieldsCopy.images;
      if (updatedFieldsCopy.is_bu !== undefined) cleanUpdatePayload.is_bu = updatedFieldsCopy.is_bu;
      if (updatedFieldsCopy.bu_expires_at !== undefined) cleanUpdatePayload.bu_expires_at = updatedFieldsCopy.bu_expires_at;

      const activeUser = getCurrentUser();
      if (activeUser?.id) cleanUpdatePayload.seller_id = activeUser.id;
      if (activeUser?.storeName || activeUser?.name) cleanUpdatePayload.seller_name = activeUser.storeName || activeUser.name;
      if (activeUser?.phone) cleanUpdatePayload.seller_phone = activeUser.phone;
      if (activeUser?.avatar !== undefined) cleanUpdatePayload.seller_avatar = activeUser.avatar;
      cleanUpdatePayload.updated_at = new Date().toISOString();

      const { error } = await supabase.from('listings').update(cleanUpdatePayload).eq('id', targetId);
      if (error) {
        console.error('❌ [Supabase] updateListing error:', error.message);
      } else {
        console.log(`✅ [Supabase] updateListing sukses diperbarui untuk ID "${targetId}":`, cleanUpdatePayload.title || targetId, `(is_bu=${cleanUpdatePayload.is_bu})`);
      }
    })();
  }

  return listings[index];
}

export function toggleSoldStatus(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isSold = !listings[index].isSold;
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  safeBroadcastToCloud('LISTINGS_UPDATED', listings);
  return listings[index];
}

export function toggleHideListing(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isHidden = !listings[index].isHidden;
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  safeBroadcastToCloud('LISTINGS_UPDATED', listings);
  return listings[index];
}

export function deleteListing(id) {
  inMemoryListings = inMemoryListings.filter((item) => String(item.id).trim() !== String(id).trim());
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: inMemoryListings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: inMemoryListings });
  }

  safeBroadcastToCloud('LISTINGS_UPDATED', inMemoryListings);

  // Supabase sync
  if (supabase) {
    supabase.from('listings').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('[Supabase] deleteListing:', error.message); })
      .catch(() => {});
  }

  return true;
}

export function incrementListingViews(id) {
  const listings = getAllListings();
  const item = listings.find((l) => l.id === id);
  if (item) {
    item.views = (item.views || 0) + 1;
  }
}

export function getMyListings(userOrId) {
  if (!userOrId) return [];
  const targetId = typeof userOrId === 'string' ? userOrId.trim() : (userOrId.id || '').trim();
  const targetPhone = typeof userOrId === 'object' ? (userOrId.phone || '').replace(/\D/g, '') : '';
  const targetEmail = typeof userOrId === 'object' ? (userOrId.email || '').toLowerCase().trim() : '';
  const targetName = typeof userOrId === 'object' ? (userOrId.storeName || userOrId.name || '').toLowerCase().trim() : '';

  const listings = getAllListings();
  return listings.filter((item) => {
    if (!item || item.status === 'deleted') return false;

    // 1. Cocokkan berdasarkan ID Penjual Langsung
    const sId = item.seller?.id || item.seller_id || item.user_id || item.userId;
    if (targetId && sId && String(sId).trim() === targetId) {
      return true;
    }

    // 2. Cocokkan ID Aliases (ridho / zamir shop)
    if (targetId && (targetId === 'user-ridho' || targetId === 'user-1787309560138')) {
      if (sId === 'user-ridho' || sId === 'user-1787309560138') return true;
    }

    // 3. Cocokkan berdasarkan Nomor WhatsApp
    const sPhone = (item.seller?.phone || item.seller_phone || '').replace(/\D/g, '');
    if (targetPhone && sPhone && (sPhone === targetPhone || sPhone.endsWith(targetPhone) || targetPhone.endsWith(sPhone))) {
      return true;
    }

    // 4. Cocokkan berdasarkan Email Penjual
    const sEmail = (item.seller?.email || item.seller_email || '').toLowerCase().trim();
    if (targetEmail && sEmail && sEmail === targetEmail) {
      return true;
    }

    // 5. Cocokkan berdasarkan Nama Toko / Penjual
    const sName = (item.seller?.storeName || item.seller?.name || item.seller_name || '').toLowerCase().trim();
    if (targetName && sName && (sName === targetName || targetName.includes(sName) || sName.includes(targetName))) {
      return true;
    }

    return false;
  });
}

// Favorites
// Favorites – fetch from Supabase (cached in memory)
export async function getFavoriteIds() {
  try {
    // Return cached if available
    if (Array.isArray(window.__favorites)) return window.__favorites;
    const { data, error } = await supabase.from('favorites').select('listing_id');
    if (error) {
      console.warn('[Supabase] fetch favorites error:', error.message);
      window.__favorites = [];
    } else if (Array.isArray(data)) {
      // Map rows to listing IDs, ensure array
      window.__favorites = data.map(row => row.listing_id);
    } else {
      window.__favorites = [];
    }
    return window.__favorites;
  } catch (e) {
    console.error('[Supabase] exception fetching favorites:', e);
    window.__favorites = [];
    return [];
  }
}

// Toggle favorite – update Supabase and refresh cache
export async function toggleFavorite(listingId) {
  const favs = await getFavoriteIds();
  const exists = favs.includes(listingId);
  let updated;
  if (exists) {
    updated = favs.filter(id => id !== listingId);
    // Delete rows for this listingId
    await supabase.from('favorites').delete().eq('listing_id', listingId);
  } else {
    updated = [...favs, listingId];
    await supabase.from('favorites').insert({ listing_id: listingId });
  }
  window.__favorites = updated;
  return !exists;
}

export function isFavorite(listingId) {
  try {
    const favs = Array.isArray(window.__favorites) ? window.__favorites : [];
    return favs.includes(listingId);
  } catch (e) {
    console.error('[isFavorite] error:', e);
    return false;
  }
}

// -------------------------------------------------------------
// SELLER LISTINGS & STATUS (TERSEDIA / BOOKED / TERJUAL)
// -------------------------------------------------------------
export function updateListingStatus(id, newStatus) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const validStatus = ['available', 'booked', 'sold'].includes(newStatus) ? newStatus : 'available';
  
  listings[index] = {
    ...listings[index],
    status: validStatus,
    isSold: validStatus === 'sold',
    updatedAt: new Date().toISOString()
  };

  window.__listingsCache = listings;
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  safeBroadcastToCloud('LISTINGS_UPDATED', listings);

  // Supabase sync
  if (supabase) {
    supabase.from('listings').update({ status: validStatus, updated_at: new Date().toISOString() }).eq('id', id)
      .then(({ error }) => { if (error) console.warn('[Supabase] updateListingStatus:', error.message); })
      .catch(() => {});
  }

  return listings[index];
}

export function getListingsBySellerId(sellerId) {
  if (!sellerId) return [];
  const listings = getAllListings();
  return listings.filter((item) => item.seller && item.seller.id === sellerId);
}

export function getSellerStats(sellerId) {
  const items = getListingsBySellerId(sellerId);
  const totalListings = items.length;
  const availableCount = items.filter((l) => !l.isSold && l.status !== 'sold' && l.status !== 'booked').length;
  const bookedCount = items.filter((l) => l.status === 'booked').length;
  const soldCount = items.filter((l) => l.isSold || l.status === 'sold').length;
  const totalViews = items.reduce((sum, item) => sum + (item.views || 0), 0);

  return {
    totalListings,
    availableCount,
    bookedCount,
    soldCount,
    totalViews
  };
}

// -------------------------------------------------------------
// SELLER REVIEWS & RATING (1-5 STARS)
// -------------------------------------------------------------
export function getAllReviews() {
  const raw = window.__reviews;
  if (!raw || !raw.length) {
    window.__reviews = [...DEFAULT_REVIEWS];
    return window.__reviews;
  }
  return raw;
}

export function getSellerReviews(sellerId, includeHidden = false) {
  if (!sellerId) return [];
  const all = getAllReviews();
  return all
    .filter((r) => r.sellerId === sellerId && (includeHidden || !r.isHidden))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function toggleHideSellerReview(reviewId) {
  if (sessionStorage.getItem('pusat_barkas_admin_auth') !== 'true') {
    throw new Error("Akses ditolak: Hanya admin yang berwenang untuk menyembunyikan ulasan toko.");
  }
  const all = getAllReviews();
  const idx = all.findIndex((r) => r.id === reviewId);
  if (idx === -1) return null;

  all[idx].isHidden = !all[idx].isHidden;
  window.__reviews = all;

  const updatedReview = all[idx];
  window.dispatchEvent(new CustomEvent('sellerReviewsChanged', { detail: { sellerId: updatedReview.sellerId, review: updatedReview } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'REVIEW_UPDATED', payload: { sellerId: updatedReview.sellerId, review: updatedReview } });
  }
  return updatedReview;
}

export async function deleteSellerReview(reviewId) {
  if (sessionStorage.getItem('pusat_barkas_admin_auth') !== 'true') {
    throw new Error("Akses ditolak: Hanya admin yang berwenang untuk menghapus ulasan toko.");
  }
  const all = getAllReviews();
  const idx = all.findIndex((r) => r.id === reviewId);
  if (idx === -1) return false;

  const targetSellerId = all[idx].sellerId;

  if (supabase) {
    try {
      await supabase.from('seller_reviews').delete().eq('id', reviewId);
    } catch (e) {}
  }

  all.splice(idx, 1);
  window.__reviews = all;

  window.dispatchEvent(new CustomEvent('sellerReviewsChanged', { detail: { sellerId: targetSellerId, deletedReviewId: reviewId } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'REVIEW_DELETED', payload: { sellerId: targetSellerId, reviewId } });
  }
  return true;
}

export function addSellerReview({ sellerId, rating, comment, productImage }) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan toko.");
  }

  if (currentUser.id === sellerId) {
    throw new Error("Anda tidak dapat memberikan ulasan untuk toko Anda sendiri.");
  }

  // Validasi wajib foto produk yang dibeli: Ulasan tanpa foto produk akan ditolak sistem
  if (!productImage || productImage.trim() === '') {
    throw new Error("Ulasan ditolak sistem: Anda wajib melampirkan foto produk/barang yang dibeli sebagai bukti ulasan terverifikasi.");
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    throw new Error("Rating harus bernilai 1 hingga 5 bintang.");
  }

  const cleanComment = (comment || '').trim();
  if (!cleanComment) {
    throw new Error("Tuliskan ulasan atau pengalaman transaksi Anda.");
  }

  const all = getAllReviews();
  const districtName = currentUser.district ? formatDistrictTitle(currentUser.district) : '';
  const regionName = currentUser.region ? formatRegionTitle(currentUser.region) : 'Solo Raya';
  const locationTag = districtName || regionName;
  const buyerDisplayName = currentUser.storeName || currentUser.name || 'Pengguna';

  const newReview = {
    id: `rev-${Date.now()}`,
    sellerId,
    buyerId: currentUser.id,
    buyerName: `${buyerDisplayName} (${locationTag})`,
    buyerAvatar: currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    productImage: productImage,
    rating: numRating,
    comment: cleanComment,
    createdAt: new Date().toISOString()
  };

  all.unshift(newReview);
  window.__reviews = all;

  window.dispatchEvent(new CustomEvent('sellerReviewsChanged', { detail: { sellerId, review: newReview } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'REVIEW_ADDED', payload: { sellerId, review: newReview } });
  }

  // Supabase sync
  if (supabase) {
    const sbReviewPayload = {
      id: newReview.id,
      seller_id: newReview.sellerId,
      buyer_id: newReview.buyerId,
      buyer_name: newReview.buyerName,
      buyer_avatar: newReview.buyerAvatar,
      product_image: newReview.productImage,
      rating: newReview.rating,
      comment: newReview.comment,
      created_at: newReview.createdAt
    };

    console.log('[Supabase Review Sync] Mengirim payload data ulasan ke database Supabase:', sbReviewPayload);

    supabase.from('seller_reviews').insert([sbReviewPayload]).then(({ data, error }) => {
      if (error) {
        console.error('[Supabase Error] Gagal menyimpan ulasan ke tabel seller_reviews Supabase:', error.message || error, error);
      } else {
        console.log('[Supabase Success] Ulasan berhasil disimpan ke tabel seller_reviews Supabase:', data || sbReviewPayload.id);
      }
    }).catch((err) => {
      console.error('[Supabase Exception] Kendala koneksi/eksekusi saat insert ulasan ke Supabase:', err);
    });
  }

  return newReview;
}

export function getSellerRatingStats(sellerId) {
  // Hanya hitung ulasan yang tidak disembunyikan
  const reviews = getSellerReviews(sellerId, false);
  if (reviews.length === 0) {
    return {
      averageRating: 0.0,
      totalReviews: 0,
      ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }

  const totalReviews = reviews.length;
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;

  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    ratingCounts[star] = (ratingCounts[star] || 0) + 1;
    sum += r.rating;
  });

  const averageRating = Number((sum / totalReviews).toFixed(1));

  return {
    averageRating,
    totalReviews,
    ratingCounts
  };
}

// -------------------------------------------------------------
// 5 STRICT CRITERIA FOR SELLER VERIFICATION BADGE
// -------------------------------------------------------------
/**
 * Logika Sistem Syarat Badge 'Terverifikasi / Toko Lokal':
 * 1. Minimal 20 ulasan positif (rating >= 4).
 * 2. Rating rata-rata minimal 4.5.
 * 3. Telah memposting minimal 10 barang jualan.
 * 4. Profil lengkap (Foto Avatar, Lokasi Kab/Kec, dan No. WA).
 * 5. Usia akun minimal 30 hari.
 */
export function checkSellerVerification(sellerUserOrId) {
  const user = typeof sellerUserOrId === 'string' ? getUserById(sellerUserOrId) : sellerUserOrId;
  if (!user) {
    return {
      isVerified: false,
      seller: null,
      passedCount: 0,
      totalCriteria: 5,
      criteria: {
        reviewsPositive: { passed: false, current: 0, required: 20 },
        averageRating: { passed: false, current: 0, required: 4.5 },
        totalListings: { passed: false, current: 0, required: 10 },
        profileComplete: { passed: false, missing: ['Foto Avatar', 'Lokasi', 'No. WhatsApp'] },
        accountAgeDays: { passed: false, current: 0, required: 30 }
      }
    };
  }

  const sellerId = user.id;
  const listings = getListingsBySellerId(sellerId);
  const reviews = getSellerReviews(sellerId);
  const ratingStats = getSellerRatingStats(sellerId);

  // 1. Sudah memiliki minimal 20 ulasan positif (rating >= 4)
  const positiveReviewsCount = reviews.filter((r) => r.rating >= 4).length;
  const reviewsPassed = positiveReviewsCount >= 20;

  // 2. Memiliki rating rata-rata minimal 4.5
  const avgRating = ratingStats.totalReviews > 0 ? ratingStats.averageRating : 0;
  const ratingPassed = ratingStats.totalReviews > 0 && avgRating >= 4.5;

  // 3. Telah memposting minimal 10 barang jualan
  const totalListingsCount = listings.length;
  const listingsPassed = totalListingsCount >= 10;

  // 4. Profil (Foto, Lokasi, dan No. WA) sudah lengkap
  const hasAvatar = Boolean(user.avatar && user.avatar.trim() !== '');
  const hasLocation = Boolean(user.region && user.region.trim() !== '' && user.district && user.district.trim() !== '');
  const hasPhone = Boolean(user.phone && user.phone.replace(/\D/g, '').length >= 8);
  
  const missingFields = [];
  if (!hasAvatar) missingFields.push('Foto Avatar');
  if (!hasLocation) missingFields.push('Lokasi (Kabupaten & Kecamatan)');
  if (!hasPhone) missingFields.push('No. WhatsApp Aktif');
  const profilePassed = missingFields.length === 0;

  // 5. Akun telah berusia minimal 30 hari
  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
  const now = new Date();
  const diffTime = Math.max(0, now - createdAt);
  const accountAgeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const agePassed = accountAgeDays >= 30;

  const passedList = [reviewsPassed, ratingPassed, listingsPassed, profilePassed, agePassed];
  const passedCount = passedList.filter(Boolean).length;
  const isVerified = reviewsPassed && ratingPassed && listingsPassed && profilePassed && agePassed;

  return {
    isVerified,
    seller: user,
    passedCount,
    totalCriteria: 5,
    criteria: {
      reviewsPositive: { passed: reviewsPassed, current: positiveReviewsCount, required: 20 },
      averageRating: { passed: ratingPassed, current: avgRating, required: 4.5 },
      totalListings: { passed: listingsPassed, current: totalListingsCount, required: 10 },
      profileComplete: { passed: profilePassed, missing: missingFields },
      accountAgeDays: { passed: agePassed, current: accountAgeDays, required: 30 }
    }
  };
}

export function isSellerVerified(sellerUserOrId) {
  const result = checkSellerVerification(sellerUserOrId);
  return result.isVerified;
}

// -------------------------------------------------------------
// APP & DEVELOPER REVIEWS & COMMUNITY FEEDBACK
// -------------------------------------------------------------
export const STORAGE_KEY_APP_REVIEWS = 'pusat_barkas_app_reviews';

export const DEFAULT_APP_REVIEWS = [];

export async function fetchAppReviewsFromSupabase() {
  if (!supabase) return getAppReviews();
  try {
    const { data: sbReviews, error } = await supabase
      .from('app_reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(sbReviews)) {
      // 2. Relasional/Lookup matching ke tabel public.users untuk menyinkronkan nama & lokasi terkini
      let usersMap = new Map();
      try {
        const { data: allLiveUsers } = await supabase
          .from('users')
          .select('*');

        if (allLiveUsers && Array.isArray(allLiveUsers)) {
          allLiveUsers.forEach((u) => {
            if (u.id) usersMap.set(String(u.id).toLowerCase(), u);
            if (u.email) usersMap.set(String(u.email).toLowerCase(), u);
          });
        }
      } catch (uErr) {}

      const mapped = sbReviews.map((r) => {
        const uId = r.user_id ? String(r.user_id).toLowerCase() : '';
        const liveUser = usersMap.get(uId) || getUserByReviewAuthor(r.user_id, r.user_name);
        
        let resolvedName = r.user_name || 'Pengguna';
        let resolvedLocation = r.user_location || 'Solo Raya';
        let resolvedAvatar = null;

        if (liveUser) {
          const rawStore = liveUser.store_name || liveUser.storeName;
          const rawName = liveUser.name;
          const cleanDisplayName = rawStore || rawName || resolvedName.replace(/\(.*?\)/g, '').trim();
          const rawLoc = liveUser.district || liveUser.region || resolvedLocation;
          resolvedLocation = formatDistrictTitle(rawLoc) || formatRegionTitle(rawLoc) || 'Solo Raya';
          resolvedName = `${cleanDisplayName} (${resolvedLocation})`;
          resolvedAvatar = liveUser.avatar || null;
        } else if (r.user_location && !resolvedName.includes('(')) {
          resolvedName = `${resolvedName} (${r.user_location})`;
        }

        return {
          id: r.id,
          userId: r.user_id,
          userName: resolvedName,
          userLocation: resolvedLocation,
          userAvatar: resolvedAvatar,
          rating: Number(r.rating) || 5,
          category: r.category || 'Pengalaman Pengguna',
          comment: r.review_text || '',
          review_text: r.review_text || '',
          createdAt: r.created_at,
          created_at: r.created_at
        };
      });

      window.__appReviewsCache = mapped;
      window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { reviews: mapped } }));
      return mapped;
    } else if (error) {
      console.warn('[Supabase fetchAppReviewsFromSupabase Error]', error.message || error);
    }
  } catch (err) {
    console.warn('[Supabase fetchAppReviewsFromSupabase Exception]', err);
  }
  return getAppReviews();
}

export function getAppReviews(includeHidden = false) {
  try {
    let reviews = window.__appReviewsCache || [];
    if (!Array.isArray(reviews)) reviews = [];
    if (!includeHidden) {
      reviews = reviews.filter((r) => !r.isHidden);
    }
    return reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    return [];
  }
}

export function addAppReview({ rating, category, comment }) {
  const sessionUser = getCurrentUser();
  if (!sessionUser) {
    throw new Error("Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan aplikasi.");
  }
  // Ambil data akun profil user aktif dari database/cache untuk menghindari data session usang
  const currentUser = (sessionUser.id ? getUserById(sessionUser.id) : null) || sessionUser;

  const cleanComment = (comment || '').trim();
  if (!cleanComment) {
    throw new Error("Silakan tuliskan ulasan atau masukan Anda.");
  }
  const numRating = Number(rating) || 5;

  const all = getAppReviews(true);
  
  // Ambil kata pertama dari nama lengkap pengguna (nama depan / nama panggilan)
  const rawFullName = (currentUser.name || currentUser.storeName || currentUser.store_name || 'Pengguna').trim();
  const firstName = rawFullName.split(/\s+/)[0] || 'Pengguna';
  
  // Ambil lokasi kecamatan aktif
  const rawDistrict = currentUser.district || currentUser.region || 'Solo';
  const districtTitle = formatDistrictTitle(rawDistrict) || formatRegionTitle(rawDistrict) || 'Solo';

  // Format Nama: [Nama Depan] [Kecamatan] (Contoh: "Ridho Eromoko" - tanpa nama toko & tanpa tanda kurung)
  const fullUserName = `${firstName} ${districtTitle}`.trim();
  const locationTag = districtTitle;

  const generateUuid = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const newReview = {
    id: generateUuid(),
    userId: currentUser.id,
    userName: fullUserName,
    userLocation: locationTag,
    userAvatar: currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.email || currentUser.id || reviewerDisplayName)}`,
    rating: Math.min(5, Math.max(1, numRating)),
    category: category || 'Pengalaman Pengguna',
    comment: cleanComment,
    review_text: cleanComment,
    createdAt: new Date().toISOString()
  };

  all.unshift(newReview);
  window.__appReviewsCache = all;

  window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { review: newReview } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'APP_REVIEW_ADDED', payload: newReview });
  }

  safeBroadcastToCloud('APP_REVIEW_ADDED', newReview);

  // SUPABASE SEPARATE INSERT TO app_reviews TABLE
  if (supabase) {
    const sbPayload = {
      id: newReview.id,
      user_id: currentUser.id,
      user_name: fullUserName,
      user_location: locationTag,
      rating: newReview.rating,
      category: newReview.category,
      review_text: cleanComment,
      created_at: newReview.createdAt
    };

    console.log('[Supabase App Review] Mengirim payload ulasan akun aktif ke tabel app_reviews Supabase:', sbPayload);

    // 1. Kirim langsung ke tabel fisik app_reviews
    supabase
      .from('app_reviews')
      .insert([sbPayload])
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase Error] Gagal menyimpan ulasan ke tabel app_reviews Supabase:', error.message || error, error);
        } else {
          console.log('[Supabase Success] Ulasan aplikasi berhasil disimpan ke tabel app_reviews Supabase:', data || sbPayload.id);
        }
      })
      .catch((err) => {
        console.error('[Supabase Exception] Kendala koneksi saat insert ke tabel app_reviews:', err);
      });
  }

  return newReview;
}

export async function deleteAppReview(reviewId) {
  if (supabase) {
    try {
      console.log(`[deleteAppReview] Menghapus baris ulasan dari tabel public.app_reviews di Supabase (id = "${reviewId}")...`);
      const { error } = await supabase
        .from('app_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        console.error('[deleteAppReview: Supabase Error] Gagal menghapus ulasan dari database:', error.message || error);
        throw error;
      }
      console.log('[deleteAppReview: Supabase Success] Ulasan berhasil dihapus permanen dari Supabase');
    } catch (sbErr) {
      console.error('[deleteAppReview: Supabase Exception]', sbErr);
      throw sbErr;
    }
  }

  const all = getAppReviews(true);
  const filtered = all.filter((r) => r.id !== reviewId);
  window.__appReviewsCache = filtered;

  window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { deletedId: reviewId } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'APP_REVIEW_DELETED', payload: reviewId });
  }

  safeBroadcastToCloud('APP_REVIEW_DELETED', reviewId);

  return true;
}

export function updateAppReview({ id, rating, category, comment }) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("Silakan masuk atau daftar akun terlebih dahulu.");
  }
  const all = getAppReviews(true);
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error("Ulasan tidak ditemukan.");
  }

  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
  const isOwner = all[idx].userId === currentUser.id || all[idx].userId === currentUser.email;
  if (!isOwner && !isAdmin) {
    throw new Error("Akses ditolak: Anda hanya dapat mengedit ulasan milik Anda sendiri.");
  }

  const cleanComment = (comment || '').trim();
  if (!cleanComment) {
    throw new Error("Silakan tuliskan ulasan atau masukan Anda.");
  }
  const activeUser = (currentUser.id ? getUserById(currentUser.id) : null) || currentUser;
  const rawFullName = (activeUser.name || activeUser.storeName || activeUser.store_name || 'Pengguna').trim();
  const firstName = rawFullName.split(/\s+/)[0] || 'Pengguna';
  const rawDistrict = activeUser.district || activeUser.region || 'Solo';
  const districtTitle = formatDistrictTitle(rawDistrict) || formatRegionTitle(rawDistrict) || 'Solo';
  const fullUserName = `${firstName} ${districtTitle}`.trim();
  const locationTag = districtTitle;

  all[idx] = {
    ...all[idx],
    userName: fullUserName,
    userLocation: locationTag,
    userAvatar: activeUser.avatar || all[idx].userAvatar,
    rating: Math.min(5, Math.max(1, numRating)),
    category: category || all[idx].category,
    comment: cleanComment,
    review_text: cleanComment,
    updatedAt: new Date().toISOString()
  };

  window.__appReviewsCache = all;

  window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { review: all[idx] } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'APP_REVIEW_UPDATED', payload: all[idx] });
  }

  safeBroadcastToCloud('APP_REVIEW_UPDATED', all[idx]);

  if (supabase) {
    supabase.from('app_reviews').update({
      user_name: fullUserName,
      user_location: locationTag,
      rating: all[idx].rating,
      category: all[idx].category,
      review_text: cleanComment
    }).eq('id', id).then(({ error }) => {
      if (error) console.error('[Supabase Error] Gagal update ulasan di app_reviews:', error.message);
    }).catch(() => {});
  }

  return all[idx];
}

export function toggleHideAppReview(reviewId) {
  const all = getAppReviews(true);
  const idx = all.findIndex((r) => r.id === reviewId);
  if (idx === -1) return null;

  all[idx].isHidden = !all[idx].isHidden;
  window.__appReviewsCache = all;

  window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { review: all[idx] } }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'APP_REVIEW_UPDATED', payload: all[idx] });
  }

  safeBroadcastToCloud('APP_REVIEW_UPDATED', all[idx]);
  return all[idx];
}

export function getAppRatingStats() {
  const reviews = getAppReviews(false);
  if (reviews.length === 0) {
    return {
      averageRating: 5.0,
      totalReviews: 0,
      ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }

  const totalReviews = reviews.length;
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;

  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    ratingCounts[star] = (ratingCounts[star] || 0) + 1;
    sum += r.rating;
  });

  const averageRating = Number((sum / totalReviews).toFixed(1));

  return {
    averageRating,
    totalReviews,
    ratingCounts
  };
}

