/**
 * Toko Saya Standalone Page Controller
 * Pusat Jual Beli Solo Raya 7 Wilayah
 */
import { 
  initializeStorage, 
  getAllListings, 
  getMyListings, 
  getListingById,
  saveListing,
  updateListing,
  getSellerStats, 
  getSellerReviews, 
  getSellerRatingStats, 
  checkSellerVerification,
  updateListingStatus,
  deleteListing,
  toggleHideSellerReview,
  deleteSellerReview
} from './services/storage.js';
import { sbUploadMultipleImages } from './services/supabaseDB.js';

import { 
  getCurrentUser, 
  getUserById,
  isUserLoggedIn, 
  updateProfile,
  syncAllUsersToCloudOnStartup,
  logout,
  isDemoUser
} from './services/auth.js';

import { 
  formatRupiah, 
  formatDisplayPhone 
} from './services/whatsapp.js';

import { 
  SOLO_RAYA_REGIONS,
  getRegionById, 
  getDistrictsByRegionId 
} from './data/regions.js';

import { supabase } from './lib/supabase.js';

const CURRENT_SW_VERSION = '20260830_v55';

let activeStoreFilter = 'all';
let currentUser = null;
let uploadedImages = [];

function populateFormRegions() {
  try {
    const regSelect = document.getElementById('form-region-select');
    const distSelect = document.getElementById('form-district-select');
    if (!regSelect) return;

    regSelect.innerHTML = '';
    SOLO_RAYA_REGIONS.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.name} (${r.shortName})`;
      regSelect.appendChild(opt);
    });

    const updateDistricts = (regId) => {
      if (!distSelect) return;
      const districts = getDistrictsByRegionId(regId) || [];
      distSelect.innerHTML = '';
      districts.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `Kec. ${d}`;
        distSelect.appendChild(opt);
      });
    };

    regSelect.onchange = () => {
      updateDistricts(regSelect.value);
    };

    // Set default initial districts
    if (SOLO_RAYA_REGIONS.length > 0) {
      const defaultReg = currentUser?.region || 'karanganyar';
      regSelect.value = defaultReg;
      updateDistricts(defaultReg);
    }
  } catch (err) {
    console.warn('[populateFormRegions error]', err);
  }
}

async function initTokoSayaPage() {
  try {
    initializeStorage();
  } catch (e) {
    console.warn('[initializeStorage Error]', e);
  }
  
  // Safely ensure all modal elements start completely hidden and unclickable
  try {
    document.querySelectorAll('.fixed[id^="modal-"]').forEach((m) => {
      m.classList.add('hidden');
      m.style.display = 'none';
    });
  } catch (e) {}

  // 1. Initial Resolution from localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const isJustLoggedOut = urlParams.has('logout') || sessionStorage.getItem('solosatset_just_logged_out') === 'true';

  if (isJustLoggedOut) {
    localStorage.removeItem('pusat_barkas_user');
    localStorage.removeItem('solosatset_auth_user');
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  let sessionUser = getCurrentUser();
  if (!sessionUser) {
    console.log('[Toko Saya] Pengguna belum masuk/login. Mengarahkan kembali ke Beranda.');
    window.location.href = 'index.html';
    return;
  }
  currentUser = sessionUser;

  // Render initial UI immediately so there's no layout flash
  try { renderAuthHeader(); } catch (e) { console.warn('[renderAuthHeader]', e); }
  try { renderStoreShowcase(); } catch (e) { console.warn('[renderStoreShowcase]', e); }
  try { renderStoreReviews(); } catch (e) { console.warn('[renderStoreReviews]', e); }
  try { renderStoreListings(activeStoreFilter); } catch (e) { console.warn('[renderStoreListings]', e); }
  try { populateFormRegions(); } catch (e) { console.warn('[populateFormRegions]', e); }
  try { initEventListeners(); } catch (e) { console.warn('[initEventListeners]', e); }
  try { initBackHandler(); } catch (e) { console.warn('[initBackHandler]', e); }
  try { initServiceWorker(); } catch (e) { console.warn('[initServiceWorker]', e); }

  if (window.lucide) {
    try { window.lucide.createIcons(); } catch (e) {}
  }

  // 2. Fetch fresh dynamic user data from Supabase & cloud sync
  try {
    await syncAllUsersToCloudOnStartup();

    if (supabase && currentUser && (currentUser.id || currentUser.email)) {
      const activeId = currentUser.id;
      const activeEmail = currentUser.email;
      
      const { data: sbUser, error } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq.${activeId},email.eq.${activeEmail}`)
        .maybeSingle();

      if (!error && sbUser) {
        const sbStatus = (sbUser.status || 'active').toLowerCase();
        if (sbStatus === 'deleted' || sbUser.deleted_at) {
          logout();
          window.location.href = 'index.html';
          return;
        }

        currentUser = {
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
        localStorage.setItem('pusat_barkas_user', JSON.stringify(currentUser));
        
        // Re-render UI with fresh Supabase data
        try { renderAuthHeader(); } catch (e) {}
        try { renderStoreShowcase(); } catch (e) {}
        try { renderStoreReviews(); } catch (e) {}
        try { renderStoreListings(activeStoreFilter); } catch (e) {}
        if (window.lucide) {
          try { window.lucide.createIcons(); } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.warn('[Toko Saya Dynamic Fetch Notice]', e);
  }
}

function renderAuthHeader() {
  const container = document.getElementById('auth-nav-container');
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div class="flex items-center gap-2 p-1 pr-2.5 bg-slate-100 rounded-full border border-slate-200">
      <img src="${currentUser.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(currentUser.email || 'user')}" alt="${currentUser.storeName || currentUser.name}" class="w-7 h-7 rounded-full object-cover border border-slate-300">
      <span class="text-xs font-bold text-slate-800 hidden sm:inline truncate max-w-[120px]">${currentUser.storeName || currentUser.name}</span>
    </div>
  `;
}

function renderStoreShowcase() {
  if (!currentUser) return;
  const user = currentUser;

  const verResult = checkSellerVerification(user);
  const stats = getSellerStats(user.id);
  const ratingStats = getSellerRatingStats(user.id);

  // Profile Header Details
  const avatarEl = document.getElementById('my-store-avatar');
  if (avatarEl) avatarEl.src = user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(user.email || 'user');

  const nameEl = document.getElementById('my-store-name');
  if (nameEl) nameEl.textContent = user.storeName || user.name;

  const locEl = document.getElementById('my-store-location');
  if (locEl) {
    const userRegObj = getRegionById(user.region);
    let regName = userRegObj ? (userRegObj.shortName || userRegObj.name.replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim()) : (user.region || 'Karanganyar');
    regName = regName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const distClean = (user.district || '').trim().replace(/\.+$/, '').replace(/^Kec\.?\s*/i, '');
    const capDist = distClean ? distClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
    locEl.textContent = capDist ? `${regName} • ${capDist}` : regName;
  }

  const phoneEl = document.getElementById('my-store-phone');
  if (phoneEl) phoneEl.textContent = user.phone ? `WA: ${formatDisplayPhone(user.phone)}` : 'WA: Belum diatur';

  const createdEl = document.getElementById('my-store-created');
  if (createdEl) {
    const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
    const dateStr = !isNaN(createdDate) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '27 Agu 2026';
    createdEl.textContent = `Bergabung: ${dateStr}`;
  }

  // Highlight Sold Tag
  const soldCountText = document.getElementById('my-store-sold-count-text');
  if (soldCountText) soldCountText.textContent = `${stats.soldCount} Terjual`;

  // Dynamic Badge
  const badgeContainer = document.getElementById('my-store-badge-container');
  const isDemo = isDemoUser(user);

  if (badgeContainer) {
    let badgesHtml = '';
    if (isDemo) {
      badgesHtml += `
        <span class="bg-amber-400 text-slate-950 border border-amber-500 text-[11px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
          <i data-lucide="tag" class="w-3.5 h-3.5"></i>
          <span>AKUN DEMO / PERAGA</span>
        </span>
      `;
    }
    if (verResult.isVerified) {
      badgesHtml += `
        <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
          <span>🛡️ Toko Lokal ${user.region ? user.region.toUpperCase() : 'Solo'} Terverifikasi</span>
        </span>
      `;
    } else if (!isDemo) {
      badgesHtml += `
        <span class="bg-slate-700/80 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-300"></i>
          <span>Toko Member (Belum Terverifikasi)</span>
        </span>
      `;
    }
    badgeContainer.innerHTML = badgesHtml;
  }

  // Verification Checklist Box
  const verTitle = document.getElementById('my-verification-title');
  const verIcon = document.getElementById('my-verification-icon');
  if (verTitle) verTitle.textContent = verResult.isVerified 
    ? "Selamat! Toko kamu telah memenuhi 5/5 Syarat Badge Terverifikasi" 
    : `Syarat Badge Terverifikasi: ${verResult.passedCount}/5 Kriteria Terpenuhi`;

  if (verIcon) {
    verIcon.setAttribute('data-lucide', verResult.isVerified ? 'shield-check' : 'shield-alert');
    verIcon.className = verResult.isVerified ? "w-4 h-4 text-emerald-400" : "w-4 h-4 text-amber-400";
  }

  const c = verResult.criteria;
  const textRev = document.getElementById('check-text-reviews');
  if (textRev) textRev.innerHTML = `1. Min 20 Ulasan Positif: <b class="${c.reviewsPositive.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.reviewsPositive.current}/20 ulasan</b>`;

  const textRat = document.getElementById('check-text-rating');
  if (textRat) textRat.innerHTML = `2. Rating Rata-rata Min 4.5: <b class="${c.averageRating.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.averageRating.current.toFixed(1)} / 5.0</b>`;

  const textList = document.getElementById('check-text-listings');
  if (textList) textList.innerHTML = `3. Posting Min 10 Barang: <b class="${c.totalListings.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.totalListings.current}/10 barang</b>`;

  const textProf = document.getElementById('check-text-profile');
  if (textProf) textProf.innerHTML = `4. Profil Lengkap: <b class="${c.profileComplete.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.profileComplete.passed ? 'Lengkap (Foto, Lokasi, WA)' : 'Belum Lengkap'}</b>`;

  const textAge = document.getElementById('check-text-age');
  if (textAge) textAge.innerHTML = `5. Usia Akun Min 30 Hari: <b class="${c.accountAgeDays.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.accountAgeDays.current}/30 hari</b>`;

  // 5 Metric Cards
  const statTotal = document.getElementById('my-stat-total');
  const statAvailable = document.getElementById('my-stat-available');
  const statBooked = document.getElementById('my-stat-booked');
  const statSold = document.getElementById('my-stat-sold');
  const statRating = document.getElementById('my-stat-rating');
  const statRevLabel = document.getElementById('my-stat-reviews-label');

  if (statTotal) statTotal.textContent = stats.totalListings;
  if (statAvailable) statAvailable.textContent = stats.availableCount;
  if (statBooked) statBooked.textContent = stats.bookedCount;
  if (statSold) statSold.textContent = stats.soldCount;
  if (statRating) statRating.textContent = ratingStats.totalReviews === 0 ? "⭐ 0.0" : `⭐ ${ratingStats.averageRating.toFixed(1)}`;
  if (statRevLabel) statRevLabel.textContent = `${ratingStats.totalReviews} Ulasan`;

  // Filter Tab Counts
  const countAll = document.getElementById('store-count-all');
  const countAvail = document.getElementById('store-count-available');
  const countBooked = document.getElementById('store-count-booked');
  const countSold = document.getElementById('store-count-sold');

  if (countAll) countAll.textContent = stats.totalListings;
  if (countAvail) countAvail.textContent = stats.availableCount;
  if (countBooked) countBooked.textContent = stats.bookedCount;
  if (countSold) countSold.textContent = stats.soldCount;
}

function renderStoreReviews() {
  if (!currentUser) return;
  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
  const ratingStats = getSellerRatingStats(currentUser.id);
  const reviews = getSellerReviews(currentUser.id, isAdmin);

  const summaryBadge = document.getElementById('my-store-rating-summary-badge');
  const container = document.getElementById('my-store-reviews-container');
  const emptyView = document.getElementById('my-store-reviews-empty');

  if (summaryBadge) {
    summaryBadge.textContent = ratingStats.totalReviews === 0 
      ? "⭐ 0.0 (0 Ulasan)" 
      : `⭐ ${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalReviews} Ulasan)`;
  }

  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }

  emptyView?.classList.add('hidden');

  let html = '';
  reviews.forEach((r) => {
    const d = new Date(r.createdAt);
    const dStr = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const isHidden = !!r.isHidden;
    
    html += `
      <div class="p-3.5 bg-slate-950/70 rounded-2xl border ${isHidden ? 'border-purple-800 bg-purple-950/30' : 'border-slate-800'} text-xs space-y-2.5 shadow-2xs">
        ${isHidden ? `
          <div class="flex items-center justify-between p-1.5 px-2 bg-purple-950 text-purple-200 border border-purple-800 rounded-lg text-[10px] font-bold">
            <span class="flex items-center gap-1"><i data-lucide="eye-off" class="w-3 h-3 text-purple-400"></i> Ulasan Disembunyikan (Hanya Admin)</span>
            <span class="text-purple-300">Spam/Kompetitor</span>
          </div>
        ` : ''}

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-black text-white">${r.buyerName}</span>
            <span class="text-[10px] text-slate-400">${dStr}</span>
          </div>
          <span class="text-amber-400 font-black tracking-widest">${'★'.repeat(r.rating)}</span>
        </div>
        <p class="text-slate-300 font-medium">"${r.comment}"</p>
        ${r.productImage ? `
          <div class="flex items-center gap-2.5 p-2 bg-slate-900/90 border border-slate-800 rounded-xl">
            <img src="${r.productImage}" alt="Foto Produk yang Dibeli" class="w-12 h-12 rounded-lg object-cover border border-slate-700 shadow-2xs flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" onclick="window.open('${r.productImage}', '_blank')">
            <div class="space-y-0.5 min-w-0">
              <span class="inline-flex items-center gap-1 text-[9.5px] font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-900/50">
                <i data-lucide="camera" class="w-3 h-3 text-rose-400"></i>
                <span>Foto Produk yang Dibeli</span>
              </span>
              <p class="text-[10px] text-slate-400 font-medium truncate">Bukti foto barang saat transaksi COD</p>
            </div>
          </div>
        ` : ''}

        ${isAdmin ? `
          <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
            <span class="text-[10.5px] font-bold text-rose-400 flex items-center gap-1"><i data-lucide="shield-alert" class="w-3 h-3"></i> Moderasi:</span>
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                data-action="store-toggle-hide-review" 
                data-id="${r.id}"
                class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <i data-lucide="${isHidden ? 'eye' : 'eye-off'}" class="w-3 h-3"></i>
                <span>${isHidden ? 'Buka' : 'Sembunyi'}</span>
              </button>
              <button 
                type="button" 
                data-action="store-delete-review" 
                data-id="${r.id}"
                class="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-[10.5px] font-bold border border-rose-800 flex items-center gap-1 cursor-pointer"
              >
                <i data-lucide="trash-2" class="w-3 h-3"></i>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;

  if (isAdmin) {
    container.querySelectorAll('[data-action="store-toggle-hide-review"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        toggleHideSellerReview(id);
        renderStoreReviews();
      });
    });

    container.querySelectorAll('[data-action="store-delete-review"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (confirm("Hapus ulasan toko ini secara permanen?")) {
          deleteSellerReview(id);
          renderStoreReviews();
        }
      });
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function renderStoreListings(filter = 'all') {
  const container = document.getElementById('my-listings-container');
  const emptyView = document.getElementById('my-listings-empty');
  if (!container || !currentUser) return;

  const myListings = getMyListings(currentUser.id);

  let displayListings = myListings;
  if (filter === 'available') {
    displayListings = myListings.filter((l) => !l.isSold && l.status !== 'sold' && l.status !== 'booked');
  } else if (filter === 'booked') {
    displayListings = myListings.filter((l) => l.status === 'booked');
  } else if (filter === 'sold') {
    displayListings = myListings.filter((l) => l.isSold || l.status === 'sold');
  }

  if (displayListings.length === 0) {
    container.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }

  emptyView?.classList.add('hidden');

  let html = '';
  displayListings.forEach((item) => {
    const region = getRegionById(item.regionId);
    const regionName = region ? region.shortName : item.regionId;
    const itemStatus = item.status || (item.isSold ? 'sold' : 'available');

    let statusBorderColor = 'border-slate-800 bg-slate-900/90';
    if (itemStatus === 'sold') {
      statusBorderColor = 'border-rose-900/40 bg-rose-950/20';
    } else if (itemStatus === 'booked') {
      statusBorderColor = 'border-amber-900/40 bg-amber-950/20';
    }

    html += `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border ${statusBorderColor} shadow-xl hover:border-slate-700 transition-all bg-slate-900/90 backdrop-blur-md">
        
        <!-- Left: Image & Content -->
        <div class="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
          <div class="relative flex-shrink-0">
            <img src="${(Array.isArray(item.images) && item.images[0]) ? item.images[0] : 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'}" alt="${item.title}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-slate-800 shadow-md">
            <!-- Small Status Indicator Dot on Image -->
            <span class="absolute top-1.5 left-1.5 w-3.5 h-3.5 rounded-full border-2 border-slate-950 shadow-xs ${
              itemStatus === 'sold' ? 'bg-rose-500' : itemStatus === 'booked' ? 'bg-amber-400' : 'bg-emerald-400'
            }" title="Status: ${itemStatus === 'sold' ? 'Terjual' : itemStatus === 'booked' ? 'Booked' : 'Tersedia'}"></span>
          </div>
          
          <div class="flex-1 min-w-0 space-y-1.5">
            <!-- 1. Nama Barang Prominen di Bagian Paling Atas (User Requirement #1) -->
            <h3 class="text-sm sm:text-base font-black text-white leading-snug line-clamp-2 hover:text-amber-300 transition-colors" title="${item.title}">
              ${item.title}
            </h3>

            <!-- 2. Harga & Opsi Nego -->
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm sm:text-base font-black text-amber-300 tracking-tight">${formatRupiah(item.price)}</span>
              <span class="text-[10px] font-bold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700">
                ${item.negoType === 'pas' ? 'Harga Pas / Nett' : 'Bisa Nego'}
              </span>
              <span class="text-[10px] font-bold ${item.paymentMethod === 'in_store' ? 'text-sky-300 bg-sky-950/60 border-sky-800/60' : 'text-emerald-300 bg-emerald-950/60 border-emerald-800/60'} px-2 py-0.5 rounded-lg border">
                ${item.paymentMethod === 'in_store' ? 'In Store' : 'COD'}
              </span>
            </div>

            <!-- 3. Lokasi & Tayangan (Vektor Icon Minimalis) -->
            <div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap pt-0.5">
              <span class="flex items-center gap-1 text-[11px] font-semibold text-slate-300">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-400 flex-shrink-0"></i>
                <span>${regionName}${item.district ? ' • ' + item.district : ''}</span>
              </span>
              <span class="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                <i data-lucide="eye" class="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0"></i>
                <span>${item.views || 1}x dilihat</span>
              </span>
            </div>

            ${item.codPoint ? `
              <div class="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                <i data-lucide="navigation" class="w-3 h-3 text-emerald-400 flex-shrink-0"></i>
                <span class="truncate">Titik: ${item.codPoint}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Right Controls: Status Modal Trigger, Edit Button, Delete Button -->
        <div class="flex items-center gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 flex-shrink-0 self-end md:self-center">
          
          <!-- Status Modal Trigger Button (Safe, Centered Modal Popup & Dropup Indicator) -->
          <button 
            type="button" 
            data-action="open-status-modal" 
            data-id="${item.id}"
            data-title="${item.title.replace(/"/g, '&quot;')}"
            data-current-status="${itemStatus}"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
              itemStatus === 'sold' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:border-rose-400/60 hover:bg-rose-500/25' :
              itemStatus === 'booked' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/25' :
              'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/25'
            }"
            title="Klik untuk Mengubah Status Barang"
          >
            <span class="w-2 h-2 rounded-full ${
              itemStatus === 'sold' ? 'bg-rose-400' : itemStatus === 'booked' ? 'bg-amber-400' : 'bg-emerald-400'
            }"></span>
            <span>${itemStatus === 'sold' ? 'Terjual' : itemStatus === 'booked' ? 'Booked' : 'Tersedia'}</span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400"></i>
          </button>

          <!-- Edit Button (User Requirement #2: Direct In-Page Edit Modal) -->
          <button 
            type="button" 
            data-action="edit-listing" 
            data-id="${item.id}"
            class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border border-slate-700 hover:border-amber-400/40"
            title="Sunting / Edit Rincian Iklan"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit</span>
          </button>
          
          <!-- Delete Button -->
          <button 
            type="button" 
            data-action="delete-listing" 
            data-id="${item.id}"
            class="p-2 text-slate-400 hover:text-rose-300 hover:bg-rose-950/60 rounded-xl transition-all cursor-pointer border border-slate-800 hover:border-rose-900/60 shadow-xs"
            title="Hapus Iklan"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

      </div>
    `;
  });

  container.innerHTML = html;

  // Open status modal event
  container.querySelectorAll('[data-action="open-status-modal"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      const currentStatus = btn.getAttribute('data-current-status');
      if (id) {
        openItemStatusModal(id, title, currentStatus);
      }
    });
  });

  // Edit listing event (In-Page Modal)
  container.querySelectorAll('[data-action="edit-listing"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const id = btn.getAttribute('data-id');
      if (id) {
        openEditListingModal(id);
      }
    });
  });

  // Delete listing event
  container.querySelectorAll('[data-action="delete-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Apakah kamu yakin ingin menghapus barang jualan ini dari etalase toko kamu?")) {
        deleteListing(id);
        renderStoreShowcase();
        renderStoreListings(activeStoreFilter);
        showToast("Barang jualan berhasil dihapus.", "info");
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

const FORM_CATEGORY_META = {
  'elektronik': { name: 'Elektronik & Gadget', icon: 'smartphone' },
  'kendaraan': { name: 'Kendaraan & Otomotif', icon: 'bike' },
  'perabot': { name: 'Perabot & Rumah Tangga', icon: 'armchair' },
  'pakaian': { name: 'Pakaian & Aksesoris', icon: 'shirt' },
  'kuliner': { name: 'Makanan & Minuman', icon: 'utensils' },
  'bayi-anak': { name: 'Perlengkapan Bayi & Anak', icon: 'baby' },
  'pertukangan': { name: 'Pertukangan & Bangunan', icon: 'hammer' },
  'hobi': { name: 'Hobi, Musik & Olahraga', icon: 'trophy' },
  'hewan': { name: 'Hewan & Perlengkapan', icon: 'cat' },
  'alat-sekolah': { name: 'Peralatan Sekolah', icon: 'book-open' },
  'perawatan-diri': { name: 'Perawatan Diri', icon: 'sparkles' },
  'properti': { name: 'Properti', icon: 'building-2' },
  'jasa': { name: 'Jasa', icon: 'wrench' },
  'lainnya': { name: 'Lain-lain / Aneka Barang', icon: 'package' }
};

const FORM_CONDITION_META = {
  'new': { name: 'Baru', icon: 'sparkles' },
  'like_new': { name: 'Seperti Baru', icon: 'gem' },
  'good': { name: 'Mulus / Normal', icon: 'check-circle-2' },
  'fair': { name: 'Wajar Pemakaian', icon: 'clock' },
  'repair': { name: 'Butuh Servis / Bahan', icon: 'wrench' }
};

function selectFormCategory(catId) {
  const selectedId = catId || 'elektronik';
  const input = document.getElementById('form-input-category');
  if (input) input.value = selectedId;

  const meta = FORM_CATEGORY_META[selectedId] || { name: 'Elektronik & Gadget', icon: 'smartphone' };
  
  const textEl = document.getElementById('category-trigger-text');
  if (textEl) textEl.textContent = meta.name;

  const iconWrapper = document.getElementById('category-trigger-icon-wrapper');
  if (iconWrapper) {
    iconWrapper.innerHTML = `<i data-lucide="${meta.icon}" id="category-trigger-icon" class="w-3.5 h-3.5"></i>`;
  }

  // Update visual selection in modal picker
  document.querySelectorAll('.picker-item-category').forEach((btn) => {
    const isSelected = btn.getAttribute('data-id') === selectedId;
    const checkDot = btn.querySelector('.check-dot');
    const checkBox = btn.querySelector('.check-box');
    const iconBox = btn.querySelector('.item-icon-box');
    const title = btn.querySelector('.item-title');

    if (isSelected) {
      btn.className = "picker-item-category w-full px-3.5 py-2.5 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-category w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function selectFormCondition(condId) {
  const selectedId = condId || 'good';
  const input = document.getElementById('form-input-condition');
  if (input) input.value = selectedId;

  const meta = FORM_CONDITION_META[selectedId] || { name: 'Mulus / Normal', icon: 'check-circle-2' };

  const textEl = document.getElementById('condition-trigger-text');
  if (textEl) textEl.textContent = meta.name;

  const iconWrapper = document.getElementById('condition-trigger-icon-wrapper');
  if (iconWrapper) {
    iconWrapper.innerHTML = `<i data-lucide="${meta.icon}" id="condition-trigger-icon" class="w-3.5 h-3.5"></i>`;
  }

  // Update visual selection in modal picker
  document.querySelectorAll('.picker-item-condition').forEach((btn) => {
    const isSelected = btn.getAttribute('data-id') === selectedId;
    const checkDot = btn.querySelector('.check-dot');
    const checkBox = btn.querySelector('.check-box');
    const iconBox = btn.querySelector('.item-icon-box');
    const title = btn.querySelector('.item-title');

    if (isSelected) {
      btn.className = "picker-item-condition w-full px-4 py-3 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-condition w-full px-4 py-3 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

const FORM_NEGO_META = {
  'nego_alus': { name: 'Nego Alus', icon: 'badge-percent' },
  'nego_tipis': { name: 'Nego Tipis', icon: 'fuel' },
  'nego_bebas': { name: 'Nego Bebas', icon: 'messages-square' },
  'pas': { name: 'Harga Pas / Nett', icon: 'lock' }
};

const FORM_PAYMENT_METHOD_META = {
  'cod': { name: 'COD', icon: 'handshake' },
  'in_store': { name: 'In Store', icon: 'store' }
};

function selectFormNego(negoId) {
  const selectedId = negoId || 'nego_alus';
  const input = document.getElementById('form-input-nego');
  if (input) input.value = selectedId;

  const meta = FORM_NEGO_META[selectedId] || { name: 'Nego Alus', icon: 'badge-percent' };
  
  const textEl = document.getElementById('nego-trigger-text');
  if (textEl) textEl.textContent = meta.name;

  const iconWrapper = document.getElementById('nego-trigger-icon-wrapper');
  if (iconWrapper) {
    iconWrapper.innerHTML = `<i data-lucide="${meta.icon}" id="nego-trigger-icon" class="w-3.5 h-3.5"></i>`;
  }

  // Update visual selection in modal picker
  document.querySelectorAll('.picker-item-nego').forEach((btn) => {
    const isSelected = btn.getAttribute('data-id') === selectedId;
    const checkDot = btn.querySelector('.check-dot');
    const checkBox = btn.querySelector('.check-box');
    const iconBox = btn.querySelector('.item-icon-box');
    const title = btn.querySelector('.item-title');

    if (isSelected) {
      btn.className = "picker-item-nego w-full px-4 py-3.5 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-nego w-full px-4 py-3.5 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function selectFormPaymentMethod(methodId) {
  const selectedId = methodId || 'cod';
  const input = document.getElementById('form-input-payment-method');
  if (input) input.value = selectedId;

  const meta = FORM_PAYMENT_METHOD_META[selectedId] || { name: 'COD', icon: 'handshake' };

  const textEl = document.getElementById('payment-method-trigger-text');
  if (textEl) textEl.textContent = meta.name;

  const iconWrapper = document.getElementById('payment-method-trigger-icon-wrapper');
  if (iconWrapper) {
    iconWrapper.innerHTML = `<i data-lucide="${meta.icon}" id="payment-method-trigger-icon" class="w-3.5 h-3.5"></i>`;
  }

  // Toggle Conditional Link Lokasi Store (Google Maps) Input
  const storeMapsContainer = document.getElementById('container-store-maps-link');
  if (storeMapsContainer) {
    if (selectedId === 'in_store') {
      storeMapsContainer.classList.remove('hidden');
    } else {
      storeMapsContainer.classList.add('hidden');
    }
  }

  // Update visual selection in modal picker
  document.querySelectorAll('.picker-item-payment-method').forEach((btn) => {
    const isSelected = btn.getAttribute('data-id') === selectedId;
    const checkDot = btn.querySelector('.check-dot');
    const checkBox = btn.querySelector('.check-box');
    const iconBox = btn.querySelector('.item-icon-box');
    const title = btn.querySelector('.item-title');

    if (isSelected) {
      btn.className = "picker-item-payment-method w-full px-4 py-3.5 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-payment-method w-full px-4 py-3.5 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-sm font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function openCreateListingModal() {
  const modal = document.getElementById('modal-create-listing');
  if (!modal) return;

  const user = currentUser || getCurrentUser() || getUserById('user-1787309560138');
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');

  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(user.email || 'user');
    nameEl.textContent = user.storeName || user.name;
    phoneEl.textContent = `WA: ${formatDisplayPhone(user.phone || '081251018765')}`;
  }

  // Reset edit state
  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = '';

  const titleModal = document.getElementById('form-create-listing-title');
  if (titleModal) titleModal.textContent = "Pasang Iklan Solo Raya";

  const subtitleModal = document.getElementById('form-create-listing-subtitle');
  if (subtitleModal) subtitleModal.textContent = "Jangkau calon pembeli di 7 wilayah Solo Raya";

  const btnSubmitText = document.getElementById('btn-submit-listing-text');
  if (btnSubmitText) btnSubmitText.textContent = "Tayangkan Iklan Sekarang";

  // Reset form
  const form = document.getElementById('form-create-listing');
  if (form) form.reset();
  selectFormCategory('elektronik');
  selectFormCondition('good');
  selectFormNego('nego_alus');
  selectFormPaymentMethod('cod');
  const storeMapsInput = document.getElementById('form-input-store-maps');
  if (storeMapsInput) storeMapsInput.value = '';
  uploadedImages = [];
  renderFormImagePreviews();
  const pricePreview = document.getElementById('price-rupiah-preview');
  if (pricePreview) pricePreview.textContent = 'Rp 0';
  const charCount = document.getElementById('title-char-count');
  if (charCount) charCount.textContent = '0/80 karakter';

  openModal('modal-create-listing');
}

function openEditListingModal(listingId) {
  if (!isUserLoggedIn()) {
    showToast("Silakan masuk terlebih dahulu untuk menyunting iklan.", "warning");
    return;
  }

  const listing = getListingById(listingId);
  if (!listing) {
    showToast("Data barang jualan tidak ditemukan.", "error");
    return;
  }

  const modal = document.getElementById('modal-create-listing');
  if (!modal) return;

  const user = currentUser || getCurrentUser() || getUserById('user-1787309560138');
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');

  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(user.email || 'user');
    nameEl.textContent = user.storeName || user.name;
    phoneEl.textContent = `WA: ${formatDisplayPhone(user.phone || '081251018765')}`;
  }

  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = listing.id;

  const titleModal = document.getElementById('form-create-listing-title');
  if (titleModal) titleModal.textContent = "Sunting Iklan Solo Raya";

  const subtitleModal = document.getElementById('form-create-listing-subtitle');
  if (subtitleModal) subtitleModal.textContent = "Perbarui rincian, foto, harga, atau lokasi toko";

  const btnSubmitText = document.getElementById('btn-submit-listing-text');
  if (btnSubmitText) btnSubmitText.textContent = "Simpan Perubahan Iklan";

  // Pre-fill fields
  const titleInput = document.getElementById('form-input-title');
  if (titleInput) titleInput.value = listing.title;

  const catInput = document.getElementById('form-input-category');
  if (catInput) catInput.value = listing.category || 'elektronik';
  selectFormCategory(listing.category || 'elektronik');

  const condInput = document.getElementById('form-input-condition');
  if (condInput) condInput.value = listing.condition || 'good';
  selectFormCondition(listing.condition || 'good');

  const priceInput = document.getElementById('form-input-price');
  if (priceInput) {
    priceInput.value = listing.price;
    const pricePreview = document.getElementById('price-rupiah-preview');
    if (pricePreview) pricePreview.textContent = formatRupiah(listing.price);
  }

  const negoInput = document.getElementById('form-input-nego');
  if (negoInput) negoInput.value = listing.negoType || 'nego_alus';
  selectFormNego(listing.negoType || 'nego_alus');

  const paymentMethodInput = document.getElementById('form-input-payment-method');
  if (paymentMethodInput) paymentMethodInput.value = listing.paymentMethod || 'cod';
  selectFormPaymentMethod(listing.paymentMethod || 'cod');

  const storeMapsInput = document.getElementById('form-input-store-maps');
  if (storeMapsInput) storeMapsInput.value = listing.storeMapsUrl || '';

  const regInput = document.getElementById('form-region-select');
  if (regInput) {
    regInput.value = listing.regionId;
    const event = new Event('change');
    regInput.dispatchEvent(event);
  }

  const distInput = document.getElementById('form-district-select');
  if (distInput) distInput.value = listing.district;

  const codInput = document.getElementById('form-input-cod');
  if (codInput) codInput.value = listing.codPoint || '';

  const descInput = document.getElementById('form-input-desc');
  if (descInput) descInput.value = listing.description;

  uploadedImages = listing.images ? [...listing.images] : [];
  renderFormImagePreviews();

  const charCount = document.getElementById('title-char-count');
  if (charCount && titleInput) charCount.textContent = `${titleInput.value.length}/80 karakter`;

  openModal('modal-create-listing');
}

function openItemStatusModal(itemId, itemTitle, currentStatus) {
  const modal = document.getElementById('modal-item-status-picker');
  if (!modal) return;

  const targetInput = document.getElementById('status-picker-target-id');
  if (targetInput) targetInput.value = itemId;

  // Highlight current active status
  document.querySelectorAll('.picker-status-btn').forEach((btn) => {
    const statusVal = btn.getAttribute('data-status-val');
    const isCurrent = statusVal === currentStatus;
    const checkIcon = btn.querySelector('.status-check-icon');
    const checkCircle = btn.querySelector('.status-check-circle');

    if (isCurrent) {
      if (statusVal === 'available') {
        btn.className = "picker-status-btn w-full px-4 py-3.5 rounded-2xl border-2 border-emerald-500/70 bg-emerald-950/40 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-emerald-500/20";
        if (checkCircle) checkCircle.className = "status-check-circle w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500/20 flex items-center justify-center flex-shrink-0";
      } else if (statusVal === 'booked') {
        btn.className = "picker-status-btn w-full px-4 py-3.5 rounded-2xl border-2 border-amber-500/70 bg-amber-950/40 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-amber-500/20";
        if (checkCircle) checkCircle.className = "status-check-circle w-5 h-5 rounded-full border-2 border-amber-500 bg-amber-500/20 flex items-center justify-center flex-shrink-0";
      } else {
        btn.className = "picker-status-btn w-full px-4 py-3.5 rounded-2xl border-2 border-rose-500/70 bg-rose-950/40 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-500/20";
        if (checkCircle) checkCircle.className = "status-check-circle w-5 h-5 rounded-full border-2 border-rose-500 bg-rose-500/20 flex items-center justify-center flex-shrink-0";
      }
      if (checkIcon) checkIcon.classList.remove('hidden');
    } else {
      btn.className = "picker-status-btn w-full px-4 py-3.5 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkCircle) checkCircle.className = "status-check-circle w-5 h-5 rounded-full border border-slate-700 flex items-center justify-center flex-shrink-0";
      if (checkIcon) checkIcon.classList.add('hidden');
    }
  });

  openModal('modal-item-status-picker');
}

function renderFormImagePreviews() {
  const previewContainer = document.getElementById('image-preview-container');
  const counterBadge = document.getElementById('upload-photo-counter');
  const uploadLabel = document.getElementById('file-upload-label');
  if (!previewContainer) return;

  const count = uploadedImages.length;
  if (counterBadge) {
    counterBadge.textContent = `${count}/3 Foto (Rasio 1:1)`;
    if (count >= 3) {
      counterBadge.className = "text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md";
    } else {
      counterBadge.className = "text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md";
    }
  }

  if (count === 0) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
    if (uploadLabel) uploadLabel.textContent = 'Pilih / Tambah Foto dari HP / Komputer (Maks 3)';
    return;
  }

  previewContainer.classList.remove('hidden');
  if (uploadLabel) {
    uploadLabel.textContent = count < 3 ? `+ Tambah Foto Lagi (${count}/3 Terpilih)` : 'Maksimal 3 Foto Terpenuhi';
  }

  let html = '';
  uploadedImages.forEach((imgUrl, idx) => {
    html += `
      <div class="relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border-2 border-rose-200 shadow-sm group">
        <img src="${imgUrl}" alt="Foto ${idx+1}" class="w-full h-full object-cover">
        <span class="absolute top-1.5 left-1.5 bg-slate-950/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
          ${idx === 0 ? 'Utama' : `Foto ${idx+1}`}
        </span>
        <button 
          type="button" 
          data-remove-idx="${idx}" 
          class="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs shadow-md transition-transform hover:scale-110 cursor-pointer"
          title="Hapus foto ini"
        >
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  });

  previewContainer.innerHTML = html;

  previewContainer.querySelectorAll('[data-remove-idx]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-remove-idx'), 10);
      uploadedImages.splice(idx, 1);
      renderFormImagePreviews();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function initEventListeners() {
  // Toggle verification requirements details
  const toggleBtn = document.getElementById('btn-toggle-verification-details');
  const detailsBox = document.getElementById('my-store-verification-details');
  const toggleLabel = document.getElementById('my-verification-toggle-label');
  const toggleChevron = document.getElementById('my-verification-chevron');

  if (toggleBtn && detailsBox) {
    toggleBtn.onclick = () => {
      const isHidden = detailsBox.classList.contains('hidden');
      if (isHidden) {
        detailsBox.classList.remove('hidden');
        if (toggleLabel) toggleLabel.textContent = "Sembunyikan Syarat";
        if (toggleChevron) toggleChevron.style.transform = "rotate(180deg)";
      } else {
        detailsBox.classList.add('hidden');
        if (toggleLabel) toggleLabel.textContent = "Lihat Rincian Syarat";
        if (toggleChevron) toggleChevron.style.transform = "rotate(0deg)";
      }
    };
  }

  // Filter tabs
  document.querySelectorAll('.store-filter-tab').forEach((tab) => {
    tab.onclick = (e) => {
      if (e) e.preventDefault();
      const filterVal = tab.getAttribute('data-store-filter') || 'all';
      if (typeof window.handleFilterTabClick === 'function') {
        window.handleFilterTabClick(tab, filterVal);
      }
    };
  });

  // Traktir Button Handler
  document.getElementById('nav-btn-traktir')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('modal-traktir-kopi');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Pasang Iklan Button Handler (Opens modal directly in Toko Saya!)
  document.getElementById('btn-store-create-listing')?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateListingModal();
  });

  // Live Price Rupiah Helper
  const priceInput = document.getElementById('form-input-price');
  const pricePreview = document.getElementById('price-rupiah-preview');
  priceInput?.addEventListener('input', (e) => {
    const val = Number(e.target.value) || 0;
    if (pricePreview) pricePreview.textContent = formatRupiah(val);
  });

  // Title Char Count Helper
  const titleInput = document.getElementById('form-input-title');
  const titleCount = document.getElementById('title-char-count');
  titleInput?.addEventListener('input', (e) => {
    const len = e.target.value.length;
    if (titleCount) titleCount.textContent = `${len}/80 karakter`;
  });

  // Strict 1:1 Square Image Processing & Validation Helper
  function processSquareImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error("File yang diunggah harus berupa gambar (JPG, PNG, WEBP)."));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Format gambar tidak valid atau rusak."));
        img.onload = () => {
          // Enforce 1:1 Square Aspect Ratio with center-crop (Anti-Gepeng)
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          const targetSize = Math.min(800, minDim);
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;

          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw center-cropped 1:1 square
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetSize, targetSize);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // File Upload Input (Enforces Strict 1:1 Square Aspect Ratio)
  const fileInput = document.getElementById('form-image-file');
  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const remainingSlots = 3 - uploadedImages.length;
    if (remainingSlots <= 0) {
      showToast("Maksimal 3 foto per barang. Hapus foto yang sudah ada jika ingin menambah baru.", "warning");
      fileInput.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    let processed = 0;

    for (const file of filesToProcess) {
      try {
        const squareDataUrl = await processSquareImage(file);
        uploadedImages.push(squareDataUrl);
        processed++;
      } catch (err) {
        showToast(err.message || "Gagal memproses foto", "error");
      }
    }

    if (processed > 0) {
      renderFormImagePreviews();
      fileInput.value = '';
      showToast(`${processed} foto berhasil diproses & divalidasi ke Rasio 1:1 (Persegi)!`, "success");
    }
  });

  // Create Listing Form Submit Handler with comprehensive validation and responsive feedback
  const createForm = document.getElementById('form-create-listing');
  const handleStoreListingSubmit = async (e) => {
    if (e) e.preventDefault();

    const titleInput = document.getElementById('form-input-title');
    const priceInput = document.getElementById('form-input-price');
    const descInput = document.getElementById('form-input-desc');
    const catInput = document.getElementById('form-input-category');
    const condInput = document.getElementById('form-input-condition');
    const negoInput = document.getElementById('form-input-nego');
    const payInput = document.getElementById('form-input-payment-method');
    const regInput = document.getElementById('form-region-select');
    const distInput = document.getElementById('form-district-select');
    const codInput = document.getElementById('form-input-cod');
    const mapsInput = document.getElementById('form-input-store-maps');

    const title = titleInput?.value?.trim() || '';
    const price = Number(priceInput?.value) || 0;
    const description = descInput?.value?.trim() || '';
    const category = catInput?.value || 'elektronik';
    const condition = condInput?.value || 'good';
    const negoType = negoInput?.value || 'nego_alus';
    const paymentMethod = payInput?.value || 'cod';
    let storeMapsUrl = paymentMethod === 'in_store' ? (mapsInput?.value?.trim() || '') : '';
    if (storeMapsUrl && !/^https?:\/\//i.test(storeMapsUrl)) {
      storeMapsUrl = 'https://' + storeMapsUrl;
    }
    const regionId = regInput?.value || 'solo';
    const district = distInput?.value || '';
    const codPoint = codInput?.value?.trim() || '';

    // Validations with user feedback
    if (!title) {
      showToast("Harap masukkan nama / judul barang jualan.", "warning");
      titleInput?.focus();
      return;
    }
    if (priceInput && (priceInput.value === '' || isNaN(price) || price < 0)) {
      showToast("Harap masukkan harga barang yang valid.", "warning");
      priceInput?.focus();
      return;
    }
    if (!description) {
      showToast("Harap lengkapi deskripsi lengkap barang jualan.", "warning");
      descInput?.focus();
      return;
    }

    const editId = document.getElementById('form-input-edit-id')?.value?.trim() || '';

    // Button loading state feedback
    const submitBtn = document.querySelector('button[form="form-create-listing"]');
    const submitBtnText = document.getElementById('btn-submit-listing-text');
    const originalText = submitBtnText ? submitBtnText.textContent : 'Tayangkan Iklan Sekarang';
    
    if (submitBtn) {
      submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = "Mengunggah Foto ke Cloud...";
    }

    let imagesToSave = uploadedImages.length > 0 ? [...uploadedImages] : [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"
    ];

    if (imagesToSave.some(img => typeof img === 'string' && img.startsWith('data:'))) {
      try {
        const publicUrls = await sbUploadMultipleImages(imagesToSave, 'listings');
        if (publicUrls && publicUrls.length > 0) {
          imagesToSave = publicUrls;
          uploadedImages = publicUrls;
        }
      } catch (err) {
        console.warn('[Supabase Storage] Upload error:', err);
      }
    }

    if (submitBtnText) submitBtnText.textContent = editId ? "Menyimpan Perubahan..." : "Menayangkan Iklan...";

    const listingPayload = {
      title,
      category,
      condition,
      price,
      negoType,
      paymentMethod,
      storeMapsUrl,
      regionId,
      district,
      codPoint,
      description,
      images: imagesToSave
    };

    try {
      if (editId) {
        updateListing(editId, listingPayload);
        showToast("Iklan barang berhasil diperbarui!", "success");
      } else {
        saveListing(listingPayload);
        showToast("Iklan barang berhasil ditayangkan ke etalase toko!", "success");
      }

      const modal = document.getElementById('modal-create-listing');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }

      renderStoreShowcase();
      renderStoreListings(activeStoreFilter);
    } catch (err) {
      showToast(err.message || "Gagal menyimpan iklan", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = originalText;
      }
    }
  };

  createForm?.addEventListener('submit', handleStoreListingSubmit);
  document.querySelector('button[form="form-create-listing"]')?.addEventListener('click', (e) => {
    if (createForm && !e.defaultPrevented) {
      createForm.requestSubmit ? createForm.requestSubmit() : handleStoreListingSubmit(e);
    }
  });

  // Explicit close and cancel handler for Create/Edit Listing Modal (Prevents page reload/redirect)
  const handleCloseCreateListingModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    closeModal('modal-create-listing');
  };
  document.getElementById('btn-close-create-listing')?.addEventListener('click', handleCloseCreateListingModal);
  document.getElementById('btn-cancel-create-listing')?.addEventListener('click', handleCloseCreateListingModal);
  document.getElementById('btn-close-store-create-listing')?.addEventListener('click', handleCloseCreateListingModal);
  document.getElementById('btn-cancel-store-create-listing')?.addEventListener('click', handleCloseCreateListingModal);

  // Category & Condition Popover Picker Modal Triggers
  document.getElementById('btn-open-category-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal('modal-category-picker');
  });

  document.getElementById('btn-open-condition-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal('modal-condition-picker');
  });

  // Category Item Selection
  document.querySelectorAll('.picker-item-category').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormCategory(id);
        closeModal('modal-category-picker');
      }
    });
  });

  // Condition Item Selection
  document.querySelectorAll('.picker-item-condition').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormCondition(id);
        closeModal('modal-condition-picker');
      }
    });
  });

  // Nego & Payment Method Popover Picker Modal Triggers
  document.getElementById('btn-open-nego-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal('modal-nego-picker');
  });

  document.getElementById('btn-open-payment-method-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal('modal-payment-method-picker');
  });

  // Nego Item Selection
  document.querySelectorAll('.picker-item-nego').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormNego(id);
        closeModal('modal-nego-picker');
      }
    });
  });

  // Payment Method Item Selection
  document.querySelectorAll('.picker-item-payment-method').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormPaymentMethod(id);
        closeModal('modal-payment-method-picker');
      }
    });
  });

  // Status Picker Modal Selection
  document.querySelectorAll('.picker-status-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newStatus = btn.getAttribute('data-status-val');
      const targetId = document.getElementById('status-picker-target-id')?.value;
      if (targetId && newStatus) {
        updateListingStatus(targetId, newStatus);
        closeModal('modal-item-status-picker');
        renderStoreShowcase();
        renderStoreListings(activeStoreFilter);
        const label = newStatus === 'sold' ? 'Terjual' : newStatus === 'booked' ? 'Booked' : 'Tersedia';
        showToast(`Status barang berhasil diubah menjadi "${label}"!`, "success");
      }
    });
  });

  // Profile Modal Trigger
  document.getElementById('nav-btn-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    openUserProfileModal();
  });

  // Close modals via data-close-modal attribute
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-close-modal');
      if (modalId) {
        closeModal(modalId);
      }
    });
  });

  // Close any open status popovers when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-dropdown-wrapper')) {
      document.querySelectorAll('.status-popover-menu').forEach((p) => p.classList.add('hidden'));
    }
  });
}

