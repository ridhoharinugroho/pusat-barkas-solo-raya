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
    id: "user-101",
    name: "Danang Prasetyo",
    storeName: "Danang Solo Manahan",
    displayName: "Danang Solo Manahan",
    username: "danangsolo",
    email: "danang.solo@gmail.com",
    phone: "081228198765",
    region: "solo",
    district: "Banjarsari",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    bio: "Jual beli barang sepeda, elektronik, dan hobi area Manahan Solo. Fast response WA.",
    createdAt: "2026-07-01T08:00:00.000Z",
    isDemo: true
  },
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
    id: "user-ridho",
    name: "Ridho Hari Nugroho",
    storeName: "Toko Satset Ridho Solo",
    displayName: "Ridho Hari Nugroho",
    username: "ridhoharinugroho",
    email: "ridhoharinugroho@gmail.com",
    phone: "081228198765",
    region: "solo",
    district: "Banjarsari",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    bio: "Penjual Terverifikasi Pusat Jual Beli Solo Raya. Jual beli aneka barang terpercaya area Solo & Karanganyar. Fast response WA.",
    createdAt: "2026-08-01T08:00:00.000Z",
    isDemo: false
  }
];

export function isDemoUser(userOrId) {
  if (!userOrId) return false;
  const id = typeof userOrId === 'string' ? userOrId : (userOrId.id || userOrId.sellerId || '');
  if (typeof userOrId === 'object' && userOrId.isDemo) return true;
  if (id && (id.startsWith('user-10') || id === 'user-101' || id === 'user-102' || id === 'user-103' || id === 'user-104' || id === 'user-105' || id === 'user-106' || id === 'user-107')) {
    return true;
  }
  const email = typeof userOrId === 'object' ? (userOrId.email || '') : '';
  if (email && (email.includes('danang.solo') || email.includes('joko.kra') || email.includes('rian.gadget') || email.includes('@example.com'))) {
    return true;
  }
  return false;
}

let pendingResetState = null;

/**
 * Inisialisasi dan Dapatkan Daftar Seluruh Akun Terdaftar
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

    // Merge missing seeded users so default logins always work seamlessly
    let hasMerged = false;
    DEFAULT_REGISTERED_USERS.forEach((def) => {
      const exists = users.some((u) => u.id === def.id || (u.email && u.email.toLowerCase() === def.email.toLowerCase()));
      if (!exists) {
        users.push(def);
        hasMerged = true;
      }
    });

    if (hasMerged) {
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
    }
    return users;
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

  // 1. Coba ambil dari REST API server lokal /api/users
  try {
    const apiRes = await fetch('/api/users', { cache: 'no-store' });
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (Array.isArray(data) && data.length > 0) {
        fetchedUsers = data;
      }
    }
  } catch (e) {}

  // 2. Coba ambil dari file database statis db/users.json
  if (!fetchedUsers) {
    try {
      const dbRes = await fetch('db/users.json', { cache: 'no-store' });
      if (dbRes.ok) {
        const data = await dbRes.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedUsers = data;
        }
      }
    } catch (e) {}
  }

  // 3. Coba ambil dari global cloud PubSub (ntfy.sh)
  try {
    const CLOUD_SYNC_URL = 'https://ntfy.sh/pusat_barkas_solo_raya_sync_280995/json?poll=1&since=24h';
    const res = await fetch(CLOUD_SYNC_URL, { cache: 'no-store' });
    if (res.ok) {
      const textData = await res.text();
      if (textData) {
        const lines = textData.trim().split('\n');
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
    }
  } catch (err) {}

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
 * Seeding data akun demo dan user Ridho Hari Nugroho langsung ke database Supabase
 */
export async function seedUsersToSupabase() {
  if (!supabase) {
    console.warn('[Supabase Seeding] Client Supabase belum aktif atau terkonfigurasi.');
    return;
  }

  try {
    const allUsers = getRegisteredUsers();
    const payload = allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      store_name: u.storeName || u.displayName || u.name,
      display_name: u.displayName || u.storeName || u.name,
      username: u.username || (u.storeName ? u.storeName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user') + Math.floor(100 + Math.random() * 900),
      email: u.email || null,
      phone: u.phone || null,
      region: u.region || 'solo',
      district: u.district || 'Banjarsari',
      avatar: u.avatar || null,
      bio: u.bio || null,
      password: u.password || 'barkas123',
      is_demo: !!u.isDemo
    }));

    console.log('[Supabase Seeding] Memasukkan/Upsert akun demo & user Ridho Hari Nugroho ke tabel "users" Supabase...', payload);
    const { data, error } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('[Supabase Seeding Error] Gagal seeding users ke Supabase:', error.message || error);
    } else {
      console.log('[Supabase Seeding Success] Data user demo & Ridho Hari Nugroho berhasil masuk ke tabel users Supabase:', data);
    }
  } catch (err) {
    console.warn('[Supabase Seeding Exception]', err);
  }
}

/**
 * Auto-Sync saat aplikasi dibuka di perangkat mana pun (HP atau PC):
 * 1. Seed & upsert data akun demo + Ridho Hari Nugroho ke database Supabase
 * 2. Tarik dan merge akun dari Supabase / cloud ke memori lokal
 */
