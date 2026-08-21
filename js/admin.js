/**
 * Pusat Barkas Solo Raya - Admin Panel Controller
 * Protected Admin Panel (Username: ratakanan, Password: 280995)
 */

import { SOLO_RAYA_REGIONS, getRegionById } from './data/regions.js';
import { CATEGORIES, CONDITIONS } from './data/categories.js';
import { formatRupiah, formatDisplayPhone } from './services/whatsapp.js';
import { 
  getAllListings, deleteListing, toggleHideListing, toggleSoldStatus, 
  getSiteSettings, saveSiteSettings, getCustomTexts, saveCustomTexts, 
  resetCustomTexts, initializeStorage 
} from './services/storage.js';

const ADMIN_CREDENTIALS = {
  username: 'ratakanan',
  password: '280995'
};

const ADMIN_AUTH_KEY = 'pusat_barkas_admin_auth';

// Admin State
const adminState = {
  searchQuery: '',
  selectedRegion: 'all',
  selectedStatus: 'all', // 'all', 'active', 'hidden', 'sold'
  currentTab: 'listings' // 'listings', 'settings', 'texts'
};

document.addEventListener('DOMContentLoaded', () => {
  initializeStorage();
  checkAuth();
  initAdminEventListeners();

  // Listen to Online Database Status changes
  window.addEventListener('dbStatusChanged', (e) => {
    const status = e.detail;
    const badgeText = document.getElementById('db-status-text');
    if (badgeText) {
      if (status.syncStatus === 'connected') {
        badgeText.textContent = 'Database Online: Terhubung (Sync Aktif)';
      } else if (status.syncStatus === 'offline') {
        badgeText.textContent = 'Database Offline: Cache Lokal';
      }
    }
  });

  // Listen to remote changes
  window.addEventListener('listingsChanged', () => {
    updateStats();
    renderAdminListings();
  });

  window.addEventListener('siteSettingsChanged', () => {
    populateSettingsForm();
  });

  window.addEventListener('siteTextsChanged', () => {
    populateTextsForm();
  });
});

// -------------------------------------------------------------
// AUTHENTICATION MANAGEMENT
// -------------------------------------------------------------
function checkAuth() {
  const isAuth = sessionStorage.getItem(ADMIN_AUTH_KEY) === 'true';
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');

  if (isAuth) {
    loginView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    loadDashboard();
  } else {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
  }

  if (window.lucide) window.lucide.createIcons();
}

function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('admin-username').value.trim();
  const passwordInput = document.getElementById('admin-password').value.trim();
  const errorAlert = document.getElementById('login-error-alert');
  const errorMsg = document.getElementById('login-error-msg');

  if (usernameInput === ADMIN_CREDENTIALS.username && passwordInput === ADMIN_CREDENTIALS.password) {
    errorAlert.classList.add('hidden');
    sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    showToast("Login Admin Berhasil! Selamat datang, ratakanan.", "success");
    checkAuth();
  } else {
    errorAlert.classList.remove('hidden');
    errorMsg.textContent = "Username atau Password salah! Periksa kembali kredensial Anda.";
    if (window.lucide) window.lucide.createIcons();
  }
}

function handleLogout() {
  sessionStorage.removeItem(ADMIN_AUTH_KEY);
  showToast("Anda telah keluar dari Panel Admin.", "info");
  checkAuth();
}

// -------------------------------------------------------------
// DASHBOARD INITIALIZATION
// -------------------------------------------------------------
function loadDashboard() {
  updateStats();
  renderAdminListings();
  populateSettingsForm();
  populateTextsForm();
}

function updateStats() {
  const listings = getAllListings();
  
  const total = listings.length;
  const active = listings.filter((l) => !l.isHidden && !l.isSold).length;
  const hidden = listings.filter((l) => l.isHidden).length;
  const sold = listings.filter((l) => l.isSold).length;

  document.getElementById('stat-total-listings').textContent = total;
  document.getElementById('stat-active-listings').textContent = active;
  document.getElementById('stat-hidden-listings').textContent = hidden;
  document.getElementById('stat-sold-listings').textContent = sold;
}

