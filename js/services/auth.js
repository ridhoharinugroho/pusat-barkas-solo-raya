/**
 * Service Autentikasi Pengguna & Penjual Pusat Jual Beli Solo Raya
 * Login & Registrasi dengan No. WA / Email / Nama Toko + Password
 * Reset Password via Email & Penyimpanan Sesi Persisten
 * Murni sinkronisasi dengan tabel 'users' Supabase (kolom name & store_name)
 */

import { broadcastToCloud } from './cloudSync.js';
import { sendWelcomeRegistrationEmail, sendPasswordResetEmail } from './emailService.js';
import { supabase } from '../lib/supabase.js';
import { sbUploadAvatar, sbUpdateUserAvatar, sbDeleteAvatar, extractAvatarFilePath } from './supabaseDB.js';

// Safe broadcast helper to prevent unhandled reference or network errors
function safeBroadcastToCloud(type, data) {
  try {
    if (typeof broadcastToCloud === 'function') {
      broadcastToCloud(type, data).catch((e) => console.warn('[Auth CloudSync Warning]', e));
    }
  } catch (e) {
    console.warn('[Auth CloudSync Exception]', e);
  }
}

const STORAGE_KEY_USER = 'pusat_barkas_user';
const STORAGE_KEY_REGISTERED_USERS = 'pusat_barkas_registered_users';
const listeners = [];

// Akun Penjual Awal (Default Seeded Users / Akun Demo Peraga)
const DEFAULT_REGISTERED_USERS = [
  {
    id: "user-102",
    name: "Joko Supriyanto",
    storeName: "Toko Pak Joko",
    email: "joko.kra@gmail.com",
    phone: "085725012345",
    region: "karanganyar",
    district: "Jaten",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    bio: "Pusat perabot rumah tangga & elektronik seken berkualitas Karanganyar.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-07-05T09:30:00.000Z",
    isDemo: true
  },
  {
    id: "user-103",
    name: "Rian Kurniawan",
    storeName: "Rian Gadget Kartasura",
    email: "rian.gadget@gmail.com",
    phone: "089678123456",
    region: "sukoharjo",
    district: "Kartasura",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    bio: "Thrift & gadget bekas garansi personal area UMS Kartasura & Solo Baru.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-07-10T11:15:00.000Z",
    isDemo: true
  },
  {
    id: "user-104",
    name: "Siti Aisyah",
    storeName: "Aisyah's Crafts Solo",
    email: "aisyah.crafts@example.com",
    phone: "081234567890",
    region: "solo",
    district: "Mojosongo",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    bio: "Handmade crafts, artwork, dan souvenir khas Solo. Fast WA response.",
    status: "active",
    deletedAt: null,
    createdAt: "2026-08-25T09:00:00.000Z",
    isDemo: true
  },
  {
    id: "user-1787309560138",
    name: "Ridho Hari Nugroho",
    storeName: "Zamir Shop",
    email: "ridho.harinugroho@gmail.com",
    phone: "081251018765",
    region: "karanganyar",
    district: "Jaten",
    password: "Semangat.45",
    avatar: null,
    bio: "Dodol Opo Wae",
    status: "active",
    deletedAt: null,
    createdAt: "2026-08-27T10:31:51.688667+00:00",
    isDemo: false
  }
];
export { DEFAULT_REGISTERED_USERS };

export function isDemoUser(userOrId) {
  if (!userOrId) return false;
  const id = typeof userOrId === 'string' ? userOrId : (userOrId.id || userOrId.sellerId || '');
  if (typeof userOrId === 'object' && userOrId.isDemo) return true;
  if (id && (id === 'user-102' || id === 'user-103' || id === 'user-104' || id === 'user-105' || id === 'user-106' || id === 'user-107')) {
    return true;
  }
  const email = typeof userOrId === 'object' ? (userOrId.email || '') : '';
  if (email && (email.includes('joko.kra') || email.includes('rian.gadget') || email.includes('@example.com'))) {
    return true;
  }
  return false;
}

/**
 * Helper Format Tanggal Bergabung yang Aman & Universal
 * Menangani string bahasa Indonesia, ISO timestamp, dan fallback bersih
 * @param {string|Date|number|null} rawDate
 * @returns {string} Contoh: "27 Agustus 2026", "10 Juli 2026"
 */
export function formatJoinedDate(rawDate) {
  if (!rawDate) return '01 Agustus 2026';
  const str = String(rawDate).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return '01 Agustus 2026';

  // 1. Jika string sudah berformat teks Indonesia (misal: "5 Juli 2026", "25 Agustus 2026", "27 Agu 2026")
  const indoMonths = /(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)/i;
  if (indoMonths.test(str) && /\d{4}/.test(str)) {
    return str;
  }

  // 2. Parse menggunakan Date untuk ISO timestamp / string tanggal standar
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (e) {}

  return str;
}
window.formatJoinedDate = formatJoinedDate;

let inMemoryRegisteredUsers = [...DEFAULT_REGISTERED_USERS];
let inMemoryActiveUser = null;
const SESSION_KEY_USER_ID = 'solosatset_session_user_id';
const SESSION_KEY_USER_DATA = 'solosatset_session_user_data';
let pendingResetState = null;

/**
 * Inisialisasi dan Dapatkan Daftar Seluruh Akun Terdaftar (Murni In-Memory & Cloud)
 */
export function getRegisteredUsers() {
  return inMemoryRegisteredUsers;
}

/**
 * Sync registered users array directly to Supabase.
 * Uses upsert with primary key 'id' (or email if id missing).
 */
export async function syncRegisteredUsersToSupabase(users) {
  if (!supabase) return;
  if (!Array.isArray(users) || users.length === 0) return;
  try {
    const payload = users.map(u => {
      const row = {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        avatar: u.avatar || null
      };
      if (u.password) row.password = u.password;
      return row;
    });

    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('[Supabase syncRegisteredUsers] Upsert notice:', error.message);
    } else {
      inMemoryRegisteredUsers = users;
      safeBroadcastToCloud('USERS_UPDATED', inMemoryRegisteredUsers);
    }
  } catch (e) {
    console.warn('[Supabase syncRegisteredUsers] Exception:', e);
  }
}



// Deprecated: saveRegisteredUsers removed. Use syncRegisteredUsersToSupabase instead.

/**
 * Sinkronisasi Akun Terdaftar dari Seluruh Sumber
 */
export async function syncUsersFromCloud() {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const cloudUsers = await res.json();
      if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        const current = getRegisteredUsers();
        let merged = [...current];
        cloudUsers.forEach((cu) => {
          const idx = merged.findIndex((u) => u.id === cu.id || (u.email && u.email.toLowerCase() === (cu.email || '').toLowerCase()));
          if (idx === -1) {
            merged.push(cu);
          } else {
            merged[idx] = { ...merged[idx], ...cu };
          }
        });
        window.__registeredUsers = merged;
        return merged;
      }
    }
  } catch (e) {}

  return getRegisteredUsers();
}

/**
 * Membersihkan dan menggabungkan data user duplikat di tabel Supabase users berbasis Email
 */
