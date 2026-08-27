/**
 * Service Autentikasi Pengguna & Penjual Pusat Jual Beli Solo Raya
 * Login & Registrasi Lengkap dengan No. WA / Email / Username + Password
 * Reset Password via Email & Penyimpanan Sesi Persisten
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
    displayName: "Toko Pak Joko",
    username: "jokokra",
    email: "joko.kra@gmail.com",
    phone: "085725012345",
    region: "karanganyar",
    district: "Jaten",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    bio: "Pusat perabot rumah tangga & elektronik seken berkualitas Karanganyar.",
    createdAt: "2026-07-05T09:30:00.000Z",
    isDemo: true
  },
  {
    id: "user-103",
    name: "Rian Kurniawan",
    storeName: "Rian Gadget Kartasura",
    displayName: "Rian Gadget Kartasura",
    username: "riangadget",
    email: "rian.gadget@gmail.com",
    phone: "089678123456",
    region: "sukoharjo",
    district: "Kartasura",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=150&q=80",
    bio: "Thrift & gadget bekas garansi personal area UMS Kartasura & Solo Baru.",
    createdAt: "2026-07-10T11:15:00.000Z",
    isDemo: true
  },
  {
    id: "user-104",
    name: "Siti Aisyah",
    storeName: "Aisyah's Crafts Solo",
    displayName: "Aisyah's Crafts Solo",
    username: "aisyahcrafts",
    email: "aisyah.crafts@example.com",
    phone: "081234567890",
    region: "solo",
    district: "Mojosongo",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
    bio: "Handmade crafts, artwork, dan souvenir khas Solo. Fast WA response.",
    createdAt: "2026-08-25T09:00:00.000Z",
    isDemo: true
  },
  {
    id: "user-1787309560138",
    name: "Ridho Hari Nugroho",
    storeName: "Zamir Shop",
    displayName: "Zamir Shop",
    username: "pnpshop991",
    email: "ridho.harinugroho@gmail.com",
    phone: "081251018765",
    region: "karanganyar",
    district: "Tawangmangu",
    password: "Semangat.45",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=ridho.harinugroho%40gmail.com",
    bio: "Dodol Opo Wae",
    createdAt: "2026-08-27T10:31:51.688667+00:00",
    isDemo: false
  }
];

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
 * /**
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

    // Deduplikasi memori lokal berbasis Email, Username, atau ID & bersihkan akun Danang yang dihapus
    const deduplicated = [];
    users.forEach((u) => {
      if (!u) return;
      const uEmail = (u.email || '').toLowerCase().trim();
      const uUser = (u.username || '').toLowerCase().trim();
      const uName = (u.name || '').toLowerCase().trim();

      // Skip akun Danang Solo yang telah dihapus
      if (u.id === 'user-101' || uEmail.includes('danang.solo') || uName.includes('danang')) {
        return;
      }

      const existIdx = deduplicated.findIndex((d) => 
        (uEmail && d.email && d.email.toLowerCase().trim() === uEmail) ||
        (uUser && d.username && d.username.toLowerCase().trim() === uUser) ||
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
 * Sinkronisasi Akun Terdaftar dari Seluruh Sumber (API Server, db/users.json, & Cloud SSE)
 */
export async function syncUsersFromCloud() {
  let fetchedUsers = null;

  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        fetchedUsers = json;
      }
    }
  } catch (e) {}

  if (!fetchedUsers) {
    try {
      const res = await fetch('db/users.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          fetchedUsers = json;
        }
      }
    } catch (e) {}
  }

  if (!fetchedUsers) {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        lines.forEach((line) => {
          try {
            const item = JSON.parse(line);
            if (item.event === 'message' && item.message) {
              const payload = JSON.parse(item.message);
              if (payload.type === 'USERS_UPDATED' && Array.isArray(payload.data)) {
                fetchedUsers = payload.data;
              }
            }
          } catch (e) {}
        });
      }
    } catch (err) {}
  }

  if (fetchedUsers && fetchedUsers.length > 0) {
    const currentUsers = getRegisteredUsers();
    let merged = [...currentUsers];
    fetchedUsers.forEach((cloudU) => {
      const idx = merged.findIndex((u) => u.id === cloudU.id || (u.email && u.email.toLowerCase() === cloudU.email.toLowerCase()));
      if (idx === -1) {
        merged.push(cloudU);
      } else {
        merged[idx] = { ...merged[idx], ...cloudU };
      }
    });
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(merged));
    return merged;
  }

  return getRegisteredUsers();
}

