/**
 * Live User Activity & Searching Citizens Service - Pusat Barkas Solo Raya
 * Menampilkan notifikasi 1 baris tepat di bawah kolom pencarian (Fixed Header)
 * Format: "[Jumlah] warga solo sedang mencari barang"
 * Refresh otomatis setiap 20 detik secara dinamis dalam rentang 0-50 pengunjung (tambah/kurang) + akumulasi pengguna nyata
 */

const BASE_SEARCHING_USERS = 387;
let currentSearchingCount = BASE_SEARCHING_USERS;
let activityTimer = null;

/**
 * Hitung jumlah warga yang sedang mencari barang (rentang dinamis +/- 25 s/d 50 + pengguna nyata)
 */
export function getLiveOnlineCount() {
  // Variasi dinamis bertambah/berkurang dalam rentang 0 sampai 50 pengunjung
  const dynamicVariance = Math.floor(Math.random() * 51) - 25; // -25 s/d +25 (total swing 50)
  
  // Akumulasi pengguna nyata yang sedang daring/login jika ada
  let realOnlineUsers = 1;
  try {
    if (localStorage.getItem('pusat_barkas_user')) {
      realOnlineUsers += 1;
    }
  } catch (e) {}

  currentSearchingCount = Math.max(100, BASE_SEARCHING_USERS + dynamicVariance + (realOnlineUsers - 1));
  return currentSearchingCount;
}

/**
 * Inisialisasi Widget Notifikasi 1 Baris di Bawah Kolom Pencarian
 */
export function initLiveActivityWidget() {
  const dock = document.getElementById('live-user-activity-dock');
  const countEl = document.getElementById('live-searching-count');
  const msgEl = document.getElementById('live-user-message');
  const topCountEl = document.getElementById('top-online-count-text');

  if (!dock && !msgEl && !countEl) return;

  // Render nilai awal
  updateSearchingTicker();

  // Refresh otomatis tepat setiap 20 detik (20000ms)
  if (activityTimer) clearInterval(activityTimer);
  activityTimer = setInterval(() => {
    updateSearchingTicker();
  }, 20000);
}

function updateSearchingTicker() {
  const count = getLiveOnlineCount();
  const countEl = document.getElementById('live-searching-count');
  const msgEl = document.getElementById('live-user-message');
  const topCountEl = document.getElementById('top-online-count-text');

  if (topCountEl) {
    topCountEl.textContent = `${count} Online`;
  }

  if (countEl) {
    // Animasi transisi angka halus
    countEl.style.opacity = '0.3';
    setTimeout(() => {
      countEl.textContent = count;
      countEl.style.opacity = '1';
    }, 200);
  } else if (msgEl) {
    msgEl.innerHTML = `<span id="live-searching-count" class="font-black text-rose-950">${count}</span> warga solo sedang mencari barang`;
  }
}

/**
 * Hook pemicu ketika pengguna login/mendaftar (sinkronisasi langsung)
 */
export function notifyUserJustLoggedIn(userName) {
  updateSearchingTicker();
}