export async function cleanupAndDeduplicateUsers() {
  if (!supabase) return;

  try {
    const { data: allSbUsers, error } = await supabase.from('users').select('*');
    if (error || !Array.isArray(allSbUsers) || allSbUsers.length === 0) return;

    // Kelompokkan row berdasarkan normalized email
    const grouped = {};
    allSbUsers.forEach((u) => {
      const key = (u.email && u.email.trim()) 
        ? u.email.trim().toLowerCase() 
        : u.id;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(u);
    });

    for (const key in grouped) {
      const rows = grouped[key];
      if (rows.length > 1) {
        console.log(`[Supabase Deduplication] Ditemukan ${rows.length} duplikasi untuk akun "${key}". Menggabungkan ke satu data profil...`);

        // Pilih canonical record: dahulukan ID tetap (user-1787309560138, user-102, user-103, user-104) atau data terlengkap
        let canonical = rows.find(r => r.id === 'user-1787309560138' || r.id === 'user-102' || r.id === 'user-103' || r.id === 'user-104') || rows[0];

        // Gabungkan seluruh data agar tidak ada informasi yang hilang
        rows.forEach((r) => {
          if (!canonical.name && r.name) canonical.name = r.name;
          if (!canonical.store_name && r.store_name) canonical.store_name = r.store_name;
          if (!canonical.phone && r.phone) canonical.phone = r.phone;
          if (!canonical.region && r.region) canonical.region = r.region;
          if (!canonical.district && r.district) canonical.district = r.district;
          if (!canonical.bio && r.bio) canonical.bio = r.bio;
          if (!canonical.avatar && r.avatar) canonical.avatar = r.avatar;
          if (!canonical.password && r.password) canonical.password = r.password;
        });

        // Hapus baris duplikat lain dari Supabase
        const duplicateIds = rows.filter(r => r.id !== canonical.id).map(r => r.id);
        if (duplicateIds.length > 0) {
          try {
            await supabase.from('users').delete().in('id', duplicateIds);
          } catch (e) {}
        }

        // Upsert kembali data kanonikal
        await supabase.from('users').upsert(canonical, { onConflict: 'email' });
      }
    }

    // Bersihkan spesifik akun Danang Solo Manahan & duplikat lama dari Supabase
    try {
      await supabase.from('users').delete().or('id.eq.user-101,email.eq.danang.solo@gmail.com,name.ilike.%Danang%,store_name.ilike.%Danang%');
      await supabase.from('listings').delete().or('seller_id.eq.user-101,seller_name.ilike.%Danang%');
      await supabase.from('reviews').delete().or('seller_id.eq.user-101,comment.ilike.%Danang%');
      await supabase.from('users').delete().eq('id', 'user-ridho');
      await supabase.from('users').delete().eq('email', 'ridho.merged.unused@example.com');
    } catch (e) {}
  } catch (err) {
    console.warn('[Supabase Deduplication Exception]', err);
  }
}

/**
 * Fungsi Pembersihan Otomatis Cache & Sesi Lokal Lama dari Akun Demo
 */
export function purgeLegacyDemoCache() {
  if (typeof window === 'undefined') return;
  try {
    const demoUserIds = ['user-102', 'user-103', 'user-104', 'user-105', 'user-106', 'user-107', 'user-101', 'user-ridho'];
    
    // Periksa dan bersihkan sessionStorage jika tersimpan demo user usang
    const sessionData = sessionStorage.getItem(SESSION_KEY_USER_DATA);
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData);
        if (parsed && demoUserIds.includes(parsed.id)) {
          console.log('[Auth Cache Clean] Menghapus data sesi demo lokal:', parsed.id);
          sessionStorage.removeItem(SESSION_KEY_USER_DATA);
          sessionStorage.removeItem(SESSION_KEY_USER_ID);
          inMemoryActiveUser = null;
        }
      } catch (e) {}
    }

    // Bersihkan localStorage legacy jika ada
    ['pusat_barkas_user', 'pusat_barkas_registered_users', 'barkas_user_session'].forEach((key) => {
      try { localStorage.removeItem(key); } catch (e) {}
    });
  } catch (err) {
    console.warn('[purgeLegacyDemoCache Exception]', err);
  }
}

// Jalankan pembersihan saat modul auth di-load
purgeLegacyDemoCache();

/**
 * Seeding data dinonaktifkan permanen untuk melindungi data bersih yang sudah ada di Supabase
 */
export async function seedUsersToSupabase() {
  // SEEDING DINONAKTIFKAN: Supabase adalah Single Source of Truth
  console.log('[Supabase Seeding] Seeding otomatis dinonaktifkan. Data di tabel users Supabase terlindungi.');
  return;
}

/**
 * Simpan avatar user secara langsung dan permanen ke Supabase Database & Sesi
 * Dipanggil segera setelah file berhasil diunggah ke Storage bucket 'avatars'
 * @param {string|object} userOrId - User object atau user ID
 * @param {string|null} avatarUrl - URL publik Supabase Storage
 */
export async function saveUserAvatarDirectly(userOrId, avatarUrl) {
  const current = getCurrentUser();
  const targetUser = typeof userOrId === 'object' && userOrId ? userOrId : current;
  const targetId = typeof userOrId === 'string' ? userOrId : (targetUser?.id || current?.id);
  const targetEmail = targetUser?.email || current?.email;

  if (!targetId && !targetEmail) {
    throw new Error('Pengguna tidak ditemukan untuk menyimpan avatar.');
  }

  const cleanAvatar = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim() !== '' ? avatarUrl.trim() : null;

  // 1. Simpan langsung dan terkonfirmasi ke database Supabase
  if (supabase) {
    try {
      const validEmail = targetEmail && typeof targetEmail === 'string' && targetEmail.trim() !== '' && targetEmail.includes('@') ? targetEmail.trim().toLowerCase() : null;

      if (targetId) {
        const { error: e1 } = await supabase
          .from('users')
          .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
          .eq('id', targetId);
        
        if (e1 && validEmail) {
          await supabase
            .from('users')
            .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
            .eq('email', validEmail);
        }
      } else if (validEmail) {
        await supabase
          .from('users')
          .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
          .eq('email', validEmail);
      }
      console.log(`✅ [saveUserAvatarDirectly] Avatar user "${targetId || validEmail}" berhasil disimpan permanen ke database Supabase:`, cleanAvatar);
    } catch (sbErr) {
      console.warn('[saveUserAvatarDirectly DB Warning]:', sbErr.message || sbErr);
    }
  }

  // 2. Perbarui daftar akun terdaftar di in-memory
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => (targetId && u.id === targetId) || (targetEmail && u.email && u.email.toLowerCase() === targetEmail.toLowerCase()));
  if (idx !== -1) {
    users[idx].avatar = cleanAvatar;
    syncRegisteredUsersToSupabase(users);
  }

  // 3. Perbarui sesi pengguna aktif
  if (current && ((targetId && current.id === targetId) || (targetEmail && current.email && current.email.toLowerCase() === targetEmail.toLowerCase()))) {
    current.avatar = cleanAvatar;
    setCurrentUser(current);
  }

  return { success: true, avatar: cleanAvatar };
}

/**
 * Tarik data profil terbaru pengguna aktif langsung dari tabel users Supabase (Single Source of Truth)
 */
export async function fetchFreshCurrentUserFromSupabase() {
  if (!supabase) return getCurrentUser();
  const current = getCurrentUser();
  if (!current || (!current.id && !current.email)) return null;

  try {
    let query = supabase.from('users').select('*');
    if (current.email && current.id) {
      query = query.or(`id.eq.${current.id},email.eq.${current.email}`);
    } else if (current.email) {
      query = query.eq('email', current.email);
    } else {
      query = query.eq('id', current.id);
    }

    const { data: sbUser, error } = await query.maybeSingle();
    if (!error && sbUser) {
      const resolvedAvatar = (sbUser.avatar !== undefined) ? sbUser.avatar : current.avatar;

      const freshCurrentUser = {
        ...current,
        id: sbUser.id || current.id,
        name: sbUser.name || current.name,
        storeName: sbUser.store_name || current.storeName || sbUser.name,
        email: sbUser.email || current.email,
        phone: sbUser.phone !== undefined ? sbUser.phone : current.phone,
        region: sbUser.region || current.region,
        district: sbUser.district || current.district,
        avatar: resolvedAvatar,
        bio: sbUser.bio !== undefined ? sbUser.bio : current.bio,
        password: sbUser.password || current.password,
        isDemo: sbUser.is_demo !== undefined ? sbUser.is_demo : current.isDemo,
        status: sbUser.status || current.status || 'active',
        createdAt: sbUser.created_at || current.createdAt
      };

      const hasChanged = 
        current.id !== freshCurrentUser.id ||
        current.name !== freshCurrentUser.name ||
        current.storeName !== freshCurrentUser.storeName ||
        current.email !== freshCurrentUser.email ||
        current.phone !== freshCurrentUser.phone ||
        current.region !== freshCurrentUser.region ||
        current.district !== freshCurrentUser.district ||
        current.avatar !== freshCurrentUser.avatar ||
        current.bio !== freshCurrentUser.bio ||
        current.password !== freshCurrentUser.password;

      if (hasChanged) {
        setCurrentUser(freshCurrentUser);
      }
      return freshCurrentUser;
    }
  } catch (e) {
    console.warn('[fetchFreshCurrentUserFromSupabase]', e);
  }
  return current;
}

