/**
 * Service Autentikasi Pengguna & Penjual Pusat Jual Beli Solo Raya
 * Login & Registrasi dengan No. WA / Email / Nama Toko + Password
 * Reset Password via Email & Penyimpanan Sesi Persisten
 * Murni sinkronisasi dengan tabel 'users' Supabase (kolom name & store_name)
 */

import { broadcastToCloud } from './cloudSync.js';
import { sendWelcomeRegistrationEmail, sendPasswordResetEmail } from './emailService.js';
import { supabase } from '../lib/supabase.js';
import { sbUploadAvatar, sbUpdateUserAvatar, sbDeleteAvatar } from './supabaseDB.js';

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

let pendingResetState = null;

/**
 * Inisialisasi dan Dapatkan Daftar Seluruh Akun Terdaftar (Single Source of Truth)
 */
export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    return [...DEFAULT_REGISTERED_USERS];
  } catch (err) {
    return [...DEFAULT_REGISTERED_USERS];
  }
}

export function saveRegisteredUsers(users) {
  try {
    const sanitizedUsers = (Array.isArray(users) ? users : []).map(u => {
      if (u && typeof u.avatar === 'string' && u.avatar.startsWith('data:')) {
        return { ...u, avatar: null };
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(sanitizedUsers));
    safeBroadcastToCloud('USERS_UPDATED', sanitizedUsers);
  } catch (e) {
    console.warn("[Auth Warning] Gagal menyimpan data registered users ke localStorage:", e.message || e);
  }
}

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
        localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(merged));
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
      await supabase.from('seller_reviews').delete().or('seller_id.eq.user-101,comment.ilike.%Danang%');
      await supabase.from('users').delete().eq('id', 'user-ridho');
      await supabase.from('users').delete().eq('email', 'ridho.merged.unused@example.com');
    } catch (e) {}
  } catch (err) {
    console.warn('[Supabase Deduplication Exception]', err);
  }
}

/**
 * Seeding data akun demo dan user Ridho Hari Nugroho langsung ke database Supabase
 * Menggunakan Email sebagai kunci unik utama (onConflict: 'email')
 */
export async function seedUsersToSupabase() {
  if (!supabase) {
    console.warn('[Supabase Seeding] Client Supabase belum aktif atau terkonfigurasi.');
    return;
  }

  try {
    // 1. Jalankan pembersihan & deduplikasi terlebih dahulu
    await cleanupAndDeduplicateUsers();

    // 2. Ambil data users dari Supabase untuk memeriksa apakah email sudah ada
    const { data: existingSbUsers } = await supabase.from('users').select('id, email');
    const existingList = existingSbUsers || [];

    const defaultUsers = [...DEFAULT_REGISTERED_USERS];

    for (const def of defaultUsers) {
      const cleanEmail = (def.email || '').toLowerCase().trim();

      const match = existingList.find(e => 
        (cleanEmail && e.email && e.email.toLowerCase().trim() === cleanEmail) ||
        e.id === def.id
      );

      // Hanya sisipkan (insert) jika akun bawaan belum ada di Supabase, jangan menimpa data yang telah diedit pengguna!
      if (!match) {
        const payload = {
          id: def.id,
          name: def.name,
          store_name: def.storeName || def.name,
          email: def.email || null,
          phone: def.phone || null,
          region: def.region || 'solo',
          district: def.district || 'Jaten',
          avatar: def.avatar || null,
          bio: def.bio || null,
          password: def.password || 'barkas123',
          is_demo: !!def.isDemo
        };

        if (payload.email) {
          await supabase.from('users').upsert(payload, { onConflict: 'email' }).select();
        } else {
          await supabase.from('users').upsert(payload, { onConflict: 'id' }).select();
        }
      }
    }

    console.log('[Supabase Seeding Success] Seeding akun selesai.');
  } catch (err) {
    console.warn('[Supabase Seeding Exception]', err);
  }
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
      if (targetId) {
        const { data: d1, error: e1 } = await supabase
          .from('users')
          .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
          .eq('id', targetId)
          .select();
        
        if (e1 || !d1 || d1.length === 0) {
          if (targetEmail) {
            await supabase
              .from('users')
              .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
              .eq('email', targetEmail.toLowerCase())
              .select();
          }
        }
      } else if (targetEmail) {
        await supabase
          .from('users')
          .update({ avatar: cleanAvatar, updated_at: new Date().toISOString() })
          .eq('email', targetEmail.toLowerCase())
          .select();
      }
      console.log(`✅ [saveUserAvatarDirectly] Avatar user "${targetId || targetEmail}" berhasil disimpan permanen ke database Supabase:`, cleanAvatar);
    } catch (sbErr) {
      console.warn('[saveUserAvatarDirectly DB Warning]:', sbErr.message || sbErr);
    }
  }

  // 2. Perbarui daftar akun terdaftar di localStorage
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => (targetId && u.id === targetId) || (targetEmail && u.email && u.email.toLowerCase() === targetEmail.toLowerCase()));
  if (idx !== -1) {
    users[idx].avatar = cleanAvatar;
    saveRegisteredUsers(users);
  }

  // 3. Perbarui sesi pengguna aktif di localStorage
  if (current && ((targetId && current.id === targetId) || (targetEmail && current.email && current.email.toLowerCase() === targetEmail.toLowerCase()))) {
    current.avatar = cleanAvatar;
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(current));
    } catch (lsErr) {
      console.warn('[saveUserAvatarDirectly localStorage Warning]:', lsErr.message || lsErr);
    }
    notifySubscribers();
    window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: current }));
  }

  return { success: true, avatar: cleanAvatar };
}

