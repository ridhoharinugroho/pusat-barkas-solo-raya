/**
 * Service Autentikasi Google & Pengaturan Nama Akun Publik (Display Name)
 * Pusat Barkas Solo Raya
 */

const STORAGE_KEY_USER = 'pusat_barkas_user';
const listeners = [];

// Akun Google preset untuk demo instan
export const PRESET_GOOGLE_ACCOUNTS = [
  {
    id: "g-101",
    googleId: "google-1122334455",
    name: "Budi Santoso",
    email: "budi.santoso.solo@gmail.com",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80",
    suggestedDisplayName: "Budi Barkas Mangkubumen",
    defaultPhone: "081223456789",
    defaultRegion: "solo"
  },
  {
    id: "g-102",
    googleId: "google-9988776655",
    name: "Siti Rahmawati",
    email: "siti.rahma.kra@gmail.com",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
    suggestedDisplayName: "Mbak Siti Jaten Kra",
    defaultPhone: "085728990011",
    defaultRegion: "karanganyar"
  },
  {
    id: "g-103",
    googleId: "google-7766554433",
    name: "Danang Prasetyo",
    email: "danang.prasetyo@gmail.com",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    suggestedDisplayName: "Danang Thrift SoloBaru",
    defaultPhone: "089677889900",
    defaultRegion: "sukoharjo"
  }
];

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading auth state:", err);
    return null;
  }
}

export function isUserLoggedIn() {
  return getCurrentUser() !== null;
}

export function subscribeAuth(callback) {
  listeners.push(callback);
  // initial call
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
 * Login dengan Google
 * Mengembalikan user object dan status isNewProfile
 */
export function loginWithGoogle(googleAccount) {
  // Cek apakah user sebelumnya sudah pernah ada di storage
  const existingUser = getCurrentUser();
  const isSameUser = existingUser && existingUser.email === googleAccount.email;

  const user = {
    id: googleAccount.id || `user-g-${Date.now()}`,
    googleId: googleAccount.googleId || `g-${Date.now()}`,
    email: googleAccount.email,
    googleName: googleAccount.name,
    avatar: googleAccount.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(googleAccount.email)}`,
    // Nama Akun Publik (Display Name) yang akan ditempel di setiap iklan
    displayName: isSameUser && existingUser.displayName ? existingUser.displayName : (googleAccount.suggestedDisplayName || googleAccount.name),
    phone: isSameUser && existingUser.phone ? existingUser.phone : (googleAccount.defaultPhone || ''),
    region: isSameUser && existingUser.region ? existingUser.region : (googleAccount.defaultRegion || 'solo'),
    bio: isSameUser && existingUser.bio ? existingUser.bio : 'Penjual & Pembeli Barkas Solo Raya',
    isProfileConfigured: isSameUser ? !!existingUser.isProfileConfigured : false,
    loggedInAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  notifySubscribers();
  return user;
}

/**
 * Update Nama Tampilan / Nama Akun Publik & Kontak WA
 */
export function updateProfile({ displayName, phone, region, bio }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Pengguna belum login.');

  const updatedUser = {
    ...currentUser,
    displayName: displayName.trim(),
    phone: phone ? phone.trim() : currentUser.phone,
    region: region || currentUser.region,
    bio: bio ? bio.trim() : currentUser.bio,
    isProfileConfigured: true,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  notifySubscribers();
  return updatedUser;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY_USER);
  notifySubscribers();
}
