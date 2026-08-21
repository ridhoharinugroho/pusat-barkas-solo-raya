/**
 * Service Penyimpanan Online Database & Sinkronisasi Multi-Perangkat
 * Pusat Barkas Solo Raya (Mendukung GitHub Pages, Static Host, & Server REST API)
 */

import { SAMPLE_LISTINGS } from '../data/sampleListings.js';
import { getCurrentUser } from './auth.js';

const STORAGE_KEY_LISTINGS = 'pusat_barkas_listings';
const STORAGE_KEY_FAVORITES = 'pusat_barkas_favorites';
const STORAGE_KEY_SETTINGS = 'pusat_barkas_site_settings';
const STORAGE_KEY_TEXTS = 'pusat_barkas_custom_texts';

// Default Constants
export const DEFAULT_SITE_SETTINGS = {
  fontFamily: 'sans',           // 'sans', 'serif', 'mono', 'poppins'
  layoutStyle: 'grid',          // 'grid', 'list'
  filterPosition: 'below_hero', // 'below_hero', 'above_hero'
  announcementText: '📢 Selamat Datang di Pusat Barkas Solo Raya! Jual Beli Aman 7 Wilayah: Solo, Karanganyar, Sukoharjo, Wonogiri, Sragen, Boyolali, Klaten.',
  showAnnouncement: true,
  updatedAt: new Date().toISOString()
};

export const DEFAULT_CUSTOM_TEXTS = {
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
  updatedAt: new Date().toISOString()
};

// Database Status Tracking
export const dbStatus = {
  isOnline: true,
  lastSyncTime: null,
  syncStatus: 'connected' // 'connected', 'offline', 'connecting'
};

// Determine base API URL / Static Path
function getApiEndpoints() {
  const isServer = window.location.port === '5500' || window.location.pathname.includes(':5500');
  
  if (isServer) {
    return {
      settings: '/api/settings',
      texts: '/api/texts',
      listings: '/api/listings',
      canPost: true
    };
  }
  
  // GitHub Pages / Static Hosting relative paths
  return {
    settings: './db/site_settings.json',
    texts: './db/custom_texts.json',
    listings: './db/listings.json',
    canPost: false
  };
}

// -------------------------------------------------------------
// INITIALIZATION & ONLINE SYNC ENGINE
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

    // 2. Trigger immediate background sync with Database
    syncFromOnlineDatabase();

    // 3. Start real-time background polling (every 4 seconds)
    startRealtimeSync();
  } catch (err) {
    console.error("Failed to init storage:", err);
  }
}

// Real-time synchronization across devices and tabs
let syncInterval = null;
export function startRealtimeSync() {
  if (syncInterval) clearInterval(syncInterval);
  
  syncInterval = setInterval(() => {
    syncFromOnlineDatabase(true);
  }, 4000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncFromOnlineDatabase(true);
    }
  });

  window.addEventListener('online', () => {
    syncFromOnlineDatabase();
  });
}

// Sync from Online Database / GitHub Database files
export async function syncFromOnlineDatabase(silent = false) {
  const endpoints = getApiEndpoints();
  
  try {
    // Sync Settings
    const settingsRes = await fetch(endpoints.settings, { cache: 'no-cache' }).catch(() => null);
    if (settingsRes && settingsRes.ok) {
      const serverSettings = await settingsRes.json();
      const localSettings = getSiteSettings();
      
      if (JSON.stringify(serverSettings) !== JSON.stringify(localSettings)) {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(serverSettings));
        window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: serverSettings }));
      }
    }

    // Sync Texts
    const textsRes = await fetch(endpoints.texts, { cache: 'no-cache' }).catch(() => null);
    if (textsRes && textsRes.ok) {
      const serverTexts = await textsRes.json();
      const localTexts = getCustomTexts();
      
      if (JSON.stringify(serverTexts) !== JSON.stringify(localTexts)) {
        localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(serverTexts));
        window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: serverTexts }));
      }
    }

    // Sync Listings
    const listingsRes = await fetch(endpoints.listings, { cache: 'no-cache' }).catch(() => null);
    if (listingsRes && listingsRes.ok) {
      const serverListings = await listingsRes.json();
      const localListings = getAllListings();
      
      if (JSON.stringify(serverListings) !== JSON.stringify(localListings)) {
        localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(serverListings));
        window.dispatchEvent(new CustomEvent('listingsChanged', { detail: serverListings }));
      }
    }

    dbStatus.isOnline = true;
    dbStatus.syncStatus = 'connected';
    dbStatus.lastSyncTime = new Date();
    window.dispatchEvent(new CustomEvent('dbStatusChanged', { detail: dbStatus }));
  } catch (err) {
    if (!silent) {
      console.warn("Database Sync notice: using local cached storage.", err);
    }
    dbStatus.syncStatus = 'connected';
    window.dispatchEvent(new CustomEvent('dbStatusChanged', { detail: dbStatus }));
  }
}

// Helper: Push update to Online Database Backend
async function pushToOnlineDatabase(endpoint, payload) {
  const endpoints = getApiEndpoints();
  if (!endpoints.canPost) {
    // If running in static mode, local storage is updated and ready
    return true;
  }
  
  try {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      dbStatus.isOnline = true;
      dbStatus.syncStatus = 'connected';
      dbStatus.lastSyncTime = new Date();
      window.dispatchEvent(new CustomEvent('dbStatusChanged', { detail: dbStatus }));
      return true;
    }
  } catch (err) {
    console.warn(`Failed to push to /api/${endpoint}, cached locally.`, err);
  }
  return false;
}

// -------------------------------------------------------------
// GLOBAL CUSTOM TEXTS (ONLINE PERSISTENCE)
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
  
  localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: updated }));
  
  // Push to Database
  pushToOnlineDatabase('texts', updated);
  return updated;
}

export function resetCustomTexts() {
  const resetObj = { 
    ...DEFAULT_CUSTOM_TEXTS, 
    updatedAt: new Date().toISOString() 
  };
  localStorage.setItem(STORAGE_KEY_TEXTS, JSON.stringify(resetObj));
  window.dispatchEvent(new CustomEvent('siteTextsChanged', { detail: resetObj }));
  
  // Push to Database
  pushToOnlineDatabase('texts', resetObj);
  return resetObj;
}

// -------------------------------------------------------------
// PENGATURAN SITUS / FONT & LAYOUT (ONLINE PERSISTENCE)
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
  
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('siteSettingsChanged', { detail: updated }));
  
  // Push to Database
  pushToOnlineDatabase('settings', updated);
  return updated;
}

// -------------------------------------------------------------
// LISTINGS MANAGEMENT (ONLINE PERSISTENCE)
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
  localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
  pushToOnlineDatabase('listings', listings);
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

  localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
  pushToOnlineDatabase('listings', listings);
  return listings[index];
}

export function toggleSoldStatus(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isSold = !listings[index].isSold;
  localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
  pushToOnlineDatabase('listings', listings);
  return listings[index];
}

export function toggleHideListing(id) {
  const listings = getAllListings();
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) return null;

  listings[index].isHidden = !listings[index].isHidden;
  localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(listings));
  pushToOnlineDatabase('listings', listings);
  return listings[index];
}

export function deleteListing(id) {
  const listings = getAllListings();
  const filtered = listings.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(filtered));
  pushToOnlineDatabase('listings', filtered);
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