// -------------------------------------------------------------
// TAB 1: LISTINGS MODERATION & MANAGEMENT
// -------------------------------------------------------------
function renderAdminListings() {
  const tbody = document.getElementById('admin-listings-table-body');
  const emptyView = document.getElementById('admin-table-empty');
  const countBadge = document.getElementById('admin-table-count');
  if (!tbody) return;

  let listings = getAllListings();

  if (adminState.searchQuery) {
    const q = adminState.searchQuery.toLowerCase();
    listings = listings.filter((l) => {
      const titleMatch = l.title.toLowerCase().includes(q);
      const sellerMatch = l.seller && l.seller.displayName && l.seller.displayName.toLowerCase().includes(q);
      const descMatch = l.description && l.description.toLowerCase().includes(q);
      return titleMatch || sellerMatch || descMatch;
    });
  }

  if (adminState.selectedRegion !== 'all') {
    listings = listings.filter((l) => l.regionId === adminState.selectedRegion);
  }

  if (adminState.selectedStatus === 'active') {
    listings = listings.filter((l) => !l.isHidden && !l.isSold);
  } else if (adminState.selectedStatus === 'hidden') {
    listings = listings.filter((l) => l.isHidden);
  } else if (adminState.selectedStatus === 'sold') {
    listings = listings.filter((l) => l.isSold);
  }

  if (countBadge) countBadge.textContent = listings.length;

  if (listings.length === 0) {
    tbody.innerHTML = '';
    emptyView.classList.remove('hidden');
    return;
  }

  emptyView.classList.add('hidden');

  let rowsHtml = '';
  listings.forEach((item) => {
    const region = getRegionById(item.regionId);
    const regionName = region ? region.name : item.regionId;
    const cat = CATEGORIES.find((c) => c.id === item.category);
    const cond = CONDITIONS.find((c) => c.id === item.condition);
    const sellerName = item.seller?.displayName || item.seller?.name || 'Penjual';
    const sellerPhone = item.seller?.phone ? formatDisplayPhone(item.seller.phone) : '-';

    let statusBadge = '';
    if (item.isHidden) {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-900/80 text-purple-200 border border-purple-700 flex items-center gap-1 w-fit"><i data-lucide="eye-off" class="w-3 h-3"></i> Disembunyikan</span>`;
    } else if (item.isSold) {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-900/80 text-rose-200 border border-rose-700 flex items-center gap-1 w-fit"><i data-lucide="tag" class="w-3 h-3"></i> Terjual (Sold)</span>`;
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-700 flex items-center gap-1 w-fit"><i data-lucide="check" class="w-3 h-3"></i> Tayang (Aktif)</span>`;
    }

    rowsHtml += `
      <tr class="hover:bg-slate-700/40 transition-colors ${item.isHidden ? 'opacity-70 bg-purple-950/20' : ''}">
        <td class="p-3.5">
          <div class="flex items-center gap-3">
            <img src="${item.images[0]}" alt="${item.title}" class="w-12 h-12 rounded-xl object-cover border border-slate-700 flex-shrink-0 bg-slate-900">
            <div class="min-w-0 max-w-[220px]">
              <div class="font-bold text-white truncate text-xs" title="${item.title}">${item.title}</div>
              <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <span class="text-amber-400 font-semibold">${cond ? cond.label.split('(')[0] : 'Normal'}</span>
                <span>•</span>
                <span class="truncate">${item.codPoint || '-'}</span>
              </div>
            </div>
          </div>
        </td>

        <td class="p-3.5">
          <div class="font-extrabold text-rose-400 text-xs">${formatRupiah(item.price)}</div>
          <div class="text-[11px] text-slate-400 mt-0.5">${cat ? cat.name : item.category}</div>
        </td>

        <td class="p-3.5">
          <div class="font-semibold text-slate-200 flex items-center gap-1">
            <i data-lucide="map-pin" class="w-3.5 h-3.5 text-rose-500"></i>
            <span>${regionName}</span>
          </div>
          <div class="text-[11px] text-slate-400">Kec. ${item.district || '-'}</div>
        </td>

        <td class="p-3.5">
          <div class="font-bold text-slate-200 flex items-center gap-1">
            <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
            <span class="truncate max-w-[140px]">${sellerName}</span>
          </div>
          <div class="text-[11px] text-emerald-400 font-mono mt-0.5">${sellerPhone}</div>
        </td>

        <td class="p-3.5">
          ${statusBadge}
        </td>

        <td class="p-3.5 text-right">
          <div class="flex items-center justify-end gap-1.5 flex-wrap">
            <button 
              data-action="toggle-hide" 
              data-id="${item.id}"
              class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                item.isHidden 
                  ? 'bg-purple-600 hover:bg-purple-500 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }"
              title="${item.isHidden ? 'Tampilkan kembali iklan ke publik' : 'Sembunyikan iklan dari marketplace publik'}"
            >
              <i data-lucide="${item.isHidden ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
              <span>${item.isHidden ? 'Tampilkan' : 'Sembunyikan'}</span>
            </button>

            <button 
              data-action="toggle-sold" 
              data-id="${item.id}"
              class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                item.isSold 
                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white' 
                  : 'bg-amber-600/80 hover:bg-amber-600 text-white'
              }"
              title="Ubah status terjual"
            >
              <i data-lucide="${item.isSold ? 'check' : 'tag'}" class="w-3.5 h-3.5"></i>
              <span>${item.isSold ? 'Aktifkan' : 'Terjual'}</span>
            </button>

            <button 
              data-action="delete" 
              data-id="${item.id}"
              class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 transition-colors flex items-center gap-1"
              title="Hapus iklan secara permanen"
            >
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>Hapus</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;

  tbody.querySelectorAll('[data-action="toggle-hide"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const updated = toggleHideListing(id);
      updateStats();
      renderAdminListings();
      showToast(
        updated.isHidden 
          ? "Iklan berhasil disembunyikan dari pengunjung publik!" 
          : "Iklan kembali ditampilkan ke marketplace publik!", 
        updated.isHidden ? "warning" : "success"
      );
    });
  });

  tbody.querySelectorAll('[data-action="toggle-sold"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const updated = toggleSoldStatus(id);
      updateStats();
      renderAdminListings();
      showToast(
        updated.isSold 
          ? "Iklan ditandai Terjual!" 
          : "Iklan kembali Tersedia!", 
        "info"
      );
    });
  });

  tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Apakah Anda yakin ingin MENGHAPUS PERMANEN iklan barang ini? Tindakan ini tidak dapat dibatalkan.")) {
        deleteListing(id);
        updateStats();
        renderAdminListings();
        showToast("Iklan berhasil dihapus secara permanen.", "info");
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// TAB 2: ADVANCED SETTINGS (BRANDING TEKS & TIPOGRAFI)
// -------------------------------------------------------------

function populateSettingsForm() {
  const settings = getSiteSettings();
  const texts = getCustomTexts();
  const form = document.getElementById('form-site-settings');
  if (!form) return;

  // 1. Branding Header Texts
  const nameInput = document.getElementById('setting-brand-name');
  if (nameInput) nameInput.value = texts.brand_name || 'Pusat Barkas';

  const taglineInput = document.getElementById('setting-brand-tagline');
  if (taglineInput) taglineInput.value = texts.brand_tagline || 'Solo Raya';

  const subtaglineInput = document.getElementById('setting-brand-subtagline');
  if (subtaglineInput) subtaglineInput.value = texts.brand_subtagline || 'Pantau Cocok Bayar • Nego Langsung WA';

  // 2. Font & Filter
  const fontRadio = form.querySelector(`input[name="fontFamily"][value="${settings.fontFamily}"]`);
  if (fontRadio) fontRadio.checked = true;

  const filterPosRadio = form.querySelector(`input[name="filterPosition"][value="${settings.filterPosition}"]`);
  if (filterPosRadio) filterPosRadio.checked = true;

  const showAnn = document.getElementById('setting-show-announcement');
  const annText = document.getElementById('setting-announcement-text');
  if (showAnn) showAnn.checked = settings.showAnnouncement !== false;
  if (annText) annText.value = settings.announcementText || '';
}

function handleSaveSettings(e) {
  e.preventDefault();
  const form = document.getElementById('form-site-settings');
  const formData = new FormData(form);

  const brandName = (document.getElementById('setting-brand-name')?.value || 'Pusat Barkas').trim();
  const brandTagline = (document.getElementById('setting-brand-tagline')?.value || 'Solo Raya').trim();
  const brandSubtagline = (document.getElementById('setting-brand-subtagline')?.value || 'Pantau Cocok Bayar • Nego Langsung WA').trim();

  // Save Site Settings (Font, Announcement, Filter Position)
  const currentSettings = getSiteSettings();
  const newSettings = {
    ...currentSettings,
    fontFamily: formData.get('fontFamily') || 'sans',
    layoutStyle: 'grid',
    layoutColumns: 'grid3',
    filterPosition: formData.get('filterPosition') || 'below_hero',
    showAnnouncement: document.getElementById('setting-show-announcement').checked,
    announcementText: document.getElementById('setting-announcement-text').value.trim(),
    updatedAt: new Date().toISOString()
  };
  saveSiteSettings(newSettings);

  // Save Branding Custom Texts (Brand Name, Tagline, Sub-tagline)
  const currentTexts = getCustomTexts();
  const updatedTexts = {
    ...currentTexts,
    brand_name: brandName,
    brand_tagline: brandTagline,
    brand_subtagline: brandSubtagline,
    updatedAt: new Date().toISOString()
  };
  saveCustomTexts(updatedTexts);

  showToast("🎉 Pengaturan Branding Teks, Tipografi, & Header berhasil disimpan!", "success");
}

// -------------------------------------------------------------
// TAB 3: GLOBAL TEXT EDITOR (EDIT TEKS TANPA TERKECUALI)
// -------------------------------------------------------------
function populateTextsForm() {
  const texts = getCustomTexts();
  Object.keys(texts).forEach((key) => {
    const input = document.getElementById(`text-${key}`);
    if (input) {
      input.value = texts[key];
    }
  });
}

function handleSaveTexts(e) {
  e.preventDefault();
  const form = document.getElementById('form-custom-texts');
  const formData = new FormData(form);

  const newTexts = {};
  for (const [key, value] of formData.entries()) {
    newTexts[key] = value.trim();
  }

  saveCustomTexts(newTexts);
  showToast("Seluruh teks berhasil diperbarui dan tersimpan permanen ke database!", "success");
}

function handleResetTexts() {
  if (confirm("Kembalikan seluruh teks aplikasi ke pengaturan standar awal?")) {
    const defaults = resetCustomTexts();
    populateTextsForm();
    populateSettingsForm();
    showToast("Seluruh teks telah dikembalikan ke standar awal.", "info");
  }
}

// -------------------------------------------------------------
// EVENT LISTENERS INITIALIZATION
// -------------------------------------------------------------
function initAdminEventListeners() {
  // Login Form
  document.getElementById('form-admin-login')?.addEventListener('submit', handleLogin);

  // Logout Button
  document.getElementById('btn-admin-logout')?.addEventListener('click', handleLogout);

  // 3-Tab Switchers
  const tabListingsBtn = document.getElementById('tab-btn-listings');
  const tabSettingsBtn = document.getElementById('tab-btn-settings');
  const tabTextsBtn = document.getElementById('tab-btn-texts');

  const contentListings = document.getElementById('tab-content-listings');
  const contentSettings = document.getElementById('tab-content-settings');
  const contentTexts = document.getElementById('tab-content-texts');

  function setTab(activeTab) {
    adminState.currentTab = activeTab;

    tabListingsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-slate-800 text-slate-400 hover:text-white border border-slate-700 flex-shrink-0";
    tabSettingsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-slate-800 text-slate-400 hover:text-white border border-slate-700 flex-shrink-0";
    tabTextsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-slate-800 text-slate-400 hover:text-white border border-slate-700 flex-shrink-0";

    contentListings.classList.add('hidden');
    contentSettings.classList.add('hidden');
    contentTexts.classList.add('hidden');

    if (activeTab === 'listings') {
      tabListingsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-rose-900 text-white shadow-sm flex-shrink-0";
      contentListings.classList.remove('hidden');
      renderAdminListings();
    } else if (activeTab === 'settings') {
      tabSettingsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-rose-900 text-white shadow-sm flex-shrink-0";
      contentSettings.classList.remove('hidden');
      populateSettingsForm();
    } else if (activeTab === 'texts') {
      tabTextsBtn.className = "admin-tab-btn flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all bg-rose-900 text-white shadow-sm flex-shrink-0";
      contentTexts.classList.remove('hidden');
      populateTextsForm();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  tabListingsBtn?.addEventListener('click', () => setTab('listings'));
  tabSettingsBtn?.addEventListener('click', () => setTab('settings'));
  tabTextsBtn?.addEventListener('click', () => setTab('texts'));

  // Search & Filter in Admin Table
  document.getElementById('admin-search-input')?.addEventListener('input', (e) => {
    adminState.searchQuery = e.target.value;
    renderAdminListings();
  });

  document.getElementById('admin-region-filter')?.addEventListener('change', (e) => {
    adminState.selectedRegion = e.target.value;
    renderAdminListings();
  });

  document.getElementById('admin-status-filter')?.addEventListener('change', (e) => {
    adminState.selectedStatus = e.target.value;
    renderAdminListings();
  });

  // Settings Form Submit
  document.getElementById('form-site-settings')?.addEventListener('submit', handleSaveSettings);

  // Texts Form Submit & Reset
  document.getElementById('form-custom-texts')?.addEventListener('submit', handleSaveTexts);
  document.getElementById('btn-reset-texts-default')?.addEventListener('click', handleResetTexts);
}

// -------------------------------------------------------------
// TOAST HELPER
// -------------------------------------------------------------
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let iconName = 'info';
  let bgClass = 'bg-slate-800 text-white border border-slate-700';

  if (type === 'success') {
    iconName = 'check-circle';
    bgClass = 'bg-emerald-900 text-emerald-100 border border-emerald-700';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    bgClass = 'bg-amber-900 text-amber-100 border border-amber-700';
  } else if (type === 'error') {
    iconName = 'alert-circle';
    bgClass = 'bg-rose-900 text-rose-100 border border-rose-700';
  }

  toast.className = `toast-item flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold ${bgClass} transition-all pointer-events-auto`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