/**
 * Auto-Sync saat aplikasi dibuka di perangkat mana pun (HP atau PC):
 * 1. Seed akun bawaan yang belum ada di Supabase
 * 2. Tarik dan merge seluruh akun dari Supabase / cloud ke memori lokal & perbarui profil aktif
 */
export async function syncAllUsersToCloudOnStartup() {
  try {
    // 1. Eksekusi seeding aman ke Supabase jika tabel di database Supabase masih kosong
    await seedUsersToSupabase();

    // 2. Tarik akun terbaru murni langsung dari tabel users Supabase (Single Source of Truth)
    if (supabase) {
      try {
        const { data: sbUsers, error } = await supabase.from('users').select('*');
        if (!error && Array.isArray(sbUsers) && sbUsers.length > 0) {
          const validSbUsers = sbUsers.filter(u => u.id !== 'user-ridho' && !(u.email && u.email.includes('unused')));
          const mappedSbUsers = validSbUsers.map((sbU) => ({
            id: sbU.id,
            name: sbU.name,
            storeName: sbU.store_name || sbU.name,
            email: sbU.email,
            phone: sbU.phone,
            region: sbU.region,
            district: sbU.district,
            password: sbU.password,
            avatar: sbU.avatar !== undefined ? sbU.avatar : null,
            bio: sbU.bio,
            status: sbU.status || 'active',
            deletedAt: sbU.deleted_at || null,
            isDemo: sbU.is_demo,
            createdAt: sbU.created_at
          }));

          // Simpan data murni Supabase ke memori tanpa mencampur dengan cache lama
          window.__registeredUsers = mappedSbUsers;
          window.dispatchEvent(new CustomEvent('registeredUsersChanged', { detail: mappedSbUsers }));
          console.log('[Supabase Users Sync] Berhasil menyinkronkan', mappedSbUsers.length, 'akun dari database Supabase sebagai sumber kebenaran tunggal.');

          // Perbarui data pengguna aktif yang tersimpan di memori
          const curObj = window.__currentUser;
          if (curObj) {
            try {
              const curCleanPhone = (curObj.phone || '').replace(/\D/g, '');
              const matchedSbUser = mappedSbUsers.find((u) => 
                (curObj.email && u.email && u.email.toLowerCase() === curObj.email.toLowerCase()) ||
                (curCleanPhone && u.phone && u.phone.replace(/\D/g, '') === curCleanPhone) ||
                (curObj.storeName && u.storeName && u.storeName.toLowerCase() === curObj.storeName.toLowerCase()) ||
                (curObj.id === 'user-ridho' && (u.id === 'user-1787309560138' || u.storeName === 'Zamir Shop')) ||
                u.id === curObj.id
              );
              if (matchedSbUser) {
                const freshCurrentUser = {
                  ...curObj,
                  id: matchedSbUser.id || curObj.id,
                  name: matchedSbUser.name || curObj.name,
                  storeName: matchedSbUser.storeName || curObj.storeName || matchedSbUser.name,
                  email: matchedSbUser.email || curObj.email,
                  phone: matchedSbUser.phone !== undefined ? matchedSbUser.phone : curObj.phone,
                  region: matchedSbUser.region || curObj.region,
                  district: matchedSbUser.district || curObj.district,
                  avatar: (matchedSbUser.avatar !== undefined) ? matchedSbUser.avatar : curObj.avatar,
                  bio: matchedSbUser.bio !== undefined ? matchedSbUser.bio : curObj.bio,
                  password: matchedSbUser.password || curObj.password,
                  isDemo: matchedSbUser.isDemo !== undefined ? matchedSbUser.isDemo : curObj.isDemo,
                  status: matchedSbUser.status || curObj.status || 'active'
                };
                window.__currentUser = freshCurrentUser;

                // Sinkronkan seller.id pada etalase memori agar konsisten dengan ID Supabase
                try {
                  const parsedListings = window.__listingsCache;
                  if (parsedListings && Array.isArray(parsedListings)) {
                    let modified = false;
                    parsedListings.forEach((item) => {
                      if (item && item.seller) {
                        const sPhone = (item.seller.phone || '').replace(/\D/g, '');
                        const sName = (item.seller.storeName || item.seller.name || '').toLowerCase();
                        if (item.seller.id === curObj.id || (curCleanPhone && sPhone === curCleanPhone) || (curObj.storeName && sName === curObj.storeName.toLowerCase())) {
                          item.seller.id = freshCurrentUser.id;
                          item.seller.storeName = freshCurrentUser.storeName;
                          item.seller_id = freshCurrentUser.id;
                          modified = true;
                        }
                      }
                    });
                    if (modified) {
                      window.__listingsCache = parsedListings;
                    }
                  }
                } catch (listErr) {}

                notifySubscribers();
                window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: freshCurrentUser }));
              }
            } catch (e) {}
          }
        }
      } catch (sbFetchErr) {
        console.warn('[Supabase Users Sync]', sbFetchErr);
      }
    }
  } catch (e) {
    console.warn("Startup user sync notice:", e);
  }
}

/**
 * Cari Akun berdasarkan No. WA, Email, Nama Toko, atau Nama Lengkap
 */
export function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const rawId = identifier.toString().trim();
  const cleanId = rawId.toLowerCase();
  const cleanPhone = rawId.replace(/\D/g, '');
  const users = getRegisteredUsers();

  const stripPrefix = (numStr) => numStr.replace(/^0+/, '').replace(/^62+/, '');
  const coreInputPhone = stripPrefix(cleanPhone);

  return users.find((u) => {
    if (!u) return false;
    
    // 1. Cek Email
    const emailMatch = u.email && u.email.toString().trim().toLowerCase() === cleanId;
    if (emailMatch) return true;

    // 2. Cek Nama Toko
    const storeMatch = u.storeName && u.storeName.toString().trim().toLowerCase() === cleanId;
    if (storeMatch) return true;

    // 3. Cek Nama Lengkap Penjual
    const nameMatch = u.name && u.name.toString().trim().toLowerCase() === cleanId;
    if (nameMatch) return true;

    // 4. Cek Nomor WhatsApp / Telepon
    if (u.phone && cleanPhone.length >= 7) {
      const uPhoneDigits = u.phone.toString().replace(/\D/g, '');
      const coreUPhone = stripPrefix(uPhoneDigits);

      if (coreInputPhone.length >= 6 && coreUPhone.length >= 6 && coreInputPhone === coreUPhone) {
        return true;
      }
      if (uPhoneDigits === cleanPhone || uPhoneDigits.endsWith(cleanPhone) || cleanPhone.endsWith(uPhoneDigits)) {
        return true;
      }
    }

    return false;
  }) || null;
}

export function setCurrentUser(user) {
  inMemoryActiveUser = user;
  try {
    if (user) {
      sessionStorage.setItem(SESSION_KEY_USER_DATA, JSON.stringify(user));
      sessionStorage.setItem(SESSION_KEY_USER_ID, user.id);
    } else {
      sessionStorage.removeItem(SESSION_KEY_USER_DATA);
      sessionStorage.removeItem(SESSION_KEY_USER_ID);
    }
  } catch (e) {}
  notifySubscribers();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: user }));
  }
}

/**
 * Dapatkan Pengguna yang Sedang Login (In-Memory & Session-based dengan dynamic fallback)
 */
export function getCurrentUser() {
  if (inMemoryActiveUser && inMemoryActiveUser.id && inMemoryActiveUser.id !== 'user-101') {
    return inMemoryActiveUser;
  }
  try {
    const sessionRaw = sessionStorage.getItem(SESSION_KEY_USER_DATA);
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed && parsed.id && parsed.id !== 'user-101') {
        inMemoryActiveUser = parsed;
        return inMemoryActiveUser;
      }
    }
  } catch (e) {}

  // Fallback dinamis akun aktif utama (Ridho Hari Nugroho / Zamir Shop)
  const defaultUser = DEFAULT_REGISTERED_USERS.find(u => u.id === 'user-1787309560138');
  if (defaultUser) {
    inMemoryActiveUser = { ...defaultUser };
    return inMemoryActiveUser;
  }
  return null;
}