let userProfileAvatarData = null;

function normalizeProfileRegionId(reg) {
  if (!reg) return 'solo';
  const lower = String(reg).toLowerCase().trim();
  if (lower.includes('solo') || lower.includes('surakarta')) return 'solo';
  if (lower.includes('karanganyar')) return 'karanganyar';
  if (lower.includes('sukoharjo')) return 'sukoharjo';
  if (lower.includes('sragen')) return 'sragen';
  if (lower.includes('boyolali')) return 'boyolali';
  if (lower.includes('klaten')) return 'klaten';
  if (lower.includes('wonogiri')) return 'wonogiri';
  return lower;
}

function populateProfileDistricts(regId, selectedDistrict = null) {
  try {
    const currentRegId = normalizeProfileRegionId(regId);
    const districts = getDistrictsByRegionId(currentRegId) || [];
    const districtSelect = document.getElementById('profile-input-district');
    if (!districtSelect) return;

    districtSelect.innerHTML = '';
    districts.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = `Kec. ${d}`;
      districtSelect.appendChild(opt);
    });

    if (selectedDistrict && districts.includes(selectedDistrict)) {
      districtSelect.value = selectedDistrict;
    } else if (districts.length > 0) {
      districtSelect.value = districts[0];
    }
  } catch (err) {
    console.warn("[ErrorBoundary: populateProfileDistricts]", err);
  }
}

