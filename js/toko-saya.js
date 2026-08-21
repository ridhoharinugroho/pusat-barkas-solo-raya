/**
 * Toko Saya Standalone Page Controller
 * Pusat Barkas Solo Raya 7 Wilayah
 */
import { 
  initializeStorage, 
  getAllListings, 
  getMyListings, 
  getSellerStats, 
  getSellerReviews, 
  getSellerRatingStats, 
  checkSellerVerification,
  updateListingStatus,
  deleteListing
} from './services/storage.js';

import { 
  getCurrentUser, 
  isUserLoggedIn, 
  logout 
} from './services/auth.js';

import { 
  formatRupiah, 
  formatDisplayPhone 
} from './services/whatsapp.js';

import { getRegionById } from './data/regions.js';

let activeStoreFilter = 'all';
let currentUser = null;

function initTokoSayaPage() {
  initializeStorage();
  
  // Resolve current user session (fail-safe to Danang Barkas Manahan)
  currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = 'index.html#login';
    return;
  }

  renderAuthHeader();
  renderStoreShowcase();
  renderStoreReviews();
  renderStoreListings(activeStoreFilter);
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
  if (locEl) locEl.textContent = user.district ? `${user.region ? user.region.toUpperCase() : 'SOLO'} • Kec. ${user.district}` : (user.region ? user.region.toUpperCase() : 'SOLO RAYA');

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
  if (badgeContainer) {
    if (verResult.isVerified) {
      badgeContainer.innerHTML = `
        <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
          <i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>
          <span>🛡️ Toko Lokal ${user.region ? user.region.toUpperCase() : 'Solo'} Terverifikasi</span>
        </span>
      `;
    } else {
      badgeContainer.innerHTML = `
        <span class="bg-slate-700/80 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-300"></i>
          <span>Toko Member (Belum Terverifikasi)</span>
        </span>
      `;
    }
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
  const ratingStats = getSellerRatingStats(currentUser.id);
  const reviews = getSellerReviews(currentUser.id);

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
    html += `
      <div class="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs space-y-1.5 shadow-2xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-black text-white">${r.buyerName}</span>
            <span class="text-[10px] text-slate-400">${dStr}</span>
          </div>
          <span class="text-amber-400 font-black tracking-widest">${'★'.repeat(r.rating)}</span>
        </div>
        <p class="text-slate-300 font-medium">"${r.comment}"</p>
      </div>
    `;
  });

  container.innerHTML = html;
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

  // Pasang Iklan Button Handlers
  document.querySelectorAll('#btn-store-create-listing, #btn-empty-create-listing').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'index.html?action=create-listing#pasang-iklan';
    });
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

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let iconName = 'info';
  let bgClass = 'bg-slate-900 text-white';

  if (type === 'success') {
    iconName = 'check-circle';
    bgClass = 'bg-emerald-800 text-white';
  } else if (type === 'error') {
    iconName = 'alert-triangle';
    bgClass = 'bg-rose-800 text-white';
  } else if (type === 'warning') {
    iconName = 'alert-circle';
    bgClass = 'bg-amber-600 text-white';
  }

  toast.className = `${bgClass} px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5 text-xs font-bold transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Run when DOM is ready
document.addEventListener('DOMContentLoaded', initTokoSayaPage);