export function isUserLoggedIn() {
  return getCurrentUser() !== null;
}

export function subscribeAuth(callback) {
  listeners.push(callback);
  callback(getCurrentUser());
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

function notifySubscribers() {
  const user = getCurrentUser();
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.error(e);
    }
  });
}

// Real-time multi-tab session sync for Desktop browsers
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_USER || e.key === STORAGE_KEY_REGISTERED_USERS) {
      notifySubscribers();
    }
  });
}

/**
 * 1. LOGIN PENGGUNA (No. WA / Email / Nama Toko + Password)
 * Murni query dari tabel 'users' Supabase: supabase.from('users').select('*')
 * Memeriksa status akun (menolak jika 'deleted' atau 'suspended')
 */
export async function loginUser(identifier, password) {
  if (!identifier || identifier.trim() === '') {
    throw new Error("Nomor WhatsApp, Email, atau Nama Toko harus diisi.");
  }
  if (!password || password.trim() === '') {
    throw new Error("Password harus diisi.");
  }

  const cleanIdent = identifier.trim();
  const cleanLower = cleanIdent.toLowerCase();
  const cleanDigits = cleanIdent.replace(/\D/g, '');
  const cleanPass = password.trim();

  let user = null;

  // 1. Query murni ke Supabase untuk memastikan data paling akurat dan sinkron
  if (supabase) {
    try {
      const { data: sbUsers, error } = await supabase.from('users').select('*');
      if (!error && Array.isArray(sbUsers) && sbUsers.length > 0) {
        const found = sbUsers.find(u => {
          if (u.email && u.email.toLowerCase() === cleanLower) return true;
          if (u.name && u.name.toLowerCase() === cleanLower) return true;
          if (u.store_name && u.store_name.toLowerCase() === cleanLower) return true;
          if (u.phone && cleanDigits.length >= 7) {
            const uDigits = u.phone.replace(/\D/g, '');
            if (uDigits === cleanDigits || uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits)) return true;
          }
          return false;
        });

        if (found) {
          user = {
            id: found.id,
            name: found.name,
            storeName: found.store_name || found.name,
            email: found.email,
            phone: found.phone,
            region: found.region,
            district: found.district,
            password: found.password,
            avatar: found.avatar,
            bio: found.bio,
            status: found.status || 'active',
            deletedAt: found.deleted_at || null,
            isDemo: found.is_demo,
            createdAt: found.created_at
          };

          // Sinkronkan ke daftar akun lokal
          const regUsers = getRegisteredUsers();
          const existIdx = regUsers.findIndex(u => 
            u.id === user.id || 
            (user.email && u.email && u.email.toLowerCase() === user.email.toLowerCase())
          );
          if (existIdx === -1) {
            regUsers.push(user);
          } else {
            regUsers[existIdx] = { ...regUsers[existIdx], ...user };
          }
          syncRegisteredUsersToSupabase(regUsers);
        }
      }
    } catch (e) {
      console.warn('[Supabase Login Query Notice]', e);
    }
  }

  // 2. Jika belum ditemukan di Supabase, cari di memori lokal / server sync
  if (!user) {
    user = findUserByIdentifier(cleanIdent);
  }

  if (!user) {
    await syncUsersFromCloud();
    user = findUserByIdentifier(cleanIdent);
  }

  if (!user) {
    throw new Error(`Akun "${cleanIdent}" tidak ditemukan. Pastikan No. WA, Email, atau Nama Toko sesuai saat mendaftar di HP/Laptop, atau silakan Daftar akun baru.`);
  }

  // 3. Verifikasi Status Akun (Tolak jika akun telah dihapus / dinonaktifkan)
  const accStatus = (user.status || 'active').toLowerCase();
  if (accStatus === 'deleted' || user.deletedAt || user.deleted_at) {
    throw new Error(`Akun "${cleanIdent}" telah dinonaktifkan atau dihapus. Silakan daftar ulang dengan email tersebut untuk mengaktifkan kembali (reaktivasi) akun Anda.`);
  }
  if (accStatus === 'suspended') {
    throw new Error(`Akun "${cleanIdent}" sedang ditangguhkan sementara oleh Admin Pusat Jual Beli Solo Raya.`);
  }

  if (user.password !== password && user.password !== cleanPass) {
    throw new Error("Password yang Anda masukkan salah. Silakan periksa huruf besar/kecil atau gunakan fitur Lupa Password.");
  }

  const sessionUser = {
    ...user,
    status: accStatus,
    storeName: user.storeName || user.name,
    loggedInAt: new Date().toISOString()
  };

  setCurrentUser(sessionUser);
  return sessionUser;
}

/**
 * 2. REGISTRASI AKUN BARU
 * (Nama, Nama Toko, No. WA, Email, Kabupaten, Kecamatan, Password)
 * Mendukung Reaktivasi Otomatis jika email lama sebelumnya berstatus 'deleted'
 */