function handleProfileRegionChange(regId) {
  populateProfileDistricts(regId);
}
window.handleProfileRegionChange = handleProfileRegionChange;

function selectProfileRegion(regId, customDistrict = null) {
  try {
    const selectedRegId = normalizeProfileRegionId(regId);
    const regionSelect = document.getElementById('profile-input-region');
    if (regionSelect) {
      regionSelect.value = selectedRegId;
    }
    populateProfileDistricts(selectedRegId, customDistrict);
  } catch (err) {
    console.warn("[ErrorBoundary: selectProfileRegion]", err);
  }
}

let isProfileEditMode = false;

function setProfileEditMode(isEditing) {
  isProfileEditMode = isEditing;
  const avatarWrapper = document.getElementById('profile-avatar-upload-wrapper');
  const btnEdit = document.getElementById('btn-profile-enable-edit');
  const btnCancel = document.getElementById('btn-profile-cancel-edit');
  const btnSave = document.getElementById('btn-profile-save');
  const passSection = document.getElementById('profile-password-section');

  const inputs = [
    'profile-input-name',
    'profile-input-store-name',
    'profile-input-phone',
    'profile-input-email',
    'profile-input-region',
    'profile-input-district',
    'profile-input-bio',
    'profile-input-new-password',
    'profile-input-confirm-password'
  ];

  if (isEditing) {
    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = false;
        el.readOnly = false;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.className = "w-full px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-rose-900 focus:bg-white focus:outline-none shadow-xs transition-all";
        if (id === 'profile-input-phone' || id === 'profile-input-email') {
          el.className = "w-full pl-7 pr-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-rose-900 focus:bg-white focus:outline-none shadow-xs transition-all";
        }
        if (id === 'profile-input-bio') {
          el.className = "w-full px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-rose-900 focus:bg-white focus:outline-none shadow-xs transition-all";
        }
      }
    });

    if (avatarWrapper) avatarWrapper.classList.remove('hidden');
    if (passSection) passSection.classList.remove('hidden');

    if (btnEdit) btnEdit.classList.add('hidden');
    if (btnCancel) btnCancel.classList.remove('hidden');
    if (btnSave) btnSave.classList.remove('hidden');

    setTimeout(() => {
      document.getElementById('profile-input-name')?.focus();
    }, 50);
  } else {
    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.disabled = true;
        el.readOnly = true;
        el.setAttribute('disabled', 'true');
        el.setAttribute('readonly', 'true');
        el.className = "w-full px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none transition-all disabled:opacity-85 disabled:cursor-not-allowed";
        if (id === 'profile-input-phone' || id === 'profile-input-email') {
          el.className = "w-full pl-7 pr-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none transition-all disabled:opacity-85 disabled:cursor-not-allowed";
        }
        if (id === 'profile-input-bio') {
          el.className = "w-full px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none transition-all disabled:opacity-85 disabled:cursor-not-allowed";
        }
      }
    });

    if (avatarWrapper) avatarWrapper.classList.add('hidden');
    if (passSection) passSection.classList.add('hidden');

    if (btnEdit) btnEdit.classList.remove('hidden');
    if (btnCancel) btnCancel.classList.add('hidden');
    if (btnSave) btnSave.classList.add('hidden');
  }

  if (window.lucide) window.lucide.createIcons();
}

