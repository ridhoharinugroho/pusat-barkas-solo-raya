/**
 * Service Autentikasi Pengguna & Penjual Pusat Jual Beli Solo Raya
 * Login & Registrasi dengan No. WA / Email / Nama Toko + Password
 * Reset Password via Email & Penyimpanan Sesi Persisten
 * Murni sinkronisasi dengan tabel 'users' Supabase (kolom name & store_name)
 */

import { broadcastToCloud } from './cloudSync.js';
import { sendWelcomeRegistrationEmail, sendPasswordResetEmail } from './emailService.js';
import { supabase } from '../lib/supabase.js';

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
    district: "Tawangmangu",
    password: "Semangat.45",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ridho.harinugroho%40gmail.com",
    bio: "Dodol Opo Wae",
    status: "active",
    deletedAt: null,
    createdAt: "2026-08-27T10:31:51.688667+00:00",
    isDemo: false
  }
];
export { DEFAULT_REGISTERED_USERS };
// Auto‑sync default users to Supabase (run once on load)
export async function syncDefaultUsersToSupabase() {
  try {
    const payload = DEFAULT_REGISTERED_USERS.map(u => ({
      id: u.id,
      name: u.name,
      store_name: u.storeName,
      email: u.email,
      phone: u.phone,
      region: u.region,
      district: u.district,
      status: u.status || 'active',
      deleted_at: u.deletedAt || null
    }));
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) console.error('[Auth Sync] Supabase upsert error:', error.message);
    else console.log('[Auth Sync] Default users synced to Supabase');
  } catch (e) {
    console.error('[Auth Sync] Exception:', e);
  }
}

// Immediately invoke sync on module load
syncDefaultUsersToSupabase();

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
 * Inisialisasi dan Dapatkan Daftar Seluruh Akun Terdaftar (Dibersihkan dari duplikasi)
 */
export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    let users = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          users = parsed;
        }
      } catch (e) {
        users = [];
      }
    }

    if (users.length === 0) {
      users = [...DEFAULT_REGISTERED_USERS];
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
      return users;
    }

    // Deduplikasi memori lokal berbasis Email atau ID & bersihkan akun Danang yang dihapus
    const deduplicated = [];
    users.forEach((u) => {
      if (!u) return;
      const uEmail = (u.email || '').toLowerCase().trim();
      const uName = (u.name || '').toLowerCase().trim();

      // Skip akun Danang Solo yang telah dihapus
      if (uEmail.includes('danang.solo') || uName.includes('danang')) {
        return;
      }

      const existIdx = deduplicated.findIndex((d) => 
        (uEmail && d.email && d.email.toLowerCase().trim() === uEmail) ||
        d.id === u.id
      );

      if (existIdx === -1) {
        deduplicated.push(u);
      } else {
        deduplicated[existIdx] = { ...deduplicated[existIdx], ...u };
      }
    });

    // Pastikan akun-akun default selalu ada
    DEFAULT_REGISTERED_USERS.forEach((def) => {
      const defEmail = (def.email || '').toLowerCase().trim();
      const exists = deduplicated.some((u) => 
        (defEmail && u.email && u.email.toLowerCase().trim() === defEmail) ||
        u.id === def.id
      );
      if (!exists) {
        deduplicated.push(def);
      }
    });

    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(deduplicated));
    return deduplicated;
  } catch (err) {
    return [...DEFAULT_REGISTERED_USERS];
  }
}

export function saveRegisteredUsers(users) {
  try {
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
    broadcastToCloud('USERS_UPDATED', users);

    // Kirim update ke REST API jika backend server aktif
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(users)
    }).catch(() => {});
  } catch (e) {
    console.error("Failed to save registered users to localStorage", e);
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

      const payload = {
        id: match ? match.id : def.id,
        name: def.name,
        store_name: def.storeName || def.name,
        email: def.email || null,
        phone: def.phone || null,
        region: def.region || 'solo',
        district: def.district || 'Banjarsari',
        avatar: def.avatar || null,
        bio: def.bio || null,
        password: def.password || 'barkas123',
        is_demo: !!def.isDemo
      };

      // Gunakan onConflict: 'email' jika email ada
      if (payload.email) {
        await supabase.from('users').upsert(payload, { onConflict: 'email' }).select();
      } else {
        await supabase.from('users').upsert(payload, { onConflict: 'id' }).select();
      }
    }

    console.log('[Supabase Seeding Success] Seeding akun demo & Ridho Hari Nugroho selesai secara unik berbasis email.');
  } catch (err) {
    console.warn('[Supabase Seeding Exception]', err);
  }
}

/**
 * Auto-Sync saat aplikasi dibuka di perangkat mana pun (HP atau PC):
 * 1. Seed, deduplikasi & upsert data akun demo + Ridho Hari Nugroho ke database Supabase berbasis Email
 * 2. Tarik dan merge akun dari Supabase / cloud ke memori lokal
 */
