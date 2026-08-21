/**
 * Service Autentikasi Pengguna & Penjual Pusat Barkas Solo Raya
 * Login & Registrasi Lengkap dengan No. WA / Email / Username + Password
 * Reset Password via Email & Penyimpanan Sesi Persisten
 */

const STORAGE_KEY_USER = 'pusat_barkas_user';
const STORAGE_KEY_REGISTERED_USERS = 'pusat_barkas_registered_users';
const listeners = [];

// Akun Penjual Awal (Default Seeded Users) untuk memudahkan eksplorasi
const DEFAULT_REGISTERED_USERS = [
  {
    id: "user-101",
    name: "Danang Prasetyo",
    storeName: "Danang Barkas Manahan",
    displayName: "Danang Barkas Manahan",
    username: "danangsolo",
    email: "danang.solo@gmail.com",
    phone: "081228198765",
    region: "solo",
    district: "Banjarsari",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    bio: "Jual beli barkas sepeda, elektronik, dan hobi area Manahan Solo. Fast response WA.",
    createdAt: "2026-07-01T08:00:00.000Z"
  },
  {
    id: "user-102",
    name: "Joko Supriyanto",
    storeName: "Toko Barkas Pak Joko",
    displayName: "Toko Barkas Pak Joko",
    username: "jokokra",
    email: "joko.kra@gmail.com",
    phone: "085725012345",
    region: "karanganyar",
    district: "Jaten",
    password: "barkas123",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80",
    bio: "Pusat perabot rumah tangga & elektronik seken berkualitas Karanganyar.",
    createdAt: "2026-07-05T09:30:00.000Z"
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
    createdAt: "2026-07-10T11:15:00.000Z"
  }
];

let pendingResetState = null;

/**
 * Inisialisasi dan Dapatkan Daftar Seluruh Akun Terdaftar
 */
export function getRegisteredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(DEFAULT_REGISTERED_USERS));
      return [...DEFAULT_REGISTERED_USERS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(DEFAULT_REGISTERED_USERS));
      return [...DEFAULT_REGISTERED_USERS];
    }
    return parsed;
  } catch (err) {
    return [...DEFAULT_REGISTERED_USERS];
  }
}

export function saveRegisteredUsers(users) {
  localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
}

/**
 * Cari Akun berdasarkan No. WA, Email, atau Username
 */
export function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const cleanId = identifier.trim().toLowerCase();
  const cleanPhone = identifier.replace(/\D/g, '');
  const users = getRegisteredUsers();

  return users.find((u) => {
    const emailMatch = u.email && u.email.toLowerCase() === cleanId;
    const usernameMatch = u.username && u.username.toLowerCase() === cleanId;
    const storeMatch = u.storeName && u.storeName.toLowerCase() === cleanId;
    const uPhoneClean = u.phone ? u.phone.replace(/\D/g, '') : '';
    const phoneMatch = cleanPhone.length >= 8 && uPhoneClean.length >= 8 && (uPhoneClean === cleanPhone || uPhoneClean.endsWith(cleanPhone) || cleanPhone.endsWith(uPhoneClean));
    return emailMatch || usernameMatch || storeMatch || phoneMatch;
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

/**
 * 1. LOGIN PENGGUNA (No. WA / Email / Username + Password)
 */
export function loginUser(identifier, password) {
  if (!identifier || identifier.trim() === '') {
    throw new Error("Nomor WhatsApp, Email, atau Nama Pengguna harus diisi.");
  }
  if (!password || password.trim() === '') {
    throw new Error("Password harus diisi.");
  }

  const user = findUserByIdentifier(identifier);
  if (!user) {
    throw new Error("Akun tidak ditemukan. Periksa kembali No. WA / Email / Username Anda atau silakan Daftar akun baru.");
  }

  if (user.password !== password) {
    throw new Error("Password yang Anda masukkan salah. Silakan coba lagi atau gunakan fitur Lupa Password.");
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
    bio: `Penjual Terverifikasi Pusat Barkas Solo Raya (${district.trim()}, ${region.toUpperCase()})`,
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
    throw new Error(`Akun dengan email "${cleanEmail}" tidak ditemukan di database Pusat Barkas Solo Raya.`);
  }

  // Generate 6-Digit Reset Code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  pendingResetState = {
    email: cleanEmail,
    resetCode: resetCode,
    user: user,
    createdAt: Date.now()
  };

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

  pendingResetState = null;
  return { success: true, user: users[index] };
}

/**
 * 4. UPDATE PROFIL LENGKAP (TAB PROFIL AKUN)
 * Mendukung Edit Nama, No. HP/WA, Ganti Email, Ganti Password, Wilayah, Bio & Avatar
 */
export function updateProfile({ name, displayName, storeName, email, phone, region, district, bio, avatar, newPassword }) {
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