/**
 * Membersihkan dan menggabungkan data user duplikat di tabel Supabase users berbasis Email & Username
 */
export async function cleanupAndDeduplicateUsers() {
  if (!supabase) return;

  try {
    const { data: allSbUsers, error } = await supabase.from('users').select('*');
    if (error || !Array.isArray(allSbUsers) || allSbUsers.length === 0) return;

    // Kelompokkan row berdasarkan normalized email (atau username jika email kosong)
    const grouped = {};
    allSbUsers.forEach((u) => {
      const key = (u.email && u.email.trim()) 
        ? u.email.trim().toLowerCase() 
        : (u.username ? u.username.trim().toLowerCase() : u.id);

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
          if (!canonical.display_name && r.display_name) canonical.display_name = r.display_name;
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
            const { error: delErr } = await supabase.from('users').delete().in('id', duplicateIds);
            if (delErr) {
              console.warn('[Supabase Deduplication] Notice hapus ID duplikat:', delErr.message);
            } else {
              console.log('[Supabase Deduplication] Berhasil menghapus baris duplikat dengan ID:', duplicateIds);
            }
          } catch (e) {}
        }

        // Upsert kembali data kanonikal
        await supabase.from('users').upsert(canonical, { onConflict: 'email' });
      }
    }

    // Bersihkan spesifik akun Danang Solo Manahan & duplikat lama dari Supabase
    try {
      await supabase.from('users').delete().or('id.eq.user-101,email.eq.danang.solo@gmail.com,name.ilike.%Danang%,store_name.ilike.%Danang%');
      await supabase.from('listings').delete().or('seller_id.eq.user-101,seller_email.eq.danang.solo@gmail.com,seller_name.ilike.%Danang%');
      await supabase.from('reviews').delete().or('seller_id.eq.user-101,comment.ilike.%Danang%');
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

    // 2. Ambil data users dari Supabase untuk memeriksa apakah email/username sudah ada
    const { data: existingSbUsers } = await supabase.from('users').select('id, email, username');
    const existingList = existingSbUsers || [];

    const defaultUsers = [...DEFAULT_REGISTERED_USERS];

    for (const def of defaultUsers) {
      const cleanEmail = (def.email || '').toLowerCase().trim();
      const cleanUser = (def.username || '').toLowerCase().trim();

      const match = existingList.find(e => 
        (cleanEmail && e.email && e.email.toLowerCase().trim() === cleanEmail) ||
        (cleanUser && e.username && e.username.toLowerCase().trim() === cleanUser) ||
        e.id === def.id
      );

      const payload = {
        id: match ? match.id : def.id,
        name: def.name,
        store_name: def.storeName || def.displayName || def.name,
        display_name: def.displayName || def.storeName || def.name,
        username: def.username || (def.storeName ? def.storeName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user'),
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

    // 2. Tarik akun terbaru dari Supabase ke localStorage jika ada
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
              storeName: sbU.store_name || sbU.display_name || sbU.name,
              displayName: sbU.display_name || sbU.store_name || sbU.name,
              username: sbU.username,
              email: sbU.email,
              phone: sbU.phone,
              region: sbU.region,
              district: sbU.district,
              password: sbU.password,
              avatar: sbU.avatar,
              bio: sbU.bio,
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
 * Cari Akun berdasarkan No. WA, Email, Username, atau Nama Lengkap
 * Mendukung format nomor HP lokal/internasional (+62, 62, 08, spasi, tanda hubung)
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

    // 2. Cek Username
    const usernameMatch = u.username && u.username.toString().trim().toLowerCase() === cleanId;
    if (usernameMatch) return true;

    // 3. Cek Nama Toko
    const storeMatch = u.storeName && u.storeName.toString().trim().toLowerCase() === cleanId;
    if (storeMatch) return true;

    // 4. Cek Nama Lengkap Penjual
    const nameMatch = u.name && u.name.toString().trim().toLowerCase() === cleanId;
    if (nameMatch) return true;

    // 5. Cek Display Name
    const displayMatch = u.displayName && u.displayName.toString().trim().toLowerCase() === cleanId;
    if (displayMatch) return true;

    // 6. Cek Nomor WhatsApp / Telepon
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
 * Dapatkan Pengguna yang Sedang Login
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.id !== 'user-101') {
        return parsed;
      }
    }
    const users = getRegisteredUsers();
    const active = users.find(u => u.id === 'user-1787309560138' || (u.email && u.email.toLowerCase().includes('ridho'))) || users[0];
    return active || null;
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
 * 1. LOGIN PENGGUNA (No. WA / Email / Username + Password)
 * Mendukung sinkronisasi instan lintas perangkat (HP, Laptop, PC) berbasis query Supabase
 */
export async function loginUser(identifier, password) {
  if (!identifier || identifier.trim() === '') {
    throw new Error("Nomor WhatsApp, Email, atau Nama Pengguna harus diisi.");
  }
  if (!password || password.trim() === '') {
    throw new Error("Password harus diisi.");
  }

  const cleanIdent = identifier.trim();
  const cleanLower = cleanIdent.toLowerCase();
  const cleanDigits = cleanIdent.replace(/\D/g, '');
  const cleanPass = password.trim();

  let user = null;

  // 1. Query langsung ke Supabase untuk memastikan data paling akurat dan sinkron lintas perangkat
  if (supabase) {
    try {
      const { data: sbUsers, error } = await supabase.from('users').select('*');
      if (!error && Array.isArray(sbUsers) && sbUsers.length > 0) {
        const found = sbUsers.find(u => {
          if (u.email && u.email.toLowerCase() === cleanLower) return true;
          if (u.username && u.username.toLowerCase() === cleanLower) return true;
          if (u.name && u.name.toLowerCase() === cleanLower) return true;
          if (u.store_name && u.store_name.toLowerCase() === cleanLower) return true;
          if (u.display_name && u.display_name.toLowerCase() === cleanLower) return true;
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
            storeName: found.store_name || found.display_name || found.name,
            displayName: found.display_name || found.store_name || found.name,
            username: found.username,
            email: found.email,
            phone: found.phone,
            region: found.region,
            district: found.district,
            password: found.password,
            avatar: found.avatar,
            bio: found.bio,
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
    throw new Error(`Akun "${cleanIdent}" tidak ditemukan. Pastikan No. WA, Email, atau Username sesuai saat mendaftar di HP/Laptop, atau silakan Daftar akun baru.`);
  }

  if (user.password !== password && user.password !== cleanPass) {
    throw new Error("Password yang Anda masukkan salah. Silakan periksa huruf besar/kecil atau gunakan fitur Lupa Password.");
  }

  const sessionUser = {
    ...user,
    displayName: user.storeName || user.name || user.displayName,
    loggedInAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
  notifySubscribers();
  return sessionUser;
}

/**
 * 2. REGISTRASI AKUN BARU
 * (Nama, Nama Toko, No. WA, Email, Kabupaten, Kecamatan, Password)
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

  // 1. Cek di Supabase apakah email atau no WA sudah terdaftar
  if (supabase) {
    try {
      const { data: existingSb } = await supabase
        .from('users')
        .select('id, email, phone')
        .or(`email.eq.${cleanEmail},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (existingSb) {
        if (existingSb.email && existingSb.email.toLowerCase() === cleanEmail) {
          throw new Error(`Email "${cleanEmail}" sudah terdaftar di database. Silakan langsung Masuk / Login.`);
        }
        if (existingSb.phone && existingSb.phone.replace(/\D/g, '') === cleanPhoneDigits) {
          throw new Error(`Nomor WhatsApp "${cleanPhone}" sudah terdaftar. Silakan Masuk / Login.`);
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
    throw new Error(`Email "${cleanEmail}" sudah terdaftar. Silakan langsung Masuk / Login.`);
  }

  // Cek duplikasi no telepon di memori lokal
  const existingPhone = users.find((u) => {
    const uDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
    return uDigits.length >= 8 && uDigits === cleanPhoneDigits;
  });
  if (existingPhone) {
    throw new Error(`Nomor WhatsApp "${cleanPhone}" sudah terdaftar. Silakan Masuk / Login.`);
  }

  const cleanUsername = storeName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(100 + Math.random() * 900);

  const newUser = {
    id: `user-${cleanEmail.replace(/[^a-z0-9]/g, '') || Date.now()}`,
    name: name.trim(),
    storeName: storeName.trim(),
    displayName: storeName.trim(),
    username: cleanUsername,
    email: cleanEmail,
    phone: cleanPhone,
    region: region,
    district: district.trim(),
    password: password,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    bio: `Penjual Terverifikasi Pusat Jual Beli Solo Raya (${district.trim()}, ${region.toUpperCase()})`,
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
      display_name: newUser.displayName,
      username: newUser.username,
      email: newUser.email,
      phone: newUser.phone,
      region: newUser.region,
      district: newUser.district,
      password: newUser.password,
      avatar: newUser.avatar,
      bio: newUser.bio,
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
 * 3. LUPA PASSWORD (RESET PASSWORD VIA EMAIL)
 */
export function requestPasswordReset(email) {
  if (!email || !email.includes('@')) {
    throw new Error("Masukkan alamat email valid yang terdaftar pada akun Anda.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getRegisteredUsers();
  const user = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);

  if (!user) {
    throw new Error(`Akun dengan email "${cleanEmail}" tidak ditemukan di database Pusat Jual Beli Solo Raya.`);
  }

  // Generate 6-Digit Reset Code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  pendingResetState = {
    email: cleanEmail,
    resetCode: resetCode,
    user: user,
    createdAt: Date.now()
  };

  // Kirim Email Kode Pemulihan Password via SMTP Gateway
  try {
    sendPasswordResetEmail({
      email: cleanEmail,
      userName: user.name || user.storeName,
      resetCode: resetCode
    }).catch((err) => {
      console.warn("Reset email async notification:", err);
    });
  } catch (e) {}

  return {
    success: true,
    email: cleanEmail,
    userName: user.name || user.storeName,
    resetCode: resetCode,
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
 * Mendukung Edit Nama, No. HP/WA, Ganti Email, Ganti Password, Wilayah, Bio & Avatar
 * Menggunakan Email / ID sebagai kunci unik utama (onConflict: 'email') agar sinkron lintas perangkat
 */
export async function updateProfile({ name, displayName, storeName, email, phone, region, district, bio, avatar, newPassword }) {
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
    name: name ? name.trim() : (currentUser.name || displayName),
    displayName: displayName ? displayName.trim() : (name ? name.trim() : (currentUser.displayName || currentUser.storeName)),
    storeName: storeName ? storeName.trim() : (currentUser.storeName || displayName || name),
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
      // 1. Cek apakah ada record di Supabase yang sudah ada untuk email ini
      if (targetEmail) {
        const { data: existingSb } = await supabase
          .from('users')
          .select('id, email, username')
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
        display_name: updatedFields.displayName || updatedFields.storeName || updatedFields.name,
        username: currentUser.username || (updatedFields.storeName ? updatedFields.storeName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user'),
        email: targetEmail || null,
        phone: updatedFields.phone || null,
        region: updatedFields.region || 'solo',
        district: updatedFields.district || 'Banjarsari',
        avatar: updatedFields.avatar || null,
        bio: updatedFields.bio || null,
        is_demo: !!currentUser.isDemo
      };
      if (updatedFields.password) {
        sbPayload.password = updatedFields.password;
      }

      console.log('[Supabase Upsert by Email] Menyimpan profil pengguna ke tabel "users"...', sbPayload);
      
      let res;
      if (sbPayload.email) {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'email' }).select();
      } else {
        res = await supabase.from('users').upsert(sbPayload, { onConflict: 'id' }).select();
      }

      if (res.error) {
        console.error('[Supabase Error] Gagal upsert profil user ke tabel users:', res.error.message || res.error);
        // Fallback update berdasarkan email
        if (targetEmail) {
          const fallbackRes = await supabase.from('users').update(sbPayload).eq('email', targetEmail).select();
          if (fallbackRes.error) {
            console.error('[Supabase Fallback Update Error]', fallbackRes.error);
            throw new Error(`Gagal menyimpan ke Supabase: ${res.error.message || fallbackRes.error.message}`);
          } else {
            console.log('[Supabase Fallback Update Success] Data berhasil diupdate berdasarkan email:', fallbackRes.data);
          }
        } else {
          throw new Error(`Gagal menyimpan ke Supabase: ${res.error.message}`);
        }
      } else {
        console.log('[Supabase Success] Profil user berhasil disimpan di tabel users Supabase:', res.data);
        if (res.data && res.data[0] && res.data[0].id) {
          canonicalId = res.data[0].id;
        }
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
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY_USER);
  sessionStorage.removeItem(STORAGE_KEY_USER);
  pendingResetState = null;
  notifySubscribers();
}

/**
 * 6. GET USER BY ID / SELLER LOOKUP
 */
export function getUserById(userId) {
  if (!userId) return null;
  const users = getRegisteredUsers();
  return users.find((u) => u.id === userId) || null;
}