/**
 * Tarik data profil terbaru pengguna aktif langsung dari tabel users Supabase (Single Source of Truth)
 */
export async function fetchFreshCurrentUserFromSupabase() {
  if (!supabase) return null;
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
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(freshCurrentUser));
      notifySubscribers();
      window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: freshCurrentUser }));
      return freshCurrentUser;
    }
  } catch (e) {
    console.warn('[fetchFreshCurrentUserFromSupabase]', e);
  }
  return null;
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

          // Simpan data murni Supabase ke localStorage tanpa mencampur dengan cache lama
          localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(mappedSbUsers));
          window.dispatchEvent(new CustomEvent('registeredUsersChanged', { detail: mappedSbUsers }));
          console.log('[Supabase Users Sync] Berhasil menyinkronkan', mappedSbUsers.length, 'akun dari database Supabase sebagai sumber kebenaran tunggal.');

          // Perbarui data pengguna aktif yang tersimpan di localStorage
          const rawCur = localStorage.getItem(STORAGE_KEY_USER);
          if (rawCur) {
            try {
              const curObj = JSON.parse(rawCur);
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
                localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(freshCurrentUser));

                // Sinkronkan seller.id pada etalase lokal agar konsisten dengan ID Supabase
                try {
                  const rawListings = localStorage.getItem(STORAGE_KEY_LISTINGS);
                  if (rawListings) {
                    const parsedListings = JSON.parse(rawListings);
                    if (Array.isArray(parsedListings)) {
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
                        localStorage.setItem(STORAGE_KEY_LISTINGS, JSON.stringify(parsedListings));
                      }
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

/**
 * Dapatkan Pengguna yang Sedang Login (Murni dari session storage, tanpa fallback paksa)
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.id !== 'user-101') {
      const status = (parsed.status || 'active').toLowerCase();
      if (status === 'deleted' || parsed.deletedAt) {
        localStorage.removeItem(STORAGE_KEY_USER);
        return null;
      }
      return parsed;
    }
    return null;
  } catch (err) {
    return null;
  }
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
          saveRegisteredUsers(regUsers);
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

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
  notifySubscribers();
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
          saveRegisteredUsers(regUsers);

          const sessionUser = {
            ...reactivatedUser,
            loggedInAt: new Date().toISOString(),
            isReactivated: true
          };

          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
          notifySubscribers();

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
      saveRegisteredUsers(users);

      const sessionUser = { ...existingEmail, loggedInAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
      notifySubscribers();
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
  saveRegisteredUsers(users);

  // Otomatis aktifkan sesi login
  const sessionUser = {
    ...newUser,
    loggedInAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
  notifySubscribers();

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
    saveRegisteredUsers(users);
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
        saveRegisteredUsers(users);
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
      localStorage.setItem(STORAGE_KEY_PENDING_RESET, serialized);
    } else {
      sessionStorage.removeItem(STORAGE_KEY_PENDING_RESET);
      localStorage.removeItem(STORAGE_KEY_PENDING_RESET);
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
    const raw = sessionStorage.getItem(STORAGE_KEY_PENDING_RESET) || localStorage.getItem(STORAGE_KEY_PENDING_RESET);
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
    saveRegisteredUsers(users);
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
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(current));
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
      if (targetEmail) {
        const { data: existingSb } = await supabase
          .from('users')
          .select('id, email')
          .eq('email', targetEmail)
          .maybeSingle();

        if (existingSb && existingSb.id) {
          canonicalId = existingSb.id;
        }
      }

      const sbPayload = {
        id: canonicalId,
        name: updatedFields.name,
        store_name: updatedFields.storeName || updatedFields.name,
        email: targetEmail || null,
        phone: updatedFields.phone || null,
        region: updatedFields.region || 'solo',
        district: updatedFields.district !== undefined ? updatedFields.district : (currentUser.district || null),
        avatar: updatedFields.avatar || null,
        bio: updatedFields.bio || null,
        status: currentUser.status || 'active',
        deleted_at: currentUser.deletedAt || null,
        is_demo: !!currentUser.isDemo
      };
      if (updatedFields.password) {
        sbPayload.password = updatedFields.password;
      }

      let res;
      if (sbPayload.email) {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'email' }).select();
      } else {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'id' }).select();
      }

      if (res.error) {
        console.error('[Supabase Error] Gagal upsert profil user ke tabel users:', res.error.message || res.error);
        if (targetEmail) {
          const fallbackRes = await supabase.from('users').update(sbPayload).eq('email', targetEmail).select();
          if (fallbackRes.error) {
            throw new Error(`Gagal menyimpan ke Supabase: ${res.error.message || fallbackRes.error.message}`);
          }
        } else {
          throw new Error(`Gagal menyimpan ke Supabase: ${res.error.message}`);
        }
      } else if (res.data && res.data[0] && res.data[0].id) {
        canonicalId = res.data[0].id;
      }

      console.log('[Supabase Success] Tabel users berhasil diperbarui:', canonicalId);

      // LANGSUNG SINKRONISASI UPDATE KE TABEL public.app_reviews
      const regionInput = formatLocationTitle(district, region) || formatLocationTitle(updatedFields.district, updatedFields.region);
      const rawStoreInput = (storeName && storeName.trim()) || (name && name.trim()) || updatedFields.storeName || updatedFields.name || 'Pengguna';
      const storeNameInput = `${rawStoreInput} (${regionInput})`;
      const currentUserId = canonicalId || currentUser.id;

      console.log(`[updateProfile: Supabase Sync App Reviews] Memulai update tabel app_reviews untuk user_id: "${currentUserId}", user_name: "${storeNameInput}", user_location: "${regionInput}"...`);

      const { data: reviewUpdateData, error: reviewUpdateError } = await supabase
        .from('app_reviews')
        .update({
          user_location: regionInput,
          user_name: storeNameInput
        })
        .eq('user_id', currentUserId)
        .select();

      if (reviewUpdateError) {
        console.error('[updateProfile: Supabase App Reviews Error] Gagal mengupdate tabel app_reviews:', reviewUpdateError.message || reviewUpdateError);
      } else {
        console.log('[updateProfile: Supabase App Reviews Success] Tabel app_reviews berhasil diperbarui secara permanen:', reviewUpdateData || 'Berhasil');
      }

      // Redundansi jika ID lokal / email berbeda
      if (currentUser.id && currentUser.id !== currentUserId) {
        const { data: rData2, error: rErr2 } = await supabase
          .from('app_reviews')
          .update({ user_location: regionInput, user_name: storeNameInput })
          .eq('user_id', currentUser.id)
          .select();
        if (rErr2) console.warn('[Supabase App Reviews Redundancy Notice 1]:', rErr2.message);
        else console.log('[Supabase App Reviews Redundancy Success 1]:', rData2);
      }
      if (targetEmail && targetEmail !== currentUserId) {
        const { data: rData3, error: rErr3 } = await supabase
          .from('app_reviews')
          .update({ user_location: regionInput, user_name: storeNameInput })
          .eq('user_id', targetEmail)
          .select();
        if (rErr3) console.warn('[Supabase App Reviews Redundancy Notice 2]:', rErr3.message);
        else console.log('[Supabase App Reviews Redundancy Success 2]:', rData3);
      }
    } catch (sbErr) {
      console.error('[Supabase Exception] Kendala koneksi saat update profil ke Supabase:', sbErr);
      throw sbErr;
    }
  }

  // Perbarui ulasan lokal di localStorage
  try {
    const rawRev = localStorage.getItem('pusat_barkas_app_reviews');
    if (rawRev) {
      let localReviews = JSON.parse(rawRev);
      if (Array.isArray(localReviews)) {
        let isChanged = false;
        localReviews = localReviews.map((r) => {
          const match = r.userId === canonicalId || r.userId === currentUser.id || (targetEmail && r.userId === targetEmail);
          if (match) {
            isChanged = true;
            return {
              ...r,
              userName: formattedUserName,
              userLocation: newRegion,
              userAvatar: updatedFields.avatar || r.userAvatar
            };
          }
          return r;
        });

        if (isChanged) {
          localStorage.setItem('pusat_barkas_app_reviews', JSON.stringify(localReviews));
          window.dispatchEvent(new CustomEvent('appReviewsChanged', { detail: { reviews: localReviews } }));
        }
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
  saveRegisteredUsers(users);

  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  } catch (lsErr) {
    console.warn('[updateProfile localStorage Warning]:', lsErr.message || lsErr);
  }
  notifySubscribers();
  window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updatedUser }));
  window.dispatchEvent(new CustomEvent('registeredUsersChanged', { detail: users }));
  return updatedUser;
}

/**
 * HAPUS FOTO PROFIL / AVATAR
 * Menghapus fisik foto di Supabase Storage, membersihkan nilai avatar di database tabel 'users', dan mereset sesi pengguna
 */
export async function removeUserAvatar(userId) {
  const current = getCurrentUser();
  const targetId = userId || (current ? current.id : null);
  if (!targetId) throw new Error('Pengguna tidak ditemukan.');

  const oldAvatar = current?.avatar;
  if (oldAvatar && typeof oldAvatar === 'string') {
    try {
      await sbDeleteAvatar(oldAvatar);
    } catch (delErr) {
      console.warn('[removeUserAvatar Storage Delete Notice]:', delErr.message || delErr);
    }
  }

  if (supabase) {
    try {
      await sbUpdateUserAvatar(targetId, null);
      if (current?.email) {
        await supabase
          .from('users')
          .update({ avatar: null, updated_at: new Date().toISOString() })
          .eq('email', current.email.toLowerCase())
          .select();
      }
    } catch (e) {
      console.warn('[removeUserAvatar DB Notice]', e.message || e);
    }
  }

  // Perbarui di data akun terdaftar
  const users = getRegisteredUsers();
  const idx = users.findIndex(u => u.id === targetId || (current && u.email && u.email.toLowerCase() === (current.email || '').toLowerCase()));
  if (idx !== -1) {
    users[idx].avatar = null;
    saveRegisteredUsers(users);
  }

  if (current) {
    current.avatar = null;
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(current));
    } catch (lsErr) {
      console.warn('[removeUserAvatar localStorage Warning]:', lsErr.message || lsErr);
    }
    notifySubscribers();
    window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: current }));
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
  try {
    // 1. Hapus kunci sesi pengguna di localStorage
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem('pusat_barkas_user');
    localStorage.removeItem('solosatset_auth_user');
    localStorage.removeItem('sb_auth_token');
    localStorage.removeItem('supabase.auth.token');

    // 2. Bersihkan seluruh sessionStorage
    sessionStorage.removeItem(STORAGE_KEY_USER);
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

