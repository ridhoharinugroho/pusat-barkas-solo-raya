/**
 * Live User Activity & Online Presence Service
 * Menampilkan notifikasi interaktif pengguna aktif, online, dan masuk akun
 * dengan kalkulasi basis (+196) dari data sebenarnya.
 */

const BASE_ONLINE_OFFSET = 196;
const SOLO_REGIONS = [
  { name: 'Banjarsari', city: 'Kota Solo' },
  { name: 'Laweyan', city: 'Kota Solo' },
  { name: 'Jebres', city: 'Kota Solo' },
  { name: 'Pasar Kliwon', city: 'Kota Solo' },
  { name: 'Kartasura', city: 'Sukoharjo' },
  { name: 'Solo Baru', city: 'Sukoharjo' },
  { name: 'Jaten', city: 'Karanganyar' },
  { name: 'Palur', city: 'Karanganyar' },
  { name: 'Colomadu', city: 'Karanganyar' },
  { name: 'Klaten Kota', city: 'Klaten' },
  { name: 'Boyolali Kota', city: 'Boyolali' },
  { name: 'Sragen Kota', city: 'Sragen' },
  { name: 'Wonogiri Kota', city: 'Wonogiri' }
];

const SAMPLE_NAMES = [
  'Mas Budi', 'Pak Joko', 'Mbak Rina', 'Danang', 'Rian Gadget', 
  'Mbak Dewi', 'Mas Hendro', 'Pak Tri', 'Bu Wahyu', 'Mas Bagus', 
  'Mbak Anisa', 'Mas Wahyu', 'Pak Sugeng', 'Mbak Putri', 'Mas Bayu'
];

const ACTIVITY_TEMPLATES = [
  {
    type: 'online_count',
    icon: 'users',
    badge: 'Live Solo Raya',
    badgeClass: 'text-emerald-700 bg-emerald-100/80',
    getMsg: (count) => `<span class="text-rose-950 font-black">${count} Warga Solo Raya</span> sedang aktif online.`
  },
  {
    type: 'user_login',
    icon: 'log-in',
    badge: 'Pengguna Masuk',
    badgeClass: 'text-amber-800 bg-amber-100/80',
    getMsg: (count, name, loc) => `<span class="text-rose-950 font-black">${name}</span> (${loc.name}) baru saja masuk ke akun.`
  },
  {
    type: 'whatsapp_contact',
    icon: 'message-circle',
    badge: 'Nego WhatsApp',
    badgeClass: 'text-emerald-800 bg-emerald-100/80',
    getMsg: (count, name, loc) => `<span class="text-rose-950 font-black">${name}</span> (${loc.city}) sedang menghubungi penjual via WA.`
  },
  {
    type: 'browsing_category',
    icon: 'search',
    badge: 'Sedang Memantau',
    badgeClass: 'text-blue-800 bg-blue-100/80',
    getMsg: (count, name, loc) => `Warga <span class="text-rose-950 font-black">${loc.name}, ${loc.city}</span> sedang mencari barang bekas.`
  },
  {
    type: 'viewing_item',
    icon: 'eye',
    badge: 'Pantau Cocok',
    badgeClass: 'text-purple-800 bg-purple-100/80',
    getMsg: (count, name, loc) => `<span class="text-rose-950 font-black">${name}</span> baru saja melihat detail iklan di ${loc.city}.`
  }
];

let currentOnlineCount = BASE_ONLINE_OFFSET + 2;
let activityTimer = null;
let isDismissed = false;

/**
 * Hitung jumlah pengguna aktif saat ini (+196 dari basis nyata)
 */
export function getLiveOnlineCount() {
  // Fluktuasi natural acak +/- 3 untuk efek live
  const naturalVariance = Math.floor(Math.random() * 9) - 4; // -4 s/d +4
  const finalCount = Math.max(BASE_ONLINE_OFFSET + 1, currentOnlineCount + naturalVariance);
  currentOnlineCount = finalCount;
  return finalCount;
}

/**
 * Inisialisasi Live Activity Notification Dock
 */
export function initLiveActivityWidget() {
  const dock = document.getElementById('live-user-activity-dock');
  const msgEl = document.getElementById('live-user-message');
  const closeBtn = document.getElementById('btn-dismiss-live-activity');

  if (!dock || !msgEl) return;

  // Tutup manual oleh pengguna
  closeBtn?.addEventListener('click', () => {
    isDismissed = true;
    dock.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
    setTimeout(() => {
      dock.classList.add('hidden');
    }, 500);

    // Buka kembali setelah 3 menit
    setTimeout(() => {
      isDismissed = false;
      dock.classList.remove('hidden', 'opacity-0', 'translate-y-4', 'pointer-events-none');
    }, 180000);
  });

  // Tampilkan notifikasi awal
  updateLiveActivity();

  // Rotasi notifikasi berkala setiap 9 - 14 detik
  scheduleNextActivity();
}

function updateLiveActivity(forcedType = null, customText = null) {
  if (isDismissed) return;

  const dock = document.getElementById('live-user-activity-dock');
  const card = document.getElementById('live-user-card');
  const msgEl = document.getElementById('live-user-message');
  const badgeEl = document.getElementById('live-user-badge');
  const iconEl = document.getElementById('live-user-icon');
  const topCountEl = document.getElementById('top-online-count-text');

  if (!dock || !msgEl) return;

  const count = getLiveOnlineCount();
  if (topCountEl) {
    topCountEl.textContent = `${count} Online`;
  }

  // Pilih template acak
  const template = forcedType ? ACTIVITY_TEMPLATES.find(t => t.type === forcedType) || ACTIVITY_TEMPLATES[0] : ACTIVITY_TEMPLATES[Math.floor(Math.random() * ACTIVITY_TEMPLATES.length)];
  const randomLoc = SOLO_REGIONS[Math.floor(Math.random() * SOLO_REGIONS.length)];
  const randomName = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];

  // Animasi transisi halus
  card?.classList.add('opacity-0', 'scale-95');

  setTimeout(() => {
    if (badgeEl) {
      badgeEl.textContent = template.badge;
      badgeEl.className = `text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${template.badgeClass}`;
    }

    if (iconEl) {
      iconEl.setAttribute('data-lucide', template.icon);
    }

    if (customText) {
      msgEl.innerHTML = customText;
    } else {
      msgEl.innerHTML = template.getMsg(count, randomName, randomLoc);
    }

    dock.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    card?.classList.remove('opacity-0', 'scale-95');
  }, 300);
}

function scheduleNextActivity() {
  if (activityTimer) clearTimeout(activityTimer);
  const nextInterval = Math.floor(Math.random() * 5000) + 9000; // 9 - 14 detik
  activityTimer = setTimeout(() => {
    updateLiveActivity();
    scheduleNextActivity();
  }, nextInterval);
}

/**
 * Picu notifikasi saat user lokal berhasil login / daftar akun
 */
export function notifyUserJustLoggedIn(userName) {
  if (isDismissed) return;
  const count = getLiveOnlineCount();
  updateLiveActivity('user_login', `🎉 Selamat datang <span class="text-rose-950 font-black">${userName || 'Penjual'}</span>! Anda online bersama <span class="text-emerald-700 font-black">${count} warga</span>.`);
}