function enableProfileEditMode(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  setProfileEditMode(true);
}

function cancelProfileEditMode(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  const currentUserData = getCurrentUser();
  if (currentUserData) {
    const nameInput = document.getElementById('profile-input-name');
    const storeNameInput = document.getElementById('profile-input-store-name');
    const phoneInput = document.getElementById('profile-input-phone');
    const emailInput = document.getElementById('profile-input-email');
    const bioInput = document.getElementById('profile-input-bio');
    const newPassInput = document.getElementById('profile-input-new-password');
    const confirmPassInput = document.getElementById('profile-input-confirm-password');

    if (nameInput) nameInput.value = currentUserData.name || '';
    if (storeNameInput) storeNameInput.value = currentUserData.storeName || currentUserData.name || '';
    if (phoneInput) phoneInput.value = currentUserData.phone || '';
    if (emailInput) emailInput.value = currentUserData.email || '';
    if (bioInput) bioInput.value = currentUserData.bio || '';
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';
    userProfileAvatarData = currentUserData.avatar || '';
    const avatarPreview = document.getElementById('profile-edit-avatar-preview');
    if (avatarPreview) avatarPreview.src = userProfileAvatarData || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
    selectProfileRegion(currentUserData.region || 'solo', currentUserData.district);
  }
  setProfileEditMode(false);
}

