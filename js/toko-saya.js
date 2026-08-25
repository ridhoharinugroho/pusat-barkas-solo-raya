/**
 * Toko Saya Standalone Page Controller
 * Pusat Barkas Solo Raya 7 Wilayah
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

let activeStoreFilter = 'all';
let currentUser = null;
let uploadedImages = [];

function initTokoSayaPage() {
  initializeStorage();
  syncAllUsersToCloudOnStartup().catch(() => {});
  
  // Resolve user session (shows user store if logged in, or verified seller showcase if visitor)
  currentUser = getCurrentUser() || getUserById('user-101');

  renderAuthHeader();
  renderStoreShowcase();
  renderStoreReviews();
  renderStoreListings(activeStoreFilter);
  populateFormRegions();
  initEventListeners();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderAuthHeader() {
  const container = document.getElementById('auth-nav-container');
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div class="flex items-center gap-2 p-1 pr-2.5 bg-slate-100 rounded-full border border-slate-200">
      <img src="${currentUser.avatar}" alt="${currentUser.displayName}" class="w-7 h-7 rounded-full object-cover border border-slate-300">
      <span class="text-xs font-bold text-slate-800 hidden sm:inline truncate max-w-[120px]">${currentUser.displayName || currentUser.name}</span>
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
  if (avatarEl) avatarEl.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

  const nameEl = document.getElementById('my-store-name');
  if (nameEl) nameEl.textContent = user.storeName || user.displayName || user.name;

  const locEl = document.getElementById('my-store-location');
  if (locEl) {
    const regionRaw = (user.region || 'Solo').replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim();
    const capReg = regionRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const distClean = (user.district || '').trim().replace(/\.+$/, '').replace(/^Kec\.?\s*/i, '');
    const capDist = distClean ? distClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
    locEl.textContent = capDist ? `${capReg} • ${capDist}` : capReg;
  }

  const phoneEl = document.getElementById('my-store-phone');
  if (phoneEl) phoneEl.textContent = user.phone ? `WA: ${formatDisplayPhone(user.phone)}` : 'WA: Belum diatur';

  const createdEl = document.getElementById('my-store-created');
  if (createdEl) {
    const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
    const dateStr = !isNaN(createdDate) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Jul 2026';
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
    ? "Selamat! Toko Anda telah memenuhi 5/5 Syarat Badge Terverifikasi" 
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

    let statusBadgeHtml = '';
    let statusBorderColor = 'border-slate-800';
    if (itemStatus === 'sold') {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-600 text-white shadow-xs tracking-wider">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i>
          <span>TERJUAL</span>
        </span>
      `;
      statusBorderColor = 'border-rose-800/60 bg-rose-950/20';
    } else if (itemStatus === 'booked') {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-500 text-white shadow-xs tracking-wider">
          <i data-lucide="clock" class="w-3 h-3"></i>
          <span>BOOKED</span>
        </span>
      `;
      statusBorderColor = 'border-amber-800/60 bg-amber-950/20';
    } else {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-600 text-white shadow-xs tracking-wider">
          <i data-lucide="sparkles" class="w-3 h-3"></i>
          <span>TERSEDIA</span>
        </span>
      `;
      statusBorderColor = 'border-slate-800 bg-slate-900/90';
    }

    html += `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-2xl border ${statusBorderColor} shadow-xl hover:border-slate-700 transition-all bg-slate-900/90 backdrop-blur-md">
        
        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
          <div class="relative flex-shrink-0">
            <img src="${item.images[0]}" alt="${item.title}" class="w-20 h-20 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-800 shadow-xs">
            <span class="absolute top-1 left-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
              itemStatus === 'sold' ? 'bg-rose-600' : itemStatus === 'booked' ? 'bg-amber-500' : 'bg-emerald-500'
            }"></span>
          </div>
          
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              ${statusBadgeHtml}
              <span class="text-[11px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                📍 ${regionName} • ${item.district || 'Solo Raya'}
              </span>
              <span class="text-[11px] text-slate-400 font-medium">👁️ ${item.views || 1} tayangan</span>
            </div>

            <h3 class="text-xs sm:text-sm font-black text-white truncate leading-snug" title="${item.title}">
              ${item.title}
            </h3>

            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs sm:text-sm font-black text-amber-400">${formatRupiah(item.price)}</span>
              <span class="text-[10px] font-semibold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                ${item.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'}
              </span>
            </div>

            ${item.codPoint ? `<div class="text-[10px] text-slate-400 truncate flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-rose-400 flex-shrink-0"></i><span>COD: ${item.codPoint}</span></div>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 flex-shrink-0 self-end sm:self-center">
          
          <!-- Status Selector Dropdown -->
          <div class="space-y-0.5">
            <select 
              data-action="change-status" 
              data-id="${item.id}"
              class="text-xs font-black px-3 py-2 rounded-xl border ${
                itemStatus === 'sold' ? 'bg-rose-950/80 text-rose-300 border-rose-800' :
                itemStatus === 'booked' ? 'bg-amber-950/80 text-amber-300 border-amber-800' :
                'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              } focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
            >
              <option value="available" class="bg-slate-900 text-white" ${itemStatus === 'available' ? 'selected' : ''}>🟢 Tersedia</option>
              <option value="booked" class="bg-slate-900 text-white" ${itemStatus === 'booked' ? 'selected' : ''}>🟡 Booked</option>
              <option value="sold" class="bg-slate-900 text-white" ${itemStatus === 'sold' ? 'selected' : ''}>🔴 Terjual</option>
            </select>
          </div>

          <!-- Edit Link -->
          <a 
            href="index.html#edit-${item.id}" 
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer border border-slate-700"
            title="Sunting / Edit Iklan"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit</span>
          </a>
          
          <!-- Delete Button -->
          <button 
            data-action="delete-listing" 
            data-id="${item.id}"
            class="p-2 text-rose-400 hover:text-white hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer border border-rose-900/40"
            title="Hapus Iklan"
          >
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Status change event
  container.querySelectorAll('[data-action="change-status"]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const id = sel.getAttribute('data-id');
      const newStatus = e.target.value;
      updateListingStatus(id, newStatus);
      renderStoreShowcase();
      renderStoreListings(activeStoreFilter);
      const label = newStatus === 'sold' ? 'Terjual' : newStatus === 'booked' ? 'Booked' : 'Tersedia';
      showToast(`Status barang berhasil diubah menjadi "${label}"!`, "success");
    });
  });

  // Delete listing event
  container.querySelectorAll('[data-action="delete-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Apakah Anda yakin ingin menghapus barang jualan ini dari etalase toko Anda?")) {
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
  'pertukangan': { name: 'Pertukangan / Bahan Bangunan', icon: 'hammer' },
  'hobi': { name: 'Hobi, Musik & Olahraga', icon: 'trophy' },
  'hewan': { name: 'Hewan & Perlengkapan', icon: 'cat' },
  'alat-sekolah': { name: 'Peralatan Sekolah', icon: 'book-open' },
  'perawatan-diri': { name: 'Perawatan Diri', icon: 'sparkles' },
  'properti': { name: 'Properti', icon: 'building-2' },
  'jasa': { name: 'Jasa', icon: 'wrench' },
  'lainnya': { name: 'Lain-lain / Aneka Barkas', icon: 'package' }
};

const FORM_CONDITION_META = {
  'new': { name: 'Baru (Kondisi Segel / Gres)', icon: 'sparkles' },
  'like_new': { name: 'Bekas - Seperti Baru (Like New)', icon: 'gem' },
  'good': { name: 'Bekas - Mulus / Normal', icon: 'check-circle-2' },
  'fair': { name: 'Bekas - Wajar Pemakaian', icon: 'clock' },
  'repair': { name: 'Bekas - Butuh Servis / Bahan', icon: 'wrench' }
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
      btn.className = "picker-item-category w-full p-2.5 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-category w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function selectFormCondition(condId) {
  const selectedId = condId || 'good';
  const input = document.getElementById('form-input-condition');
  if (input) input.value = selectedId;

  const meta = FORM_CONDITION_META[selectedId] || { name: 'Bekas - Mulus / Normal', icon: 'check-circle-2' };

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
      btn.className = "picker-item-condition w-full p-3 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-condition w-full p-3 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

const FORM_NEGO_META = {
  'nego_alus': { name: 'Nego Alus (Sedikit)', icon: 'badge-percent' },
  'nego_tipis': { name: 'Nego Tipis / Bensin', icon: 'fuel' },
  'nego_bebas': { name: 'Nego Bebas Sampai Jadi', icon: 'messages-square' },
  'pas': { name: 'Harga Pas / Nett', icon: 'lock' }
};

const FORM_PAYMENT_METHOD_META = {
  'cod': { name: 'COD (Bayar di Tempat)', icon: 'handshake' },
  'in_store': { name: 'In Store (Ambil di Toko)', icon: 'store' }
};

function selectFormNego(negoId) {
  const selectedId = negoId || 'nego_alus';
  const input = document.getElementById('form-input-nego');
  if (input) input.value = selectedId;

  const meta = FORM_NEGO_META[selectedId] || { name: 'Nego Alus (Sedikit)', icon: 'badge-percent' };
  
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
      btn.className = "picker-item-nego w-full p-3 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-nego w-full p-3 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function selectFormPaymentMethod(methodId) {
  const selectedId = methodId || 'cod';
  const input = document.getElementById('form-input-payment-method');
  if (input) input.value = selectedId;

  const meta = FORM_PAYMENT_METHOD_META[selectedId] || { name: 'COD (Bayar di Tempat)', icon: 'handshake' };

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
      btn.className = "picker-item-payment-method w-full p-3 rounded-2xl border-2 border-rose-900 bg-rose-50/70 flex items-center justify-between gap-3 text-left transition-all cursor-pointer ring-2 ring-rose-900/20";
      if (checkDot) checkDot.classList.remove('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-rose-900 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center flex-shrink-0 border border-rose-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-900 item-title";
    } else {
      btn.className = "picker-item-payment-method w-full p-3 rounded-2xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-left transition-all cursor-pointer";
      if (checkDot) checkDot.classList.add('hidden');
      if (checkBox) checkBox.className = "check-box w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center flex-shrink-0";
      if (iconBox) iconBox.className = "w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0 border border-slate-200 item-icon-box";
      if (title) title.className = "text-xs font-black text-slate-800 item-title";
    }
  });

  if (window.lucide) window.lucide.createIcons();
}

function openCreateListingModal() {
  const modal = document.getElementById('modal-create-listing');
  if (!modal) return;

  const user = currentUser || getCurrentUser() || getUserById('user-101');
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');

  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
    nameEl.textContent = user.storeName || user.displayName || user.name;
    phoneEl.textContent = `WA: ${formatDisplayPhone(user.phone || '081234567890')}`;
  }

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

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();
}

function populateFormRegions() {
  const regionSelect = document.getElementById('form-region-select');
  const districtSelect = document.getElementById('form-district-select');
  if (!regionSelect || !districtSelect) return;

  let regionOptions = '';
  SOLO_RAYA_REGIONS.forEach((r) => {
    regionOptions += `<option value="${r.id}">${r.name}</option>`;
  });
  regionSelect.innerHTML = regionOptions;

  function updateDistricts() {
    const regId = regionSelect.value;
    const districts = getDistrictsByRegionId(regId);
    let distOptions = '';
    districts.forEach((d) => {
      distOptions += `<option value="${d}">Kec. ${d}</option>`;
    });
    districtSelect.innerHTML = distOptions;
  }

  regionSelect.addEventListener('change', updateDistricts);
  updateDistricts();
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
    tab.onclick = () => {
      document.querySelectorAll('.store-filter-tab').forEach((t) => {
        t.classList.remove('active', 'bg-rose-900', 'text-white', 'shadow-xs');
        t.classList.add('text-slate-600');
      });
      tab.classList.add('active', 'bg-rose-900', 'text-white', 'shadow-xs');
      tab.classList.remove('text-slate-600');
      activeStoreFilter = tab.getAttribute('data-store-filter') || 'all';
      renderStoreListings(activeStoreFilter);
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
  const handleStoreListingSubmit = (e) => {
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

    // Button loading state feedback
    const submitBtn = document.querySelector('button[form="form-create-listing"]');
    const submitBtnText = document.getElementById('btn-submit-listing-text');
    const originalText = submitBtnText ? submitBtnText.textContent : 'Tayangkan Iklan Sekarang';
    
    if (submitBtn) {
      submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = "Menayangkan Iklan...";
    }

    const imagesToSave = uploadedImages.length > 0 ? [...uploadedImages] : [
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"
    ];

    try {
      saveListing({
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
      });

      const modal = document.getElementById('modal-create-listing');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }

      showToast("Iklan barang bekas berhasil ditayangkan ke etalase toko!", "success");
      renderStoreShowcase();
      renderStoreListings(activeStoreFilter);
    } catch (err) {
      showToast(err.message || "Gagal memasang iklan", "error");
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

  // Category & Condition Popover Picker Modal Triggers
  document.getElementById('btn-open-category-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('modal-category-picker');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  document.getElementById('btn-open-condition-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('modal-condition-picker');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Category Item Selection
  document.querySelectorAll('.picker-item-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormCategory(id);
        const modal = document.getElementById('modal-category-picker');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
      }
    });
  });

  // Condition Item Selection
  document.querySelectorAll('.picker-item-condition').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormCondition(id);
        const modal = document.getElementById('modal-condition-picker');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
      }
    });
  });

  // Nego & Payment Method Popover Picker Modal Triggers
  document.getElementById('btn-open-nego-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('modal-nego-picker');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  document.getElementById('btn-open-payment-method-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('modal-payment-method-picker');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Nego Item Selection
  document.querySelectorAll('.picker-item-nego').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormNego(id);
        const modal = document.getElementById('modal-nego-picker');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
      }
    });
  });

  // Payment Method Item Selection
  document.querySelectorAll('.picker-item-payment-method').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormPaymentMethod(id);
        const modal = document.getElementById('modal-payment-method-picker');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
      }
    });
  });

  // Profile Modal Trigger
  document.getElementById('nav-btn-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    openUserProfileModal();
  });

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = btn.getAttribute('data-close-modal');
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = '';
      }
    });
  });
}

let userProfileAvatarData = null;

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
  if (namePreview) namePreview.textContent = user.displayName || user.name || 'Pengguna';
  
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

  if (nameInput) nameInput.value = user.name || user.displayName || '';
  if (storeNameInput) storeNameInput.value = user.storeName || user.displayName || '';
  if (phoneInput) phoneInput.value = user.phone || '';
  if (emailInput) emailInput.value = user.email || '';
  if (bioInput) bioInput.value = user.bio || '';
  if (newPassInput) newPassInput.value = '';
  if (confirmPassInput) confirmPassInput.value = '';

  const regSelect = document.getElementById('profile-input-region');
  const distSelect = document.getElementById('profile-input-district');

  if (regSelect && distSelect) {
    let regHtml = '';
    SOLO_RAYA_REGIONS.forEach((r) => {
      regHtml += `<option value="${r.id}" ${user.region === r.id ? 'selected' : ''}>${r.name}</option>`;
    });
    regSelect.innerHTML = regHtml;

    function populateProfileDistricts() {
      const selectedRegId = regSelect.value || 'solo';
      const districts = getDistrictsByRegionId(selectedRegId) || [];
      let distHtml = '';
      districts.forEach((d) => {
        distHtml += `<option value="${d}" ${user.district === d ? 'selected' : ''}>Kec. ${d}</option>`;
      });
      distSelect.innerHTML = distHtml;
    }

    regSelect.onchange = populateProfileDistricts;
    populateProfileDistricts();
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
        showToast("Foto avatar berhasil dipilih. Klik 'Simpan Perubahan' untuk menerapkan.", "info");
      };
      reader.readAsDataURL(file);
    };
  }

  const profileForm = document.getElementById('form-user-profile-settings');
  if (profileForm) {
    profileForm.onsubmit = (e) => {
      e.preventDefault();
      const newPass = newPassInput?.value || '';
      const confirmPass = confirmPassInput?.value || '';

      if (newPass && newPass !== confirmPass) {
        showToast("Konfirmasi password baru tidak cocok.", "error");
        return;
      }

      try {
        const updated = updateProfile({
          name: nameInput?.value,
          storeName: storeNameInput?.value,
          displayName: storeNameInput?.value || nameInput?.value,
          phone: phoneInput?.value,
          email: emailInput?.value,
          region: regSelect?.value,
          district: distSelect?.value,
          bio: bioInput?.value,
          avatar: userProfileAvatarData,
          newPassword: newPass
        });

        currentUser = updated;
        const modal = document.getElementById('modal-user-profile');
        if (modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
          document.body.style.overflow = '';
        }
        renderStoreHeader(updated);
        showToast("Profil & toko berhasil diperbarui!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
  }

  const logoutBtn = document.getElementById('btn-profile-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      logout();
      window.location.href = 'index.html';
    };
  }

  const modal = document.getElementById('modal-user-profile');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  }
}

window.handleProfileNavClick = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  openUserProfileModal();
};

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

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', initTokoSayaPage);