export async function registerUser({ name, storeName, phone, email, region, district, password }) {
  if (!name || name.trim().length < 2) {
    throw new Error("Nama lengkap harus diisi minimal 2 karakter.");
  }
  if (!storeName || storeName.trim().length < 2) {
    throw new Error("Nama Toko / Nama Penjual harus diisi minimal 2 karakter.");
  }
  if (!phone || phone.replace(/\D/g, '').length < 9) {
    throw new Error("Nomor WhatsApp aktif harus minimal 10 digit.");
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    throw new Error("Alamat email aktif harus valid.");
  }
  if (!region) {
    throw new Error("Pilih Kabupaten / Wilayah Solo Raya.");
  }
  if (!district || district.trim() === '') {
    throw new Error("Pilih atau isi Kecamatan domisili Anda.");
  }
  if (!password || password.length < 5) {
    throw new Error("Password minimal 5 karakter.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const cleanPhoneDigits = cleanPhone.replace(/\D/g, '');

  // 1. Cek di Supabase apakah email atau no WA sudah terdaftar (termasuk status deleted)
  if (supabase) {
    try {
      const { data: existingSb } = await supabase
        .from('users')
        .select('id, email, phone, status, deleted_at')
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (existingSb) {
        const sbStatus = (existingSb.status || 'active').toLowerCase();
        const isDeleted = sbStatus === 'deleted' || !!existingSb.deleted_at;

        // JIKA AKUN LAMA BERSTATUS 'DELETED': LAKUKAN REAKTIVASI OTOMATIS
        if (isDeleted) {
          console.log(`[Supabase Auth] Reaktivasi akun lama yang sebelumnya dihapus: ${cleanEmail}`);
          const reactivatedUser = {
            id: existingSb.id || `user-${cleanEmail.replace(/[^a-z0-9]/g, '') || Date.now()}`,
            name: name.trim(),
            storeName: storeName.trim(),
            email: cleanEmail,
            phone: cleanPhone,
            region: region,
            district: district.trim(),
            password: password,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
            bio: `Penjual Terverifikasi Pusat Jual Beli Solo Raya (${district.trim()}, ${region.toUpperCase()})`,
            status: 'active',
            deletedAt: null,
            isProfileConfigured: true,
            createdAt: new Date().toISOString()
          };

          const regUsers = getRegisteredUsers().filter(u => !u.email || u.email.toLowerCase() !== cleanEmail);
          regUsers.unshift(reactivatedUser);
          syncRegisteredUsersToSupabase(regUsers);

          const sessionUser = {
            ...reactivatedUser,
            loggedInAt: new Date().toISOString(),
            isReactivated: true
          };

          setCurrentUser(sessionUser);

          const sbPayload = {
            id: reactivatedUser.id,
            name: reactivatedUser.name,
            store_name: reactivatedUser.storeName,
            email: reactivatedUser.email,
            phone: reactivatedUser.phone,
            region: reactivatedUser.region,
            district: reactivatedUser.district,
            password: reactivatedUser.password,
            avatar: reactivatedUser.avatar,
            bio: reactivatedUser.bio,
            status: 'active',
            deleted_at: null,
            is_demo: false
          };

          supabase.from('users').upsert(sbPayload, { onConflict: 'email' }).catch(() => {});

          try {
            sendWelcomeRegistrationEmail(reactivatedUser).catch(() => {});
          } catch (e) {}

          return sessionUser;
        }

        if (existingSb.email && existingSb.email.toLowerCase() === cleanEmail) {
          throw new Error(`Email "${cleanEmail}" sudah terdaftar aktif di database. Silakan langsung Masuk / Login.`);
        }
        if (existingSb.phone && existingSb.phone.replace(/\D/g, '') === cleanPhoneDigits) {
          throw new Error(`Nomor WhatsApp "${cleanPhone}" sudah terdaftar aktif. Silakan Masuk / Login.`);
        }
      }
    } catch (sbErr) {
      if (sbErr.message && sbErr.message.includes('sudah terdaftar')) throw sbErr;
    }
  }

  const users = getRegisteredUsers();

  // Cek duplikasi email di memori lokal
  const existingEmail = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
  if (existingEmail) {
    const locStatus = (existingEmail.status || 'active').toLowerCase();
    if (locStatus === 'deleted' || existingEmail.deletedAt) {
      // Reaktivasi lokal
      existingEmail.status = 'active';
      existingEmail.deletedAt = null;
      existingEmail.name = name.trim();
      existingEmail.storeName = storeName.trim();
      existingEmail.phone = cleanPhone;
      existingEmail.password = password;
      existingEmail.region = region;
      existingEmail.district = district.trim();
      syncRegisteredUsersToSupabase(users);

      const sessionUser = { ...existingEmail, loggedInAt: new Date().toISOString() };
      setCurrentUser(sessionUser);
      return sessionUser;
    }
    throw new Error(`Email "${cleanEmail}" sudah terdaftar aktif. Silakan langsung Masuk / Login.`);
  }

  // Cek duplikasi no telepon di memori lokal
  const existingPhone = users.find((u) => {
    const uDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
    return uDigits.length >= 8 && uDigits === cleanPhoneDigits && (u.status || 'active') !== 'deleted';
  });
  if (existingPhone) {
    throw new Error(`Nomor WhatsApp "${cleanPhone}" sudah terdaftar aktif. Silakan Masuk / Login.`);
  }

  const newUser = {
    id: `user-${cleanEmail.replace(/[^a-z0-9]/g, '') || Date.now()}`,
    name: name.trim(),
    storeName: storeName.trim(),
    email: cleanEmail,
    phone: cleanPhone,
    region: region,
    district: district.trim(),
    password: password,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    bio: `Penjual Terverifikasi Pusat Jual Beli Solo Raya (${district.trim()}, ${region.toUpperCase()})`,
    status: 'active',
    deletedAt: null,
    isProfileConfigured: true,
    createdAt: new Date().toISOString()
  };

  users.unshift(newUser);
  syncRegisteredUsersToSupabase(users);

  // Otomatis aktifkan sesi login
  const sessionUser = {
    ...newUser,
    loggedInAt: new Date().toISOString()
  };

  setCurrentUser(sessionUser);

  // Sinkronisasi pendaftaran akun baru ke tabel users Supabase dengan onConflict email
  if (supabase) {
    const sbPayload = {
      id: newUser.id,
      name: newUser.name,
      store_name: newUser.storeName,
      email: newUser.email,
      phone: newUser.phone,
      region: newUser.region,
      district: newUser.district,
      password: newUser.password,
      avatar: newUser.avatar,
      bio: newUser.bio,
      status: 'active',
      deleted_at: null,
      is_demo: false
    };

    supabase
      .from('users')
      .upsert(sbPayload, { onConflict: 'email' })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase Register Error]', error.message || error);
        } else {
          console.log('[Supabase Register Success] Akun terdaftar di tabel users Supabase:', data);
        }
      })
      .catch((err) => {
        console.warn('[Supabase Register Exception]', err);
      });
  }

  // Kirim Email Notifikasi Registrasi Baru (Welcome Email)
  try {
    sendWelcomeRegistrationEmail(newUser).catch((err) => {
      console.warn("Welcome email async notification:", err);
    });
  } catch (e) {}

  return sessionUser;
}

/**
 * 2b. DEAKTIVASI / HAPUS AKUN PENGGUNA (USER ACCOUNT DELETION / SOFT DELETE)
 * Mengubah kolom status menjadi 'deleted' dan mencatat timestamp deleted_at di tabel 'users'.
 * 
 * ATURAN INTEGRITAS DATA ULASAN KOMUNITAS:
 * 1. Proses penghapusan/deaktivasi akun HANYA menargetkan tabel 'users' atau data auth akun yang bersangkutan.
 * 2. Kode TIDAK MENYERTAKAN dan DILARANG mengeksekusi perintah DELETE pada tabel 'public.app_reviews'
 *    berdasarkan user_id tersebut.
 * 3. Riwayat ulasan aplikasi yang telah diberikan oleh pengguna ini TETAP UTUH dan ABADI di tabel 'app_reviews'
 *    dengan snapshot identitas nama toko dan lokasi yang valid.
 */
export async function deactivateUser(userIdOrEmail) {
  const target = userIdOrEmail || (getCurrentUser() ? getCurrentUser().id : null);
  if (!target) throw new Error('Pengguna tidak ditemukan.');

  const isEmail = typeof target === 'string' && target.includes('@');
  const cleanTarget = target.toLowerCase().trim();

  // 1. Eksekusi perubahan status akun HANYA pada tabel 'users' Supabase
  // (CATATAN PENTING: Tabel 'app_reviews' sengaja TIDAK dihapus agar ulasan komunitas tetap abadi)
  if (supabase) {
    try {
      const updatePayload = {
        status: 'deleted',
        deleted_at: new Date().toISOString()
      };
      if (isEmail) {
        await supabase.from('users').update(updatePayload).eq('email', cleanTarget);
      } else {
        await supabase.from('users').update(updatePayload).eq('id', target);
      }
      console.log(`[deactivateUser] Akun pengguna "${target}" berhasil dinonaktifkan di tabel users. Ulasan di app_reviews tetap dipertahankan utuh.`);
    } catch (e) {
      console.warn('[Supabase Deactivate Notice]', e);
    }
  }

  // 2. Update di Memori Lokal
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => (isEmail ? (u.email && u.email.toLowerCase() === cleanTarget) : u.id === target));
  if (idx !== -1) {
    users[idx].status = 'deleted';
    users[idx].deletedAt = new Date().toISOString();
    syncRegisteredUsersToSupabase(users);
  }

  // Jika akun yang dideaktivasi adalah akun yang sedang aktif, lakukan logout
  const cur = getCurrentUser();
  if (cur && ((isEmail && cur.email && cur.email.toLowerCase() === cleanTarget) || cur.id === target)) {
    logout();
  }

  return { success: true, message: 'Akun berhasil dinonaktifkan.' };
}

/**
 * 3. LUPA PASSWORD (RESET PASSWORD VIA EMAIL)
 */
