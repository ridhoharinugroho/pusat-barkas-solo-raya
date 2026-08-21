/**
 * Pusat Barkas Solo Raya - Persistent Storage & Cloud Real-Time Engine
 * Synchronizes across PC, Laptop, and Mobile/HP via Cloud Real-time PubSub
 */

import { SAMPLE_LISTINGS } from '../data/sampleListings.js';
import { getCurrentUser } from './auth.js';
import { initCloudRealtimeSync, broadcastToCloud } from './cloudSync.js';

const STORAGE_KEY_LISTINGS = 'pusat_barkas_listings';
const STORAGE_KEY_FAVORITES = 'pusat_barkas_favorites';
const STORAGE_KEY_SETTINGS = 'pusat_barkas_site_settings';
const STORAGE_KEY_TEXTS = 'pusat_barkas_custom_texts';

// Native Browser BroadcastChannel for 0ms Instant Real-Time Cross-Tab Synchronization
const realtimeChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('pusat_barkas_realtime_v2')
  : null;

// Default Constants
export const DEFAULT_SITE_SETTINGS = {
  fontFamily: 'sans',           // 'sans', 'serif', 'mono', 'poppins'
  layoutStyle: 'grid',          // 'grid', 'list'
  filterPosition: 'below_hero', // 'below_hero', 'above_hero'
  announcementText: '📢 Selamat Datang di Pusat Barkas Solo Raya! Jual Beli Aman 7 Wilayah: Solo, Karanganyar, Sukoharjo, Wonogiri, Sragen, Boyolali, Klaten.',
  showAnnouncement: true,
  updatedAt: "2026-01-01T00:00:00.000Z"
};

export const DEFAULT_CUSTOM_TEXTS = {
  // 0. Pengumuman Header Atas
  announcement_text: "📢 Selamat Datang di Pusat Barkas Solo Raya! Jual Beli Aman 7 Wilayah: Solo, Karanganyar, Sukoharjo, Wonogiri, Sragen, Boyolali, Klaten.",

  // 1. Header & Branding
  brand_name: "Pusat Barkas",
  brand_tagline: "Solo Raya",
  brand_subtagline: "7 Wilayah • Nego Langsung WA",
  search_placeholder: "Cari sepeda, HP, motor, sofa se-Solo Raya...",
  
  // 2. Banner Sambutan / Hero Section
  hero_badge: "Pusat Jual Beli Komunitas Terpercaya Solo Raya",
  hero_title: "Cari & Jual Barang Bekas di 7 Wilayah Solo Raya",
  hero_subtitle: "Temukan barkas murah berkualitas di Solo, Karanganyar, Sukoharjo, Wonogiri, Sragen, Boyolali, & Klaten. Hubungi penjual langsung lewat WhatsApp!",
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
  empty_title: "Tidak ada barang bekas ditemukan",
  empty_desc: "Coba ganti kata kunci pencarian, ubah pilihan wilayah Solo Raya, atau atur ulang filter Anda.",
  
  // 5. Footer, Syarat & Ketentuan, & Info Komunitas
  footer_title: "Pusat Barkas Solo Raya",
  footer_desc: "Platform jual beli barang bekas terpercaya berbasis komunitas untuk 7 wilayah Solo Raya. Transaksi aman, mudah, dan langsung terhubung dengan penjual via WhatsApp.",
  terms_title: "Ketentuan Transaksi & Tips COD Aman di Solo Raya",
  terms_content: "1. Selalu utamakan transaksi sistem Cash on Delivery (COD) di tempat umum yang ramai seperti Manahan, Solo Baru, atau SPBU.\n2. Periksa fisik, fungsi, dan kelengkapan barang bekas secara teliti bersama penjual sebelum melakukan pembayaran.\n3. Jangan pernah mentransfer uang muka (DP) atau biaya booking tanpa bertemu penjual dan memeriksa barang secara langsung.",
  copyright_text: "© 2026 Pusat Barkas Solo Raya - Komunitas Jual Beli Terpercaya 7 Wilayah",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
export function initializeStorage() {
  try {
    // 1. Initial Local Cache fallback
    const existingListings = localStorage.getItem(STORAGE_KEY_LISTINGS);
    if (!existingListings || JSON.parse(existingListings).length === 0) {
      localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(SAMPLE_LISTINGS));
    }

    const settings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!settings) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(DEFAULT_SITE_SETTINGS));
    }

    const texts = localStorage.getItem(STORAGE_KEY_TEXTS);
    if (!texts) {
      localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(DEFAULT_CUSTOM_TEXTS));
    }

    // 2. Setup BroadcastChannel listener for 0ms cross-tab sync
    if (realtimeChannel) {
      realtimeChannel.onmessage = (event) => {
        const msg = event.data;
        if (!msg) return;

        if (msg.type === 'SETTINGS_UPDATED') {
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(msg.payload));
          window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: msg.payload }));
        } else if (msg.type === 'TEXTS_UPDATED') {
          localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(msg.payload));
          window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: msg.payload }));
        } else if (msg.type === 'LISTINGS_UPDATED') {
          localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(msg.payload));
          window.dispatchEvent(new CustomEvent('listingsChanged', { detail: msg.payload }));
        }
      };
    }

    // 3. Initialize Worldwide Cloud Real-Time Synchronization (Syncs HP & Laptop)
    initCloudRealtimeSync(
      (cloudTexts) => {
        localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(cloudTexts));
        window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: cloudTexts }));
      },
      (cloudSettings) => {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cloudSettings));
        window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: cloudSettings }));
      },
      (cloudListings) => {
        localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(cloudListings));
        window.dispatchEvent(new CustomEvent('listingsChanged', { detail: cloudListings }));
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEXTS);
    if (!raw) return { ...DEFAULT_CUSTOM_TEXTS };
    return { ...DEFAULT_CUSTOM_TEXTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_CUSTOM_TEXTS };
  }
}