export async function handleSaveProfileSettings(e) {
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  const nameInput = document.getElementById('profile-input-name');
  const storeNameInput = document.getElementById('profile-input-store-name');
  const phoneInput = document.getElementById('profile-input-phone');
  const emailInput = document.getElementById('profile-input-email');
  const regionInput = document.getElementById('profile-input-region');
  const districtInput = document.getElementById('profile-input-district');
  const bioInput = document.getElementById('profile-input-bio');
  const newPassInput = document.getElementById('profile-input-new-password');
  const confirmPassInput = document.getElementById('profile-input-confirm-password');
  const btnSave = document.getElementById('btn-profile-save') || document.getElementById('btn-save-profile-settings');

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const storeNameVal = storeNameInput ? storeNameInput.value.trim() : '';
  const phoneVal = phoneInput ? phoneInput.value.trim() : '';
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const regionVal = regionInput ? regionInput.value : 'solo';
  const districtVal = districtInput ? districtInput.value : 'Banjarsari';
  const bioVal = bioInput ? bioInput.value.trim() : '';
  const newPass = newPassInput ? newPassInput.value : '';
  const confirmPass = confirmPassInput ? confirmPassInput.value : '';

  if (!nameVal) {
    showToast("Nama lengkap wajib diisi.", "error");
    nameInput?.focus();
    return;
  }

  if (!phoneVal) {
    showToast("Nomor WhatsApp wajib diisi.", "error");
    phoneInput?.focus();
    return;
  }

  if (newPass) {
    if (newPass.length < 5) {
      showToast("Password baru minimal 5 karakter.", "error");
      newPassInput?.focus();
      return;
    }
    if (newPass !== confirmPass) {
      showToast("Konfirmasi password baru tidak cocok.", "error");
      confirmPassInput?.focus();
      return;
    }
  }

  const originalSaveHtml = btnSave ? btnSave.innerHTML : '';
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Menyimpan ke Supabase...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const updated = await updateProfile({
      name: nameVal,
      storeName: storeNameVal || nameVal,
      phone: phoneVal,
      email: emailVal,
      region: regionVal,
      district: districtVal,
      bio: bioVal,
      avatar: userProfileAvatarData,
      newPassword: newPass
    });

    currentUser = updated;

    // Update modal header preview
    const avatarPreview = document.getElementById('profile-edit-avatar-preview');
    const namePreview = document.getElementById('profile-edit-name-preview');
    if (avatarPreview && updated.avatar) avatarPreview.src = updated.avatar;
    if (namePreview) namePreview.textContent = updated.storeName || updated.name || 'Pengguna';

    // Lock back to read-only mode
    setProfileEditMode(false);

    // Re-render store headers safely
    try {
      renderStoreHeader(updated);
      renderStoreShowcase();
      renderAuthHeader();
    } catch (rErr) {
      console.warn("UI render error:", rErr);
    }

    showToast("Profil & pengaturan akun berhasil disimpan ke database Supabase!", "success");
  } catch (err) {
    console.error('[handleSaveProfileSettings Error]', err);
    showToast(err.message || "Gagal menyimpan perubahan profil.", "error");
  } finally {
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.innerHTML = originalSaveHtml || `<i data-lucide="check" class="w-3.5 h-3.5 text-amber-300"></i><span>Simpan Perubahan</span>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

export function handleProfileLogout(e) {
  console.log('[Toko Saya Logout] Memulai proses logout dari panel Toko Saya...', e?.target || e);
  if (e) {
    if (typeof e.preventDefault === 'function') e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }
  try {
    closeModal('modal-user-profile');
  } catch (err) {}

  try {
    localStorage.removeItem('pusat_barkas_user');
    localStorage.removeItem('solosatset_auth_user');
    localStorage.removeItem('sb_auth_token');
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
    console.log('[Toko Saya Logout] Kunci sesi berhasil dihapus.');
  } catch (err) {}

  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister().catch(() => {});
        }
      }).catch(() => {});
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
    }
  } catch (swErr) {}

  try {
    if (typeof logout === 'function') {
      logout();
      console.log('[Toko Saya Logout] Service logout() selesai dijalankan.');
    }
  } catch (err) {
    console.warn('[toko-saya logout notice]', err);
  }

  if (typeof showToast === 'function') {
    showToast("Anda telah berhasil keluar dari akun.", "info");
  }
  console.log('[Toko Saya Logout] Mengarahkan kembali ke index.html...');
  setTimeout(() => {
    window.location.href = `index.html?logout=1&t=${Date.now()}`;
  }, 200);
}

function renderStoreHeader(user) {
  try {
    renderStoreShowcase();
  } catch (e) {
    console.warn('[renderStoreHeader error]', e);
  }
}

window.enableProfileEditMode = enableProfileEditMode;
window.cancelProfileEditMode = cancelProfileEditMode;
window.setProfileEditMode = setProfileEditMode;
window.renderStoreHeader = renderStoreHeader;
window.handleSaveProfileSettings = handleSaveProfileSettings;
window.handleProfileLogout = handleProfileLogout;
window.logout = handleProfileLogout;

function openUserProfileModal() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html?action=profil';
    return;
  }
  userProfileAvatarData = user.avatar || '';

  const avatarPreview = document.getElementById('profile-edit-avatar-preview');
  const namePreview = document.getElementById('profile-edit-name-preview');
  const joinedPreview = document.getElementById('profile-edit-joined-preview');

  if (avatarPreview) avatarPreview.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
  if (namePreview) namePreview.textContent = user.storeName || user.name || 'Pengguna';
  
  const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const dateFormatted = !isNaN(createdDate.getTime()) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '01 Agustus 2026';
  if (joinedPreview) joinedPreview.textContent = `Bergabung: ${dateFormatted}`;

  const nameInput = document.getElementById('profile-input-name');
  const storeNameInput = document.getElementById('profile-input-store-name');
  const phoneInput = document.getElementById('profile-input-phone');
  const emailInput = document.getElementById('profile-input-email');
  const bioInput = document.getElementById('profile-input-bio');
  const newPassInput = document.getElementById('profile-input-new-password');
  const confirmPassInput = document.getElementById('profile-input-confirm-password');

  if (nameInput) nameInput.value = user.name || '';
  if (storeNameInput) storeNameInput.value = user.storeName || user.name || '';
  if (phoneInput) phoneInput.value = user.phone || '';
  if (emailInput) emailInput.value = user.email || '';
  if (bioInput) bioInput.value = user.bio || '';
  if (newPassInput) newPassInput.value = '';
  if (confirmPassInput) confirmPassInput.value = '';

  // Initialize Region & District Selection
  selectProfileRegion(user.region || 'solo', user.district);

  // Region dropdown change listener
  const regionSelect = document.getElementById('profile-input-region');
  if (regionSelect) {
    regionSelect.onchange = () => {
      populateProfileDistricts(regionSelect.value);
    };
  }

  // Set default locked read-only state on opening
  setProfileEditMode(false);

  // Edit Mode Trigger Button
  const btnEnableEdit = document.getElementById('btn-profile-enable-edit');
  if (btnEnableEdit) {
    btnEnableEdit.onclick = enableProfileEditMode;
  }

  // Cancel Edit Trigger Button (Batalkan Perubahan)
  const btnCancelEdit = document.getElementById('btn-profile-cancel-edit');
  if (btnCancelEdit) {
    btnCancelEdit.onclick = cancelProfileEditMode;
  }

  // Form Submit & Button Save Triggers
  const profileForm = document.getElementById('form-user-profile-settings');
  if (profileForm) {
    profileForm.onsubmit = handleSaveProfileSettings;
  }

  const btnSave = document.getElementById('btn-profile-save');
  if (btnSave) {
    btnSave.onclick = handleSaveProfileSettings;
  }

  const avatarFileInput = document.getElementById('profile-edit-avatar-file');
  if (avatarFileInput) {
    avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        userProfileAvatarData = event.target.result;
        if (avatarPreview) avatarPreview.src = userProfileAvatarData;
        showToast("Foto avatar berhasil dipilih. Klik 'Simpan' untuk menerapkan.", "info");
      };
      reader.readAsDataURL(file);
    };
  }

  const logoutBtn = document.getElementById('btn-profile-logout');
  if (logoutBtn) {
    logoutBtn.onclick = handleProfileLogout;
  }

  openModal('modal-user-profile');
}

const NESTED_PICKER_MODALS = new Set([
  'modal-category-picker',
  'modal-condition-picker',
  'modal-nego-picker',
  'modal-payment-method-picker',
  'modal-item-status-picker'
]);

const modalHistoryStack = [];
let isPopStateActive = false;

function openModal(modalId, pushHistory = true) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const isPicker = NESTED_PICKER_MODALS.has(modalId);
  if (!isPicker) {
    document.querySelectorAll('.fixed[id^="modal-"]').forEach((m) => {
      if (m.id !== modalId && !NESTED_PICKER_MODALS.has(m.id)) {
        m.classList.add('hidden');
        m.style.display = 'none';
        const idx = modalHistoryStack.indexOf(m.id);
        if (idx !== -1) modalHistoryStack.splice(idx, 1);
      }
    });
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  if (!modalHistoryStack.includes(modalId)) {
    modalHistoryStack.push(modalId);
  }

  if (pushHistory && !isPopStateActive && !isPicker) {
    try {
      window.history.pushState({ modalId: modalId, appModal: true }, '');
    } catch (e) {}
  }

  if (window.lucide) {
    try {
      window.lucide.createIcons({ root: modal });
    } catch (e) {
      window.lucide.createIcons();
    }
  }
}

function closeModal(modalId, fromHistory = false) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add('hidden');
  modal.style.display = 'none';

  const stackIndex = modalHistoryStack.lastIndexOf(modalId);
  if (stackIndex !== -1) {
    modalHistoryStack.splice(stackIndex, 1);
  }

  const isNestedPicker = NESTED_PICKER_MODALS.has(modalId);
  if (!fromHistory && !isPopStateActive && !isNestedPicker) {
    if (window.history.state && window.history.state.appModal) {
      try {
        window.history.back();
      } catch (e) {}
    }
  }

  const openModals = Array.from(document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]'))
    .filter(m => window.getComputedStyle(m).display !== 'none' && m.id !== modalId);
  if (openModals.length === 0) {
    document.body.style.overflow = '';
  } else {
    document.body.style.overflow = 'hidden';
  }
}

function initBackHandler() {
  try {
    if (!window.history.state || !window.history.state.pageBase) {
      window.history.replaceState({ pageBase: 'toko-saya' }, '');
    }
  } catch (e) {}

  window.addEventListener('popstate', (e) => {
    isPopStateActive = true;

    // Check if any modal is currently visible
    const visibleModals = Array.from(document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]'))
      .filter(m => window.getComputedStyle(m).display !== 'none');

    if (visibleModals.length > 0) {
      let targetModalId = null;
      for (let i = modalHistoryStack.length - 1; i >= 0; i--) {
        const id = modalHistoryStack[i];
        const el = document.getElementById(id);
        if (el && window.getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden')) {
          targetModalId = id;
          break;
        }
      }

      if (!targetModalId) {
        const visiblePicker = visibleModals.find(m => NESTED_PICKER_MODALS.has(m.id));
        targetModalId = visiblePicker ? visiblePicker.id : visibleModals[visibleModals.length - 1].id;
      }

      if (targetModalId) {
        closeModal(targetModalId, true);
        isPopStateActive = false;
        return;
      }
    }

    // If on Toko Saya with no modal open, simply reset flag without forced redirect
    isPopStateActive = false;
  });
}

window.handleFilterTabClick = function(btnEl, filterVal) {
  try {
    document.querySelectorAll('.store-filter-tab').forEach((t) => {
      t.classList.remove('active', 'bg-rose-900', 'text-white', 'shadow-xs');
      t.classList.add('text-slate-400');
    });
    if (btnEl) {
      btnEl.classList.add('active', 'bg-rose-900', 'text-white', 'shadow-xs');
      btnEl.classList.remove('text-slate-400');
    }
    activeStoreFilter = filterVal || 'all';
    renderStoreListings(activeStoreFilter);
    if (window.lucide) window.lucide.createIcons();
  } catch (e) {
    console.warn('[handleFilterTabClick error]', e);
  }
};
window.filterStoreListings = window.handleFilterTabClick;

window.handleProfileNavClick = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  openUserProfileModal();
};

window.openModal = openModal;
window.closeModal = closeModal;
window.openCreateListingModal = openCreateListingModal;
window.openEditListingModal = openEditListingModal;
window.openUserProfileModal = openUserProfileModal;

function showToast(message, type = 'info', duration = 4500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2.5 max-w-md w-[92%] sm:w-auto sm:min-w-[360px] pointer-events-none';
    document.body.appendChild(container);
  }

  container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2.5 max-w-md w-[92%] sm:w-auto sm:min-w-[360px] pointer-events-none';

  const toast = document.createElement('div');
  let iconName = 'info';
  let bgGradient = 'from-slate-900 via-slate-800 to-slate-950 border-slate-600 shadow-2xl';
  let badgeText = 'Informasi';
  let badgeColor = 'bg-slate-700 text-slate-200';
  let iconColor = 'text-amber-300';
  let ringClass = 'ring-2 ring-white/10';

  if (type === 'error') {
    iconName = 'alert-octagon';
    bgGradient = 'from-rose-950 via-rose-900 to-rose-950 border-rose-400 shadow-2xl shadow-rose-950/80';
    badgeText = 'Pemberitahuan Gagal / Kendala';
    badgeColor = 'bg-rose-800 text-rose-100 border border-rose-600';
    iconColor = 'text-rose-200';
    ringClass = 'ring-4 ring-rose-500/30 animate-pulse';
  } else if (type === 'success') {
    iconName = 'check-circle-2';
    bgGradient = 'from-emerald-950 via-emerald-900 to-emerald-950 border-emerald-400 shadow-2xl shadow-emerald-950/80';
    badgeText = 'Berhasil';
    badgeColor = 'bg-emerald-800 text-emerald-100 border border-emerald-600';
    iconColor = 'text-emerald-300';
    ringClass = 'ring-4 ring-emerald-500/20';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    bgGradient = 'from-amber-950 via-amber-900 to-amber-950 border-amber-400 shadow-2xl shadow-amber-950/80';
    badgeText = 'Peringatan';
    badgeColor = 'bg-amber-800 text-amber-100 border border-amber-600';
    iconColor = 'text-amber-300';
    ringClass = 'ring-4 ring-amber-500/20';
  }

  toast.className = `toast-item pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r ${bgGradient} border-2 ${ringClass} text-white transition-all duration-300 transform -translate-y-4 opacity-0 max-w-md w-full backdrop-blur-md`;
  
  toast.innerHTML = `
    <div class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 ${iconColor} mt-0.5">
      <i data-lucide="${iconName}" class="w-5 h-5"></i>
    </div>
    <div class="flex-1 min-w-0 pr-1">
      <div class="flex items-center gap-1.5 mb-0.5">
        <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeColor}">
          ${badgeText}
        </span>
      </div>
      <div class="text-xs sm:text-sm font-bold text-white leading-snug break-words">${message}</div>
    </div>
    <button type="button" class="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer" title="Tutup Notifikasi">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  const closeBtn = toast.querySelector('button');
  if (closeBtn) {
    closeBtn.onclick = () => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-4', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    };
  }

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('-translate-y-4', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    }
  }, duration);
}

// Run when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initTokoSayaPage().catch(err => console.error('[initTokoSayaPage Error]', err));
  });
} else {
  initTokoSayaPage().catch(err => console.error('[initTokoSayaPage Error]', err));
}

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const storedVersion = localStorage.getItem('solosatset_sw_version');
  if (storedVersion !== CURRENT_SW_VERSION) {
    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      }).catch(() => {});
    }
    localStorage.setItem('solosatset_sw_version', CURRENT_SW_VERSION);
  }

  navigator.serviceWorker.register(`./sw.js?v=${CURRENT_SW_VERSION}`)
    .then((registration) => {
      registration.update().catch(() => {});
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ action: 'skipWaiting' });
          }
        });
      });
      if (registration.waiting) {
        registration.waiting.postMessage({ action: 'skipWaiting' });
      }
    })
    .catch(() => {});
}