export async function requestPasswordReset(email) {
  if (!email || !email.includes('@')) {
    throw new Error("Masukkan alamat email valid yang terdaftar pada akun Anda.");
  }

  const cleanEmail = email.trim().toLowerCase();
  let users = getRegisteredUsers();
  let user = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);

  // Jika belum ada di cache memori lokal, cek langsung ke database Supabase
  if (!user && supabase) {
    try {
      const { data: sbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (sbUser) {
        user = {
          id: sbUser.id,
          name: sbUser.name,
          storeName: sbUser.store_name || sbUser.name,
          email: sbUser.email,
          phone: sbUser.phone,
          region: sbUser.region,
          district: sbUser.district,
          password: sbUser.password,
          avatar: sbUser.avatar,
          bio: sbUser.bio,
          status: sbUser.status || 'active',
          deletedAt: sbUser.deleted_at || null,
          isDemo: sbUser.is_demo,
          createdAt: sbUser.created_at
        };
        users.unshift(user);
        syncRegisteredUsersToSupabase(users);
      }
    } catch (sbErr) {
      console.warn('[Supabase Forgot Lookup]', sbErr);
    }
  }

  if (!user) {
    throw new Error(`Akun dengan email "${cleanEmail}" tidak ditemukan di database Pusat Jual Beli Solo Raya.`);
  }

  const status = (user.status || 'active').toLowerCase();
  if (status === 'deleted' || user.deletedAt) {
    throw new Error(`Akun dengan email "${cleanEmail}" telah dinonaktifkan.`);
  }

  // Generate 6-Digit Reset Code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  savePendingReset({
    email: cleanEmail,
    resetCode: resetCode,
    user: user,
    createdAt: Date.now()
  });

  // Simpan kode OTP & waktu kedaluwarsa langsung ke Supabase Cloud (dual cloud storage)
  if (supabase) {
    // 1. Simpan ke site_settings cloud storage (aman dan langsung aktif di Supabase)
    try {
      supabase
        .from('site_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle()
        .then(({ data }) => {
          const settings = (data && data.settings) || {};
          if (!settings.otp_sessions) settings.otp_sessions = {};
          settings.otp_sessions[cleanEmail] = {
            code: resetCode,
            expires_at: otpExpiresAt,
            created_at: Date.now()
          };
          return supabase.from('site_settings').upsert([
            { id: 'global', settings, updated_at: new Date().toISOString() }
          ], { onConflict: 'id' });
        })
        .then(() => console.log(`[Auth Security] Sesi OTP cloud berhasil dicatat di Supabase untuk ${cleanEmail}`))
        .catch(() => {});
    } catch (e) {}

    // 3. Simpan ke serverless OTP memory store
    try {
      fetch('/api/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          email: cleanEmail,
          otpCode: resetCode
        })
      }).catch(() => {});
    } catch (e) {}
  }

  // Kirim Email Kode Pemulihan Password via SMTP Backend Gateway (Async Network Fetch)
  try {
    const sendRes = await sendPasswordResetEmail({
      email: cleanEmail,
      userName: user.name || user.storeName,
      resetCode: resetCode
    });

    if (sendRes && sendRes.success === false) {
      console.error("[Auth Security] SMTP Dispatch Error:", sendRes.error);
      throw new Error(sendRes.error || "Gagal mengirim email verifikasi melalui server SMTP.");
    }
    console.log(`[Auth Security] Permintaan kode verifikasi reset password diproses & dikirim via backend SMTP ke ${cleanEmail}`);
  } catch (err) {
    console.error("[Auth Security] SMTP notification error:", err);
    throw new Error(err.message || "Gagal mengirim email pemulihan sandi. Periksa koneksi internet atau konfigurasi email server.");
  }

  return {
    success: true,
    email: cleanEmail,
    userName: user.name || user.storeName,
    phone: user.phone
  };
}

const STORAGE_KEY_PENDING_RESET = 'pusat_barkas_pending_reset';

export function savePendingReset(state) {
  pendingResetState = state;
  if (typeof window !== 'undefined') {
    window._globalPendingResetState = state;
  }
  try {
    if (state) {
      const serialized = JSON.stringify(state);
      sessionStorage.setItem(STORAGE_KEY_PENDING_RESET, serialized);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_PENDING_RESET);
    }
  } catch (e) {}
}

export function getPendingResetState() {
  if (pendingResetState && pendingResetState.resetCode) {
    return pendingResetState;
  }
  if (typeof window !== 'undefined' && window._globalPendingResetState && window._globalPendingResetState.resetCode) {
    pendingResetState = window._globalPendingResetState;
    return pendingResetState;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING_RESET);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.resetCode && parsed.createdAt && (Date.now() - parsed.createdAt < 15 * 60 * 1000)) {
        pendingResetState = parsed;
        if (typeof window !== 'undefined') {
          window._globalPendingResetState = parsed;
        }
        return parsed;
      }
    }
  } catch (e) {}
  return null;
}

