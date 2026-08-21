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
  deleteListing
} from './services/storage.js';

import { 
  getCurrentUser, 
  getUserById,
  isUserLoggedIn, 
  logout 
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

const PRESET_BARKAS_PHOTOS = {
  sepeda: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80",
  hp: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
  motor: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
  gitar: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80",
  sofa: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
  tv: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80"
};

function initTokoSayaPage() {
  initializeStorage();
  
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
          <span>Toko Terverifikasi Solo Raya</span>
        </span>
      `;
    } else {
      badgeContainer.innerHTML = `
        <span class="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
          <i data-lucide="award" class="w-4 h-4 text-amber-300"></i>
          <span>Toko Member (${verResult.metCount}/5 Syarat Terverifikasi)</span>
        </span>
      `;
    }
  }

  // Checklist Details
  const titleBox = document.getElementById('my-verification-title');
  const iconBox = document.getElementById('my-verification-icon');
  if (titleBox && iconBox) {
    if (verResult.isVerified) {
      titleBox.textContent = `Selamat! Toko Anda telah memenuhi 5/5 Syarat Badge Terverifikasi`;
      titleBox.className = "font-bold text-amber-300";
      iconBox.className = "w-4 h-4 text-emerald-400";
    } else {
      titleBox.textContent = `Progres Verifikasi Toko: ${verResult.metCount}/5 Syarat Terpenuhi`;
      titleBox.className = "font-bold text-amber-200";
      iconBox.className = "w-4 h-4 text-amber-400";
    }
  }

  const cRev = verResult.criteria.reviews;
  const cRat = verResult.criteria.rating;
  const cLis = verResult.criteria.listings;
  const cPro = verResult.criteria.profile;
  const cAge = verResult.criteria.age;

  const setCriteria = (idCheck, idText, isMet, text) => {
    const icon = document.getElementById(idCheck);
    const span = document.getElementById(idText);
    if (icon) {
      icon.className = `w-4 h-4 flex-shrink-0 ${isMet ? 'text-emerald-400' : 'text-slate-500'}`;
      icon.setAttribute('data-lucide', isMet ? 'check-circle-2' : 'circle');
    }
    if (span) {
      span.innerHTML = text;
    }
  };

  setCriteria('check-icon-reviews', 'check-text-reviews', cRev.met, `1. Min 20 Ulasan: <b class="${cRev.met ? 'text-emerald-400' : 'text-amber-300'}">${cRev.current}/${cRev.required} ulasan</b>`);
  setCriteria('check-icon-rating', 'check-text-rating', cRat.met, `2. Rating Min 4.5: <b class="${cRat.met ? 'text-emerald-400' : 'text-amber-300'}">${cRat.current.toFixed(1)} / ${cRat.required}</b>`);
  setCriteria('check-icon-listings', 'check-text-listings', cLis.met, `3. Posting Min 10 Barang: <b class="${cLis.met ? 'text-emerald-400' : 'text-amber-300'}">${cLis.current}/${cLis.required} barang</b>`);
  setCriteria('check-icon-profile', 'check-text-profile', cPro.met, `4. Profil Lengkap: <b class="${cPro.met ? 'text-emerald-400' : 'text-amber-300'}">${cPro.met ? 'Lengkap (Foto, Lokasi, WA)' : 'Belum Lengkap'}</b>`);
  setCriteria('check-icon-age', 'check-text-age', cAge.met, `5. Usia Akun Min 30 Hari: <b class="${cAge.met ? 'text-emerald-400' : 'text-amber-300'}">${cAge.current}/${cAge.required} hari</b>`);

  // Metric Cards
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
      <div class="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs space-y-2 shadow-2xs">
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
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
}

function renderStoreListings(filter = 'all') {
  const container = document.getElementById('my-listings-container');
  const emptyView = document.getElementById('my-listings-empty');
  if (!container || !currentUser) return;

  const myListings = getMyListings(currentUser.id);
  let filtered = myListings;

  if (filter === 'available') {
    filtered = myListings.filter((l) => !l.isSold && l.status !== 'sold' && l.status !== 'booked');
  } else if (filter === 'booked') {
    filtered = myListings.filter((l) => l.status === 'booked');
  } else if (filter === 'sold') {
    filtered = myListings.filter((l) => l.isSold || l.status === 'sold');
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }

  emptyView?.classList.add('hidden');

  let html = '';
  filtered.forEach((item) => {
    const isSold = item.isSold || item.status === 'sold';
    const isBooked = item.status === 'booked';
    const itemStatus = isSold ? 'sold' : isBooked ? 'booked' : 'available';

    const reg = getRegionById(item.regionId);
    const regName = reg ? reg.shortName : 'Solo Raya';
    const locStr = item.district ? `${regName}, Kec. ${item.district}` : regName;

    html += `
      <div class="bg-slate-900/80 border border-slate-800 rounded-3xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl backdrop-blur-md hover:border-slate-700 transition-all">
        <!-- Thumbnail & Info -->
        <div class="flex items-center gap-3.5 w-full sm:w-auto min-w-0">
          <div class="relative w-16 h-20 sm:w-20 sm:h-24 rounded-2xl bg-slate-950 overflow-hidden flex-shrink-0 border border-slate-800">
            <img src="${item.images[0]}" alt="${item.title}" class="w-full h-full object-cover">
            ${isSold ? `
              <div class="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                <span class="bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded">TERJUAL</span>
              </div>
            ` : isBooked ? `
              <div class="absolute top-1 left-1">
                <span class="bg-amber-500 text-white font-black text-[8px] px-1 py-0.5 rounded">BOOKED</span>
              </div>
            ` : ''}
          </div>

          <div class="space-y-1 min-w-0 flex-1">
            <h3 class="font-extrabold text-sm sm:text-base text-white truncate">${item.title}</h3>
            <div class="text-sm font-black text-rose-400">${formatRupiah(item.price)}</div>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-medium pt-0.5">
              <span>${locStr}</span>
              <span>•</span>
              <span>Dilihat: <b class="text-slate-300">${item.views || 0}x</b></span>
            </div>
          </div>
        </div>

        <!-- Status & Action Dropdown -->
        <div class="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
          <!-- Status Selector -->
          <div class="relative">
            <select 
              data-action="change-status" 
              data-id="${item.id}" 
              class="px-3 py-2 rounded-xl text-xs font-black border transition-all ${
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

          <!-- Edit Button (Direct in Toko Saya) -->
          <button 
            type="button"
            data-action="edit-listing" 
            data-id="${item.id}"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer border border-slate-700 hover:scale-105 active:scale-95"
            title="Sunting / Edit Iklan"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit</span>
          </button>
          
          <!-- Delete Button -->
          <button 
            data-action="delete-listing" 
            data-id="${item.id}"
            class="p-2 text-rose-400 hover:text-white hover:bg-rose-900/60 rounded-xl transition-colors cursor-pointer border border-rose-900/40 hover:scale-105 active:scale-95"
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

  // Edit listing direct modal event
  container.querySelectorAll('[data-action="edit-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      openEditListingModal(id);
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

function openCreateListingModal() {
  if (!currentUser) currentUser = getCurrentUser() || getUserById('user-101');
  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = '';
  document.getElementById('form-create-listing-title').textContent = "Pasang Iklan Barkas Solo Raya";
  document.getElementById('form-create-listing-subtitle').textContent = "Jangkau calon pembeli di 7 wilayah Solo Raya";
  document.getElementById('btn-submit-listing-text').textContent = "Tayangkan Iklan Sekarang";
  updateCreateListingSellerInfo();
  resetCreateListingForm();
  openModal('modal-create-listing');
  if (window.lucide) window.lucide.createIcons();
}

function openEditListingModal(id) {
  const listing = getListingById(id);
  if (!listing) return showToast("Barang jualan tidak ditemukan.", "error");
  document.getElementById('form-input-edit-id').value = listing.id;
  document.getElementById('form-create-listing-title').textContent = "Edit Iklan Barang Bekas";
  document.getElementById('form-create-listing-subtitle').textContent = "Perbarui informasi barang jualan Anda";
  document.getElementById('btn-submit-listing-text').textContent = "Simpan Perubahan Iklan";
  updateCreateListingSellerInfo();
  document.getElementById('form-input-title').value = listing.title;
  document.getElementById('form-input-category').value = listing.category || 'lainnya';
  document.getElementById('form-input-condition').value = listing.condition || 'good';
  document.getElementById('form-input-price').value = listing.price || 0;
  document.getElementById('form-input-nego').value = listing.negoType || 'nego_alus';
  document.getElementById('form-input-cod').value = listing.codPoint || '';
  document.getElementById('form-input-desc').value = listing.description || '';
  const regionSelect = document.getElementById('form-region-select');
  if (regionSelect) {
    regionSelect.value = listing.regionId || 'solo';
    const districts = getDistrictsByRegionId(regionSelect.value);
    const districtSelect = document.getElementById('form-district-select');
    if (districtSelect) {
      districtSelect.innerHTML = districts.map(d => `<option value="${d}">Kec. ${d}</option>`).join('');
      districtSelect.value = listing.district || districts[0];
    }
  }
  uploadedImages = [...(listing.images || [])];
  renderFormImagePreviews();
  document.getElementById('price-rupiah-preview').textContent = formatRupiah(listing.price || 0);
  document.getElementById('title-char-count').textContent = `${(listing.title || '').length}/80 karakter`;
  openModal('modal-create-listing');
  if (window.lucide) window.lucide.createIcons();
}

function updateCreateListingSellerInfo() {
  const user = currentUser;
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');
  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
    nameEl.textContent = user.storeName || user.displayName || user.name;
    phoneEl.textContent = `WA: ${formatDisplayPhone(user.phone || '081234567890')}`;
  }
}

function resetCreateListingForm() {
  const form = document.getElementById('form-create-listing');
  if (form) form.reset();
  uploadedImages = [];
  renderFormImagePreviews();
  const pricePreview = document.getElementById('price-rupiah-preview');
  if (pricePreview) pricePreview.textContent = 'Rp 0';
  const charCount = document.getElementById('title-char-count');
  if (charCount) charCount.textContent = '0/80 karakter';
}

function renderFormImagePreviews() {
  const previewContainer = document.getElementById('image-preview-container');
  const counterBadge = document.getElementById('upload-photo-counter');
  const uploadLabel = document.getElementById('file-upload-label');
  if (!previewContainer) return;
  const count = uploadedImages.length;
  if (counterBadge) {
    counterBadge.textContent = `${count}/3 Foto (Rasio 4:5)`;
    counterBadge.className = `text-[11px] font-bold ${count >= 3 ? "text-emerald-800 bg-emerald-50 border border-emerald-300" : "text-rose-800 bg-rose-50 border border-rose-200"} px-2 py-0.5 rounded-md`;
  }
  if (count === 0) {
    previewContainer.classList.add('hidden');
    previewContainer.innerHTML = '';
    if (uploadLabel) uploadLabel.textContent = 'Pilih / Tambah Foto dari HP / Komputer (Maks 3)';
    return;
  }
  previewContainer.classList.remove('hidden');
  if (uploadLabel) uploadLabel.textContent = count < 3 ? `+ Tambah Foto Lagi (${count}/3 Terpilih)` : 'Maksimal 3 Foto Terpenuhi';
  previewContainer.innerHTML = uploadedImages.map((imgUrl, idx) => `
    <div class="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 border-2 border-rose-200 shadow-sm">
      <img src="${imgUrl}" alt="Foto ${idx+1}" class="w-full h-full object-cover">
      <span class="absolute top-1.5 left-1.5 bg-slate-950/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs">${idx === 0 ? 'Utama' : `Foto ${idx+1}`}</span>
      <button type="button" data-remove-idx="${idx}" class="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs transition-transform hover:scale-110 cursor-pointer"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
    </div>`).join('');
  previewContainer.querySelectorAll('[data-remove-idx]').forEach(btn => btn.onclick = () => {
    uploadedImages.splice(parseInt(btn.dataset.removeIdx), 1);
    renderFormImagePreviews();
    if (window.lucide) window.lucide.createIcons();
  });
  if (window.lucide) window.lucide.createIcons();
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('hidden');
  if (!document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]').length) document.body.style.overflow = '';
}

function initEventListeners() {
  document.getElementById('btn-toggle-verification-details')?.addEventListener('click', () => {
    const box = document.getElementById('my-store-verification-details');
    box.classList.toggle('hidden');
    document.getElementById('my-verification-toggle-label').textContent = box.classList.contains('hidden') ? "Lihat Rincian Syarat" : "Sembunyikan Syarat";
  });
  document.querySelectorAll('.store-filter-tab').forEach(tab => tab.onclick = () => {
    document.querySelectorAll('.store-filter-tab').forEach(t => t.classList.toggle('active', t === tab));
    activeStoreFilter = tab.getAttribute('data-store-filter');
    renderStoreListings(activeStoreFilter);
  });
  document.getElementById('nav-btn-traktir')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-traktir-kopi');
  });
  document.getElementById('btn-store-create-listing')?.addEventListener('click', (e) => { e.preventDefault(); openCreateListingModal(); });
  document.getElementById('form-input-price')?.addEventListener('input', (e) => { document.getElementById('price-rupiah-preview').textContent = formatRupiah(Number(e.target.value) || 0); });
  document.getElementById('form-input-title')?.addEventListener('input', (e) => { document.getElementById('title-char-count').textContent = `${e.target.value.length}/80 karakter`; });
  document.querySelectorAll('.btn-preset-photo').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const presetKey = btn.getAttribute('data-preset');
      const imgUrl = PRESET_BARKAS_PHOTOS[presetKey];
      if (imgUrl) {
        if (uploadedImages.length >= 3) {
          showToast("Maksimal 3 foto per barang.", "warning");
          return;
        }
        uploadedImages.push(imgUrl);
        renderFormImagePreviews();
      }
    });
  });
  document.getElementById('form-image-file')?.addEventListener('change', (e) => {
    Array.from(e.target.files).slice(0, 3 - uploadedImages.length).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => { uploadedImages.push(ev.target.result); renderFormImagePreviews(); };
      reader.readAsDataURL(file);
    });
  });
  document.getElementById('form-create-listing')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('form-input-edit-id').value;
    const data = {
      title: document.getElementById('form-input-title').value.trim(),
      category: document.getElementById('form-input-category').value,
      condition: document.getElementById('form-input-condition').value,
      price: Number(document.getElementById('form-input-price').value) || 0,
      negoType: document.getElementById('form-input-nego').value,
      regionId: document.getElementById('form-region-select').value,
      district: document.getElementById('form-district-select').value,
      codPoint: document.getElementById('form-input-cod').value.trim(),
      description: document.getElementById('form-input-desc').value.trim(),
      images: uploadedImages.length ? uploadedImages : ["https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"]
    };
    if (!data.title || !data.description) return showToast("Harap lengkapi judul dan deskripsi.", "error");
    id ? updateListing(id, data) : saveListing(data);
    showToast(id ? "Perubahan disimpan!" : "Iklan berhasil ditayangkan!", "success");
    closeModal('modal-create-listing');
    renderStoreShowcase();
    renderStoreListings(activeStoreFilter);
  });
  document.querySelectorAll('[data-close-modal]').forEach(btn => btn.onclick = () => closeModal(btn.getAttribute('data-close-modal')));
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const colors = { success: 'bg-emerald-800', error: 'bg-rose-800', warning: 'bg-amber-600', info: 'bg-slate-900' };
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2.5 text-xs font-bold transition-all transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i data-lucide="info" class="w-4 h-4"></i><span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();
  requestAnimationFrame(() => { toast.classList.remove('translate-y-2', 'opacity-0'); });
  setTimeout(() => { toast.classList.add('translate-y-2', 'opacity-0'); setTimeout(() => toast.remove(), 300); }, 3500);
}

document.addEventListener('DOMContentLoaded', initTokoSayaPage);