export function saveCustomTexts(newTexts) {
  const current = getCustomTexts();
  const updated = { 
    ...current, 
    ...newTexts, 
    updatedAt: new Date().toISOString() 
  };
  
  const jsonStr = JSON.stringify(updated);
  localStorage.setItem(STORAGE_KEY_TEXTS, jsonStr);
  
  // Real-time local & cross-tab broadcast
  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: updated }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'TEXTS_UPDATED', payload: updated });
  }

  // Worldwide Cloud Broadcast (Syncs to all visitor HPs in <100ms)
  broadcastToCloud('TEXTS_UPDATED', updated);
  
  return updated;
}

export function resetCustomTexts() {
  const resetObj = { 
    ...DEFAULT_CUSTOM_TEXTS, 
    updatedAt: new Date().toISOString() 
  };
  
  const jsonStr = JSON.stringify(resetObj);
  localStorage.setItem(STORAGE_KEY_TEXTS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: resetObj }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'TEXTS_UPDATED', payload: resetObj });
  }

  broadcastToCloud('TEXTS_UPDATED', resetObj);
  return resetObj;
}

// -------------------------------------------------------------
// PENGATURAN SITUS / FONT & LAYOUT (GET / SAVE)
// -------------------------------------------------------------
export function getSiteSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return DEFAULT_SITE_SETTINGS;
    return { ...DEFAULT_SITE_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function saveSiteSettings(newSettings) {
  const current = getSiteSettings();
  const updated = { 
    ...current, 
    ...newSettings, 
    updatedAt: new Date().toISOString() 
  };
  
  const jsonStr = JSON.stringify(updated);
  localStorage.setItem(STORAGE_KEY_SETTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: updated }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'SETTINGS_UPDATED', payload: updated });
  }

  // Worldwide Cloud Broadcast
  broadcastToCloud('SETTINGS_UPDATED', updated);
  
  return updated;
}

// -------------------------------------------------------------
// LISTINGS MANAGEMENT (GET / SAVE / MODERATION)
// -------------------------------------------------------------
export function getAllListings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LISTINGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(SAMPLE_LISTINGS));
      return SAMPLE_LISTINGS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return SAMPLE_LISTINGS;
  }
}