export async function syncAllUsersToCloudOnStartup() {
  try {
    // 1. Eksekusi seeding & deduplikasi ke Supabase
    await seedUsersToSupabase();

    // 2. Tarik akun terbaru murni dari Supabase: supabase.from('users').select('*')
    if (supabase) {
      try {
        const { data: sbUsers, error } = await supabase.from('users').select('*');
        if (!error && Array.isArray(sbUsers) && sbUsers.length > 0) {
          const validSbUsers = sbUsers.filter(u => u.id !== 'user-ridho' && !(u.email && u.email.includes('unused')));
          const currentUsers = getRegisteredUsers().filter(u => u.id !== 'user-ridho' && !(u.email && u.email.includes('unused')));
          let merged = [...currentUsers];
          validSbUsers.forEach((sbU) => {
            const mapped = {
              id: sbU.id,
              name: sbU.name,
              storeName: sbU.store_name || sbU.name,
              email: sbU.email,
              phone: sbU.phone,
              region: sbU.region,
              district: sbU.district,
              password: sbU.password,
              avatar: sbU.avatar,
              bio: sbU.bio,
              status: sbU.status || 'active',
              deletedAt: sbU.deleted_at || null,
              isDemo: sbU.is_demo,
              createdAt: sbU.created_at
            };
            const idx = merged.findIndex((u) => 
              (mapped.email && u.email && u.email.toLowerCase() === mapped.email.toLowerCase()) ||
              u.id === mapped.id
            );
            if (idx === -1) {
              merged.push(mapped);
            } else {
              merged[idx] = { ...merged[idx], ...mapped };
            }
          });
          localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(merged));
          console.log('[Supabase Users Sync] Berhasil menyinkronkan', validSbUsers.length, 'akun dari database Supabase.');
        }
      } catch (sbFetchErr) {
        console.warn('[Supabase Users Sync]', sbFetchErr);
      }
    }

    const localUsers = getRegisteredUsers();
    const hasCustomUser = localUsers.some((u) => !DEFAULT_REGISTERED_USERS.some((d) => d.id === u.id));

    if (hasCustomUser) {
      broadcastToCloud('USERS_UPDATED', localUsers);
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localUsers)
      }).catch(() => {});
    }

    await syncUsersFromCloud();
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
 * 2b. DEAKTIVASI / HAPUS AKUN PENGGUNA (SOFT DELETE)
 * Mengubah kolom status menjadi 'deleted' dan mencatat timestamp deleted_at
 */
export async function deactivateUser(userIdOrEmail) {
  const target = userIdOrEmail || (getCurrentUser() ? getCurrentUser().id : null);
  if (!target) throw new Error('Pengguna tidak ditemukan.');

  const isEmail = typeof target === 'string' && target.includes('@');
  const cleanTarget = target.toLowerCase().trim();

  // 1. Update di Supabase
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
  pendingResetState = {
    email: cleanEmail,
    resetCode: resetCode,
    user: user,
    createdAt: Date.now()
  };

  // Kirim Email Kode Pemulihan Password via SMTP Backend Gateway (Async Network Fetch)
  try {
    await sendPasswordResetEmail({
      email: cleanEmail,
      userName: user.name || user.storeName,
      resetCode: resetCode
    });
    console.log(`[Auth Security] Permintaan kode verifikasi reset password diproses & dikirim via backend SMTP ke ${cleanEmail}`);
  } catch (err) {
    console.warn("[Auth Security] SMTP notification error:", err);
  }

  return {
    success: true,
    email: cleanEmail,
    userName: user.name || user.storeName,
    phone: user.phone
  };
}

export function getPendingResetState() {
  return pendingResetState;
}

export function confirmPasswordReset(email, resetCode, newPassword) {
  if (!email) throw new Error("Email reset tidak valid.");
  if (!resetCode || resetCode.toString().trim().length < 4) {
    throw new Error("Masukkan kode verifikasi reset yang benar.");
  }
  if (!newPassword || newPassword.length < 5) {
    throw new Error("Password baru minimal 5 karakter.");
  }

  if (pendingResetState) {
    if (pendingResetState.email !== email.trim().toLowerCase()) {
      throw new Error("Email tidak cocok dengan permintaan reset yang aktif.");
    }
    if (pendingResetState.resetCode !== resetCode.toString().trim()) {
      throw new Error("Kode verifikasi reset salah.");
    }
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const index = users.findIndex((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (index === -1) {
    throw new Error("Akun tidak ditemukan.");
  }

  // Update password akun di database
  users[index].password = newPassword;
  users[index].updatedAt = new Date().toISOString();
  saveRegisteredUsers(users);

  // Jika user saat ini sedang aktif, perbarui sesi juga
  const current = getCurrentUser();
  if (current && current.email && current.email.toLowerCase() === cleanEmail) {
    current.password = newPassword;
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(current));
  }

  // Sync password reset ke Supabase jika tersedia
  if (supabase) {
    supabase
      .from('users')
      .update({ password: newPassword })
      .eq('email', cleanEmail)
      .then(({ error }) => {
        if (error) console.error('[Supabase Password Reset Error]', error.message || error);
        else console.log('[Supabase Password Reset Success] Password berhasil diupdate di Supabase.');
      })
      .catch(() => {});
  }

  pendingResetState = null;
  return { success: true, user: users[index] };
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

  const updatedFields = {
    name: name ? name.trim() : (currentUser.name || currentUser.storeName),
    storeName: storeName ? storeName.trim() : (currentUser.storeName || currentUser.name),
    email: targetEmail || currentUser.email,
    phone: phone ? phone.trim() : currentUser.phone,
    region: region || currentUser.region,
    district: district ? district.trim() : currentUser.district,
    bio: bio !== undefined ? bio.trim() : currentUser.bio,
    avatar: avatar || currentUser.avatar,
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
        district: updatedFields.district || 'Banjarsari',
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
    } catch (sbErr) {
      console.error('[Supabase Exception] Kendala koneksi saat update profil ke Supabase:', sbErr);
      throw sbErr;
    }
  }

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
    saveRegisteredUsers(users);
  }

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  notifySubscribers();
  return updatedUser;
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

  pendingResetState = null;
  notifySubscribers();
  console.log('[Auth Service] Status sesi pengguna berhasil direset ke mode tamu/keluar.');
}

/**
 * 6. GET USER BY ID / SELLER LOOKUP
 */
export function getUserById(userId) {
  if (!userId) return null;
  const users = getRegisteredUsers();
  return users.find((u) => u.id === userId) || null;
}