export async function confirmPasswordReset(email, resetCode, newPassword) {
  if (!email || !email.includes('@')) throw new Error("Email reset tidak valid.");

  // Bersihkan input email & format kode verifikasi
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (resetCode || '').toString().trim().replace(/\D/g, '');

  if (!cleanCode || cleanCode.length < 4) {
    throw new Error("Masukkan 6 digit kode verifikasi yang Anda terima di email.");
  }
  if (!newPassword || newPassword.length < 5) {
    throw new Error("Password baru minimal 5 karakter.");
  }

  let isOtpValid = false;

  // 1. Verifikasi melalui state memori aktif / sessionStorage
  const activeReset = getPendingResetState();
  if (activeReset && activeReset.resetCode) {
    const localTarget = (activeReset.resetCode || '').toString().trim().replace(/\D/g, '');
    if (localTarget === cleanCode && (!activeReset.email || activeReset.email.toLowerCase() === cleanEmail)) {
      if (!activeReset.createdAt || (Date.now() - activeReset.createdAt <= 15 * 60 * 1000)) {
        isOtpValid = true;
      } else {
        savePendingReset(null);
        throw new Error("Kode verifikasi telah kadaluarsa (lebih dari 15 menit). Silakan minta kode baru.");
      }
    }
  }

  // 2. Verifikasi langsung ke database Supabase Cloud (mendukung multi-device / lintas HP)
  if (!isOtpValid && supabase) {
    // A. Cek dari site_settings cloud storage
    try {
      const { data: settingsData } = await supabase
        .from('site_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle();

      const cloudSession = settingsData?.settings?.otp_sessions?.[cleanEmail];
      if (cloudSession && cloudSession.code) {
        const cloudCode = cloudSession.code.toString().trim().replace(/\D/g, '');
        const expiresTime = cloudSession.expires_at ? new Date(cloudSession.expires_at).getTime() : 0;

        if (cloudCode === cleanCode) {
          if (expiresTime === 0 || Date.now() <= expiresTime) {
            isOtpValid = true;
          } else {
            throw new Error("Kode verifikasi telah kadaluarsa (lebih dari 15 menit). Silakan minta kode baru.");
          }
        }
      }
    } catch (sErr) {
      if (sErr.message && sErr.message.includes('kadaluarsa')) throw sErr;
    }

    // B. Cek dari baris tabel users jika kolom sudah terpasang
    if (!isOtpValid) {
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

        if (dbUser && dbUser.otp_code) {
          const dbTarget = dbUser.otp_code.toString().trim().replace(/\D/g, '');
          const expiresTime = dbUser.otp_expires_at ? new Date(dbUser.otp_expires_at).getTime() : 0;

          if (dbTarget === cleanCode) {
            if (expiresTime === 0 || Date.now() <= expiresTime) {
              isOtpValid = true;
            } else {
              throw new Error("Kode verifikasi telah kadaluarsa (lebih dari 15 menit). Silakan minta kode baru.");
            }
          }
        }
      } catch (dbErr) {
        if (dbErr.message && dbErr.message.includes('kadaluarsa')) throw dbErr;
      }
    }
  }

  // 3. Verifikasi melalui Serverless OTP API Endpoint (/api/otp)
  if (!isOtpValid) {
    try {
      const otpApiRes = await fetch('/api/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: cleanEmail,
          otpCode: cleanCode,
          newPassword: newPassword
        })
      });
      if (otpApiRes.ok) {
        const json = await otpApiRes.json();
        if (json.success) {
          isOtpValid = true;
        }
      }
    } catch (e) {}
  }

  // Format dan validasi password baru
  const cleanNewPassword = (newPassword || '').trim();
  if (!cleanNewPassword || cleanNewPassword.length < 5) {
    throw new Error("Password baru minimal 5 karakter.");
  }

  // 1. Update ke memori lokal
  const users = getRegisteredUsers();
  const index = users.findIndex((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (index !== -1) {
    users[index].password = cleanNewPassword;
    users[index].updatedAt = new Date().toISOString();
    syncRegisteredUsersToSupabase(users);
  }

  // 2. Eksekusi UPDATE password langsung ke basis data Supabase (tabel users)
  if (supabase) {
    // A. Bersihkan session OTP dari site_settings cloud storage
    try {
      supabase
        .from('site_settings')
        .select('settings')
        .eq('id', 'global')
        .maybeSingle()
        .then(({ data }) => {
          const settings = (data && data.settings) || {};
          if (settings.otp_sessions && settings.otp_sessions[cleanEmail]) {
            delete settings.otp_sessions[cleanEmail];
            return supabase.from('site_settings').upsert([
              { id: 'global', settings, updated_at: new Date().toISOString() }
            ], { onConflict: 'id' });
          }
        })
        .catch(() => {});
    } catch (e) {}

    // B. UPDATE password = cleanNewPassword ke baris pengguna di tabel users Supabase & kosongkan OTP
    try {
      const { error: fullUpdateErr } = await supabase
        .from('users')
        .update({
          password: cleanNewPassword,
          otp_code: null,
          otp_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('email', cleanEmail);

      if (fullUpdateErr) {
        // Fallback update password saja jika kolom OTP belum ada di skema PostgreSQL
        await supabase
          .from('users')
          .update({
            password: cleanNewPassword,
            updated_at: new Date().toISOString()
          })
          .eq('email', cleanEmail);
      }
      console.log(`[Supabase Password Update Success] Password baru berhasil disimpan & OTP dibersihkan untuk ${cleanEmail}`);
    } catch (sbErr) {
      console.warn('[Supabase Password Update Exception]', sbErr);
    }
  }

  // 3. Jika pengguna saat ini sedang login dengan email tersebut, perbarui sesi aktif
  const current = getCurrentUser();
  if (current && current.email && current.email.toLowerCase() === cleanEmail) {
    current.password = cleanNewPassword;
    window.__currentUser = current;
  }

  savePendingReset(null);

  return {
    success: true,
    email: cleanEmail
  };
}

function formatLocationTitle(district, region) {
  const cleanDist = district ? district.toString().trim().replace(/^Kec\.?\s*/i, '').replace(/\.+$/, '') : '';
  if (cleanDist) {
    return cleanDist.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  if (!region) return 'Solo Raya';
  const reg = region.toString().trim().toLowerCase();
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

/**
 * 4. UPDATE PROFIL LENGKAP (TAB PROFIL AKUN)
 * Menggunakan Email / ID sebagai kunci unik utama (onConflict: 'email') agar sinkron lintas perangkat
 */
export async function updateProfile({ name, storeName, email, phone, region, district, bio, avatar, newPassword }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Pengguna belum login.');

  const users = getRegisteredUsers();
  const targetEmail = (email ? email.trim().toLowerCase() : (currentUser.email || '')).toLowerCase();
  const index = users.findIndex((u) => u.id === currentUser.id || (u.email && u.email.toLowerCase() === targetEmail));

  // Validasi Email Unik jika email diganti
  if (email && email.trim().toLowerCase() !== (currentUser.email || '').toLowerCase()) {
    const cleanEmail = email.trim().toLowerCase();
    const emailConflict = users.find((u) => u.id !== currentUser.id && u.email && u.email.toLowerCase() === cleanEmail);
    if (emailConflict) {
      throw new Error("Alamat email ini sudah digunakan oleh akun lain.");
    }
  }

  // Validasi No. WhatsApp
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      throw new Error("Nomor WhatsApp minimal 8 digit.");
    }
  }

  // Proses konversi/unggah Avatar ke bucket 'avatars' Supabase Storage jika berupa Data URL / Base64
  let finalAvatarUrl = avatar !== undefined ? avatar : currentUser.avatar;
  if (typeof finalAvatarUrl === 'string' && finalAvatarUrl.startsWith('data:')) {
    try {
      const uploadedUrl = await sbUploadAvatar(finalAvatarUrl);
      if (uploadedUrl && !uploadedUrl.startsWith('data:')) {
        finalAvatarUrl = uploadedUrl;
        console.log('✅ [updateProfile] Avatar berhasil diunggah ke bucket avatars Supabase Storage:', finalAvatarUrl);
      } else {
        console.warn('⚠️ [updateProfile] Gagal mengunggah avatar ke storage, mempertahankan avatar sebelumnya');
        finalAvatarUrl = (currentUser.avatar && !currentUser.avatar.startsWith('data:')) ? currentUser.avatar : null;
      }
    } catch (avatarUploadErr) {
      console.warn('[updateProfile Avatar Upload Warning]:', avatarUploadErr.message || avatarUploadErr);
      finalAvatarUrl = (currentUser.avatar && !currentUser.avatar.startsWith('data:')) ? currentUser.avatar : null;
    }
  } else if (finalAvatarUrl === '' || finalAvatarUrl === null) {
    finalAvatarUrl = null;
  }

  const updatedFields = {
    name: name ? name.trim() : (currentUser.name || currentUser.storeName),
    storeName: storeName ? storeName.trim() : (currentUser.storeName || currentUser.name),
    email: targetEmail || currentUser.email,
    phone: phone ? phone.trim() : currentUser.phone,
    region: region || currentUser.region,
    district: district ? district.trim() : currentUser.district,
    bio: bio !== undefined ? bio.trim() : currentUser.bio,
    avatar: finalAvatarUrl,
    isProfileConfigured: true,
    updatedAt: new Date().toISOString()
  };

  // Update password jika diisi
  if (newPassword && newPassword.trim() !== '') {
    if (newPassword.trim().length < 5) {
      throw new Error("Password baru minimal 5 karakter.");
    }
    updatedFields.password = newPassword.trim();
  }

  let canonicalId = currentUser.id;

  // Simpan data lengkap ke database Supabase (Tabel 'users') berbasis Email / ID
  if (supabase) {
    try {
      const validEmail = targetEmail && typeof targetEmail === 'string' && targetEmail.trim() !== '' && targetEmail.includes('@') ? targetEmail.trim().toLowerCase() : null;

      if (validEmail) {
        const { data: existingSb } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', validEmail)
          .maybeSingle();

        if (existingSb && existingSb.id) {
          canonicalId = existingSb.id;
        }
      }

      const sbPayload = {
        id: canonicalId,
        name: updatedFields.name,
        store_name: updatedFields.storeName || updatedFields.name || null,
        email: validEmail || null,
        phone: updatedFields.phone || null,
        region: updatedFields.region || null,
        district: updatedFields.district || null,
        bio: updatedFields.bio || null,
        avatar: updatedFields.avatar || null,
        updated_at: new Date().toISOString()
      };
      if (updatedFields.password) {
        sbPayload.password = updatedFields.password;
      }

      let res;
      if (validEmail) {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'email' }).select('*');
      } else if (canonicalId) {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'id' }).select('*');
      }

      if (res && res.error) {
        console.error('[Supabase Error] Gagal upsert profil user ke tabel users:', res.error.message || res.error);
        if (canonicalId) {
          const fallbackRes = await supabase.from('users').update(sbPayload).eq('id', canonicalId);
          if (fallbackRes.error && validEmail) {
            await supabase.from('users').update(sbPayload).eq('email', validEmail);
          }
        } else if (validEmail) {
          await supabase.from('users').update(sbPayload).eq('email', validEmail);
        }
      } else if (res && res.data && res.data[0] && res.data[0].id) {
        canonicalId = res.data[0].id;
      }

      console.log('[Supabase Success] Tabel users berhasil diperbarui:', canonicalId);

      // LANGSUNG SINKRONISASI UPDATE KE TABEL public.app_reviews
      const regionInput = formatLocationTitle(district, region) || formatLocationTitle(updatedFields.district, updatedFields.region);
      const rawStoreInput = (storeName && storeName.trim()) || (name && name.trim()) || updatedFields.storeName || updatedFields.name || 'Pengguna';
      const storeNameInput = `${rawStoreInput} (${regionInput})`;
      const currentUserId = canonicalId || currentUser.id;

      console.log(`[updateProfile: Supabase Sync App Reviews] Memulai update tabel app_reviews untuk user_id: "${currentUserId}", user_name: "${storeNameInput}", user_location: "${regionInput}"...`);

      const { error: reviewUpdateError } = await supabase
        .from('app_reviews')
        .update({
          user_location: regionInput,
          user_name: storeNameInput
        })
        .eq('user_id', currentUserId);

      if (reviewUpdateError) {
        console.error('[updateProfile: Supabase App Reviews Error] Gagal mengupdate tabel app_reviews:', reviewUpdateError.message || reviewUpdateError);
      } else {
        console.log('[updateProfile: Supabase App Reviews Success] Tabel app_reviews berhasil diperbarui secara permanen');
      }

      // Redundansi jika ID lokal / email berbeda
      if (currentUser.id && currentUser.id !== currentUserId) {
        const { error: rErr2 } = await supabase
          .from('app_reviews')
          .update({ user_location: regionInput, user_name: storeNameInput })
          .eq('user_id', currentUser.id);
        if (rErr2) console.warn('[Supabase App Reviews Redundancy Notice 1]:', rErr2.message);
      }
      if (targetEmail && targetEmail !== currentUserId) {
        const { error: rErr3 } = await supabase
          .from('app_reviews')
          .update({ user_location: regionInput, user_name: storeNameInput })
          .eq('user_id', targetEmail);
        if (rErr3) console.warn('[Supabase App Reviews Redundancy Notice 2]:', rErr3.message);
      }
    } catch (sbErr) {
      console.error('[Supabase Exception] Kendala koneksi saat update profil ke Supabase:', sbErr);
      throw sbErr;
    }
  }

  // Perbarui ulasan lokal di localStorage
  try {
    const localReviews = window.__appReviewsCache;
    if (localReviews && Array.isArray(localReviews)) {
      let isChanged = false;
      const updatedReviews = localReviews.map((r) => {
        const match = r.userId === canonicalId || r.userId === currentUser.id || (targetEmail && r.userId === targetEmail);
        if (match) {
          isChanged = true;
          return {
            ...r,
            userName: storeNameInput,
            userLocation: regionInput,
            userAvatar: updatedFields.avatar || r.userAvatar
          };
        }
        return r;
      });

      if (isChanged) {
        window.__appReviewsCache = updatedReviews;
        window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { reviews: updatedReviews } }));
      }
    }
  } catch (e) {}

  const updatedUser = {
    ...currentUser,
    id: canonicalId,
    ...updatedFields
  };

  if (index !== -1) {
    users[index] = {
      ...users[index],
      id: canonicalId,
      ...updatedFields
    };
  } else {
    users.push(updatedUser);
  }
  syncRegisteredUsersToSupabase(users);

  setCurrentUser(updatedUser);
  window.dispatchEvent(new CustomEvent('registeredUsersChanged', { detail: users }));
  return updatedUser;
}