export function getPublicListings() {
  const listings = getAllListings();
  return listings.filter((l) => !l.isHidden);
}

export function getListingById(id) {
  const listings = getAllListings();
  return listings.find((item) => item.id === id) || null;
}

export function saveListing(listingData) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("Anda harus login dengan Google terlebih dahulu untuk memasang iklan.");
  }

  const listings = getAllListings();
  const newListing = {
    id: `barkas-${Date.now()}`,
    title: listingData.title.trim(),
    price: Number(listingData.price) || 0,
    category: listingData.category || 'lainnya',
    condition: listingData.condition || 'good',
    negoType: listingData.negoType || 'nego_alus',
    regionId: listingData.regionId || currentUser.region || 'solo',
    district: listingData.district || 'Banjarsari',
    codPoint: listingData.codPoint || `COD ${listingData.district || 'Solo Raya'}`,
    description: listingData.description.trim(),
    images: listingData.images && listingData.images.length > 0 ? listingData.images : [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"
    ],
    seller: {
      id: currentUser.id,
      displayName: currentUser.displayName || currentUser.googleName || 'Penjual Barkas',
      phone: currentUser.phone || '081234567890',
      email: currentUser.email,
      avatar: currentUser.avatar,
      region: currentUser.region || listingData.regionId
    },
    isSold: false,
    isHidden: false,
    views: 1,
    createdAt: new Date().toISOString()
  };

  listings.unshift(newListing);
  const jsonStr = JSON.stringify(listings);
  localStorage.setItem(STORAGE_KEY_LISTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  broadcastToCloud('LISTINGS_UPDATED', listings);
  return newListing;
}

export function updateListing(id, updatedFields) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index] = {
    ...listings[index],
    ...updatedFields,
    updatedAt: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(listings);
  localStorage.setItem(STORAGE_KEY_LISTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  broadcastToCloud('LISTINGS_UPDATED', listings);
  return listings[index];
}

export function toggleSoldStatus(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isSold = !listings[index].isSold;
  const jsonStr = JSON.stringify(listings);
  localStorage.setItem(STORAGE_KEY_LISTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  broadcastToCloud('LISTINGS_UPDATED', listings);
  return listings[index];
}

export function toggleHideListing(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isHidden = !listings[index].isHidden;
  const jsonStr = JSON.stringify(listings);
  localStorage.setItem(STORAGE_KEY_LISTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: listings }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: listings });
  }

  broadcastToCloud('LISTINGS_UPDATED', listings);
  return listings[index];
}

export function deleteListing(id) {
  const listings = getAllListings();
  const filtered = listings.filter((item) => item.id !== id);
  const jsonStr = JSON.stringify(filtered);
  localStorage.setItem(STORAGE_KEY_LISTINGS, jsonStr);
  
  window.dispatchEvent(new CustomEvent('listingsChanged', { detail: filtered }));
  if (realtimeChannel) {
    realtimeChannel.postMessage({ type: 'LISTINGS_UPDATED', payload: filtered });
  }

  broadcastToCloud('LISTINGS_UPDATED', filtered);
  return true;
}

export function incrementListingViews(id) {
  const listings = getAllListings();
  const item = listings.find((l) => l.id === id);
  if (item) {
    item.views = (item.views || 0) + 1;
    localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
  }
}

export function getMyListings(userId) {
  if (!userId) return [];
  const listings = getAllListings();
  return listings.filter((item) => item.seller && item.seller.id === userId);
}

// Favorites
export function getFavoriteIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function toggleFavorite(listingId) {
  let favs = getFavoriteIds();
  const exists = favs.includes(listingId);
  if (exists) {
    favs = favs.filter((id) => id !== listingId);
  } else {
    favs.push(listingId);
  }
  localStorage.setItem(STORAGE_KEY_FAVORITES, JSON.stringify(favs));
  return !exists;
}

export function isFavorite(listingId) {
  const favs = getFavoriteIds();
  return favs.includes(listingId);
}