export async function syncAllUsersToCloudOnStartup() {
  try {
    // 1. Eksekusi seeding ke Supabase
    await seedUsersToSupabase();

    // 2. Tarik akun terbaru dari Supabase ke localStorage jika ada
    if (supabase) {
      try {
        const { data: sbUsers, error } = await supabase.from('users').select('*');
        if (!error && Array.isArray(sbUsers) && sbUsers.length > 0) {
          const currentUsers = getRegisteredUsers();
          let merged = [...currentUsers];
          sbUsers.forEach((sbU) => {
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
            const idx = merged.findIndex((u) => u.id === mapped.id || (mapped.email && u.email && u.email.toLowerCase() === mapped.email.toLowerCase()));
            if (idx === -1) {
              merged.push(mapped);
            } else {
              merged[idx] = { ...merged[idx], ...mapped };
            }
          });
          localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(merged));
          console.log('[Supabase Users Sync] Berhasil menyinkronkan', sbUsers.length, 'akun dari database Supabase.');
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
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return parsed && parsed.id ? parsed : null;
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
 * Mendukung sinkronisasi instan jika akun didaftarkan via HP
 */
export async function loginUser(identifier, password) {
  if (!identifier || identifier.trim() === '') {
    throw new Error("Nomor WhatsApp, Email, atau Nama Pengguna harus diisi.");
  }
  if (!password || password.trim() === '') {
    throw new Error("Password harus diisi.");
  }

  const cleanIdent = identifier.trim();
  const cleanPass = password.trim();

  let user = findUserByIdentifier(cleanIdent);

  // Jika akun belum ditemukan di memori lokal PC, lakukan sinkronisasi cloud & server seketika
  if (!user) {
    await syncUsersFromCloud();
    user = findUserByIdentifier(cleanIdent);
  }

  if (!user) {
    throw new Error(`Akun "${cleanIdent}" tidak ditemukan. Pastikan No. WA, Email, atau Username sesuai saat mendaftar di HP, atau silakan Daftar akun baru.`);
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
export function registerUser({ name, storeName, phone, email, region, district, password }) {
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

  const users = getRegisteredUsers();

  // Cek duplikasi email
  const existingEmail = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
  if (existingEmail) {
    throw new Error(`Email "${cleanEmail}" sudah terdaftar. Silakan langsung Masuk / Login.`);
  }

  // Cek duplikasi no telepon
  const existingPhone = users.find((u) => {
    const uDigits = u.phone ? u.phone.replace(/\D/g, '') : '';
    return uDigits.length >= 8 && uDigits === cleanPhoneDigits;
  });
  if (existingPhone) {
    throw new Error(`Nomor WhatsApp "${cleanPhone}" sudah terdaftar. Silakan Masuk / Login.`);
  }

  const cleanUsername = storeName.trim().toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(100 + Math.random() * 900);

  const newUser = {
    id: `user-${Date.now()}`,
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

  // Sinkronisasi pendaftaran akun baru ke tabel users Supabase
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
      .upsert(sbPayload, { onConflict: 'id' })
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
 * Menyimpan data ke LocalStorage dan Database Supabase (Tabel 'users')
 */
export async function updateProfile({ name, displayName, storeName, email, phone, region, district, bio, avatar, newPassword }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Pengguna belum login.');

  const users = getRegisteredUsers();
  const index = users.findIndex((u) => u.id === currentUser.id);

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
    email: email ? email.trim().toLowerCase() : currentUser.email,
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

  const updatedUser = {
    ...currentUser,
    ...updatedFields
  };

  if (index !== -1) {
    users[index] = {
      ...users[index],
      ...updatedFields
    };
    saveRegisteredUsers(users);
  }

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));

  // Simpan data lengkap ke database Supabase (Tabel 'users')
  if (supabase) {
    const sbPayload = {
      id: updatedUser.id,
      name: updatedUser.name,
      store_name: updatedUser.storeName || updatedUser.name,
      display_name: updatedUser.displayName || updatedUser.storeName || updatedUser.name,
      username: updatedUser.username || (updatedUser.storeName ? updatedUser.storeName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user') + Math.floor(100 + Math.random() * 900),
      email: updatedUser.email || null,
      phone: updatedUser.phone || null,
      region: updatedUser.region || 'solo',
      district: updatedUser.district || 'Banjarsari',
      avatar: updatedUser.avatar || null,
      bio: updatedUser.bio || null,
      is_demo: !!updatedUser.isDemo
    };
    if (updatedFields.password) {
      sbPayload.password = updatedFields.password;
    }

    try {
      console.log('[Supabase Query] Menyimpan profil pengguna ke tabel "users"...', sbPayload);
      const { data, error } = await supabase
        .from('users')
        .upsert(sbPayload, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('[Supabase Error] Gagal menyimpan profil user ke tabel users:', error.message || error);
        throw new Error(`Gagal menyimpan ke Supabase: ${error.message || 'Error database'}`);
      } else {
        console.log('[Supabase Success] Profil user berhasil disimpan di tabel users Supabase:', data);
      }
    } catch (sbErr) {
      console.error('[Supabase Exception] Kendala koneksi saat update profil ke Supabase:', sbErr);
      throw sbErr;
    }
  }

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