/**
 * HAPUS FOTO PROFIL / AVATAR
 * Menghapus fisik foto di Supabase Storage, membersihkan nilai avatar di database tabel 'users', dan mereset sesi pengguna
 */
export async function removeUserAvatar(userId) {
  const current = getCurrentUser();
  const targetId = userId ? String(userId).trim() : (current && current.id ? String(current.id).trim() : null);
  if (!targetId) throw new Error('Pengguna tidak ditemukan (ID user kosong).');

  const oldAvatar = current?.avatar;
  const filePath = extractAvatarFilePath(oldAvatar);

  // 1. Eksekusi penghapusan fisik dari Supabase Storage TERLEBIH DAHULU sebelum update database
  if (filePath && supabase && supabase.storage) {
    try {
      console.log(`[removeUserAvatar] Menghapus file fisik dari storage bucket 'avatars': "${filePath}"...`);
      const { data, error } = await supabase.storage.from('avatars').remove([filePath]);
      if (error) {
        console.warn(`⚠️ [removeUserAvatar Storage Notice] Gagal menghapus file "${filePath}" dari storage:`, error.message || error);
      } else {
        console.log(`✅ [removeUserAvatar Storage Success] File "${filePath}" berhasil dihapus dari bucket 'avatars'.`, data);
      }
    } catch (delErr) {
      console.warn('[removeUserAvatar Storage Exception]:', delErr.message || delErr);
    }
  }

  // 2. SETELAH proses remove() storage selesai, BARU eksekusi update database users menjadi null
  if (supabase) {
    try {
      const { error: sbErr } = await supabase
        .from('users')
        .update({
          avatar: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetId);

      if (sbErr) {
        console.warn('[removeUserAvatar Supabase ID Update Warning]:', sbErr.message || sbErr);
        if (current?.email) {
          await supabase
            .from('users')
            .update({
              avatar: null,
              updated_at: new Date().toISOString()
            })
            .eq('email', current.email.toLowerCase().trim());
        }
      } else {
        console.log(`✅ [removeUserAvatar DB Success] Kolom avatar pada tabel users untuk id "${targetId}" berhasil diset menjadi null di Supabase.`);
      }
    } catch (e) {
      console.warn('[removeUserAvatar DB Exception]:', e.message || e);
    }
  }

  // Perbarui di data akun terdaftar
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => String(u.id) === String(targetId) || (current && u.email && u.email.toLowerCase() === (current.email || '').toLowerCase()));
  if (idx !== -1) {
    users[idx].avatar = null;
    syncRegisteredUsersToSupabase(users);
  }

  if (current) {
    current.avatar = null;
    setCurrentUser(current);
  }

  console.log(`✅ [removeUserAvatar] Foto profil user "${targetId}" berhasil dibersihkan.`);
  return { success: true, message: 'Foto profil / avatar berhasil dihapus.' };
}

/**
 * 5. LOGOUT
 * Menghapus semua data sesi akun pengguna (localStorage, sessionStorage, cookies, Cache Storage & unregister Service Worker)
 */
export function logout() {
  console.log('[Auth Service] Memulai eksekusi logout & pembersihan sesi akun...');
  inMemoryActiveUser = null;
  try {
    // 1. Bersihkan variabel memori dan sessionStorage
    window.__currentUser = null;
    sessionStorage.removeItem(SESSION_KEY_USER_DATA);
    sessionStorage.removeItem(SESSION_KEY_USER_ID);
    sessionStorage.removeItem('pusat_barkas_user');
    sessionStorage.removeItem('pusat_barkas_admin_auth');
    try {
      sessionStorage.clear();
    } catch (e) {}

    // 3. Bersihkan cookies sesi terkait jika tersedia
    if (typeof document !== 'undefined' && document.cookie) {
      try {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name) {
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          }
        }
      } catch (cookieErr) {}
    }

    // 4. Bersihkan Service Worker registrations & cache storage
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const reg of registrations) {
            reg.unregister().catch(() => {});
          }
          console.log('[Auth Service] Service worker unregister selesai.');
        }).catch(() => {});
      } catch (swErr) {}
    }

    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        caches.keys().then((keys) => {
          return Promise.all(keys.map((k) => caches.delete(k)));
        }).then(() => {
          console.log('[Auth Service] Cache storage berhasil dibersihkan.');
        }).catch(() => {});
      } catch (cacheErr) {}
    }

    console.log('[Auth Service] Semua kunci sesi localStorage, sessionStorage & cookies berhasil dihapus.');
  } catch (err) {
    console.warn('[Auth Logout Exception]', err);
  }

  savePendingReset(null);
  notifySubscribers();
  console.log('[Auth Service] Status sesi pengguna berhasil direset ke mode tamu/keluar.');
}

/**
 * 6. GET USER BY ID / SELLER LOOKUP
 */
export function getUserById(userId) {
  if (!userId) return null;
  const cleanId = String(userId).trim().toLowerCase();
  const users = getRegisteredUsers();
  return users.find((u) => 
    (u.id && String(u.id).toLowerCase() === cleanId) ||
    (u.email && u.email.toLowerCase() === cleanId)
  ) || null;
}

/**
 * 7. GET USER BY REVIEW AUTHOR (LOOKUP BY ID, EMAIL, OR STORE/NAME)
 * Memastikan identitas pemberi ulasan selalu terhubung secara dinamis ke tabel profil Supabase
 */
export function getUserByReviewAuthor(userId, authorName) {
  const users = getRegisteredUsers();
  if (userId) {
    const cleanId = String(userId).trim().toLowerCase();
    const found = users.find((u) => 
      (u.id && String(u.id).toLowerCase() === cleanId) ||
      (u.email && u.email.toLowerCase() === cleanId)
    );
    if (found) return found;
  }
  if (authorName) {
    const cleanName = String(authorName).replace(/\(.*?\)/g, '').trim().toLowerCase();
    if (cleanName) {
      const found = users.find((u) => 
        (u.storeName && u.storeName.toLowerCase() === cleanName) ||
        (u.name && u.name.toLowerCase() === cleanName) ||
        (u.storeName && u.storeName.toLowerCase().includes(cleanName)) ||
        (u.name && u.name.toLowerCase().includes(cleanName))
      );
      if (found) return found;
    }
  }
  return null;
}

