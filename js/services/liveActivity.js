/**
 * Live User Activity & Searching Citizens Service - Pusat Jual Beli Solo Raya
 * Menampilkan notifikasi 1 baris tepat di atas kolom pencarian (Fixed Header)
 * Format Teks: "[Jumlah] Warga Solo Raya sedang mencari barang"
 * Refresh otomatis setiap 15 detik:
 * - Jika naik: rentang 0 s/d 15
 * - Jika turun: rentang 0 s/d 5
 * - Digabungkan dengan jumlah pengguna nyata yang sedang daring jika ada
 */

const BASE_SEARCHING_COUNT = 488;
let currentSearchingCount = BASE_SEARCHING_COUNT;
let activityTimer = null;

/**
 * Dapatkan jumlah pengguna nyata yang sedang daring di aplikasi
 */
function getRealOnlineUsers() {
  let realCount = 1;
  try {
    if (localStorage.getItem('pusat_barkas_user')) {
      realCount += 1;
    }
  } catch (e) {}
  return realCount;
}

/**
 * Hitung perubahan angka dinamis setiap 15 detik
 * - Jika naik: rentang 0 sampai 15
 * - Jika turun: rentang 0 sampai 5
 * - Digabungkan dengan pengguna nyata
 */
export function getLiveOnlineCount() {
  // Tentukan apakah fluktuasi naik atau turun
  const isIncrease = Math.random() < 0.52;
  let delta = 0;

  if (isIncrease) {
    // Naik dalam rentang 0 sampai 15
    delta = Math.floor(Math.random() * 16); // 0 s/d 15
  } else {
    // Turun dalam rentang 0 sampai 5
    delta = -Math.floor(Math.random() * 6); // 0 s/d 5 (berkurang)
  }

  currentSearchingCount += delta;

  // Jaga batas wajar agar tetap berfluktuasi seimbang di sekitar target 488
  if (currentSearchingCount < 465) {
    currentSearchingCount = BASE_SEARCHING_COUNT + Math.floor(Math.random() * 6);
  } else if (currentSearchingCount > 520) {
    currentSearchingCount = BASE_SEARCHING_COUNT - Math.floor(Math.random() * 6);
  }

  const realOnline = getRealOnlineUsers();
  return currentSearchingCount + (realOnline - 1);
}

/**
 * Inisialisasi Widget Notifikasi 1 Baris di Atas Kolom Pencarian
 */
export function initLiveActivityWidget() {
  const dock = document.getElementById('live-user-activity-dock');
  const countEl = document.getElementById('live-searching-count');
  const msgEl = document.getElementById('live-user-message');
  const topCountEl = document.getElementById('top-online-count-text');

  if (!dock && !msgEl && !countEl) return;

  // Render nilai awal (488 + pengguna nyata)
  updateSearchingTicker();

  // Refresh otomatis tepat setiap 15 detik (15000ms)
  if (activityTimer) clearInterval(activityTimer);
  activityTimer = setInterval(() => {
    updateSearchingTicker();
  }, 15000);
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
    }, 180);
  } else if (msgEl) {
    msgEl.innerHTML = `
      <span class="text-[10.5px] sm:text-xs font-black text-rose-950 leading-[1.2] truncate">
        <span id="live-searching-count">${count}</span> Warga Solo Raya
      </span>
      <span class="text-[9px] sm:text-[10px] font-semibold text-slate-600 leading-[1.25] pt-0.5 pb-0.5 truncate">
        sedang mencari barang
      </span>
    `;
  }
}

/**
 * Hook pemicu ketika pengguna login/mendaftar (sinkronisasi langsung)
 */
export function notifyUserJustLoggedIn(userName) {
  updateSearchingTicker();
}

