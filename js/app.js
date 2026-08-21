/**
 * Pusat Barkas Solo Raya - Main Application Controller
 * Pasang & Cari Barang Bekas di 7 Wilayah Solo Raya
 */

import { SOLO_RAYA_REGIONS, getRegionById, getDistrictsByRegionId } from './data/regions.js';
import { CATEGORIES, CONDITIONS, NEGO_TYPES } from './data/categories.js';
import { formatRupiah, generateWhatsAppUrl, generateShareWhatsAppUrl, timeAgo, formatDisplayPhone } from './services/whatsapp.js';
import { 
  getCurrentUser, isUserLoggedIn, loginWithGoogle, updateProfile, 
  logout, subscribeAuth, PRESET_GOOGLE_ACCOUNTS 
} from './services/auth.js';
import { 
  initializeStorage, getPublicListings, getListingById, saveListing, 
  toggleSoldStatus, deleteListing, incrementListingViews, getMyListings, 
  toggleFavorite, isFavorite, getSiteSettings, getCustomTexts,
  saveSiteSettings, saveCustomTexts
} from './services/storage.js';

// Preset sample photos for rapid testing
const PRESET_SAMPLE_PHOTOS = {
  sepeda: "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?auto=format&fit=crop&w=800&q=80",
  hp: "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&w=800&q=80",
  motor: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80",
  gitar: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80",
  sofa: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
  tv: "https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&w=800&q=80"
};

// Application State
const state = {
  selectedRegion: 'all',
  selectedDistrict: 'all',
  selectedCategory: 'all',
  selectedCondition: 'all',
  searchQuery: '',
  minPrice: null,
  maxPrice: null,
  sortBy: 'newest',
  currentDetailListing: null,
  uploadedImages: [], // Max 3 photos (Aspect 4:5)
  currentUser: null,
  siteSettings: getSiteSettings(),
  customTexts: getCustomTexts(),
  isVisualEditorActive: false
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initializeStorage();
  
  // Apply initial site appearance & custom texts from database
  applySiteSettings(state.siteSettings);
  applyCustomTexts(state.customTexts);

  // Auth state listener
  subscribeAuth((user) => {
    state.currentUser = user;
    renderAuthNav();
    updateCreateListingSellerInfo();
  });

  // Listen to Admin Settings Changes (Instant real-time sync)
  window.addEventListener('siteSettingsChanged', (e) => {
    state.siteSettings = e.detail;
    applySiteSettings(e.detail);
  });

  // Listen to Admin Text Changes (Instant real-time sync)
  window.addEventListener('siteTextsChanged', (e) => {
    state.customTexts = e.detail;
    applyCustomTexts(e.detail);
  });

  // Listen to Listings Changes (Online real-time sync)
  window.addEventListener('listingsChanged', () => {
    renderRegionPills();
    renderListings();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'pusat_barkas_site_settings') {
      state.siteSettings = getSiteSettings();
      applySiteSettings(state.siteSettings);
    } else if (e.key === 'pusat_barkas_custom_texts') {
      state.customTexts = getCustomTexts();
      applyCustomTexts(state.customTexts);
    } else if (e.key === 'pusat_barkas_listings') {
      renderRegionPills();
      renderListings();
    }
  });

  renderRegionPills();
  renderCategoryPills();
  populateFormRegions();
  populateFilterModalOptions();
  renderListings();
  initEventListeners();
  initLiveVisualEditor();
  
  handleInitialUrlParams();
  
  if (window.lucide) window.lucide.createIcons();
});

// -------------------------------------------------------------
// LIVE VISUAL IN-PLACE EDITOR CONTROLLER
// -------------------------------------------------------------
function initLiveVisualEditor() {
  let clickCount = 0;
  let clickTimer = null;
  const brandLogo = document.getElementById('brand-logo');

  // 5-Clicks Hidden Trigger on Brand Logo
  brandLogo?.addEventListener('click', (e) => {
    clickCount++;
    clearTimeout(clickTimer);

    if (clickCount >= 5) {
      e.preventDefault();
      clickCount = 0;

      const isAuth = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
      if (isAuth) {
        if (state.isVisualEditorActive) {
          disableVisualEditor();
        } else {
          enableVisualEditor();
        }
      } else {
        openAdminLoginModal();
      }
      return;
    }

    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 2500);
  });

  // Admin Login Modal Form Handler
  const loginForm = document.getElementById('form-modal-admin-login');
  loginForm?.addEventListener('submit', handleModalAdminLogin);

  // Floating Control Bar Action Buttons
  document.getElementById('btn-save-live-visual')?.addEventListener('click', saveVisualChanges);
  document.getElementById('btn-exit-live-visual')?.addEventListener('click', disableVisualEditor);
  document.getElementById('btn-exit-live-visual-mobile')?.addEventListener('click', disableVisualEditor);
  document.getElementById('btn-open-text-modal')?.addEventListener('click', openQuickTextModal);
  document.getElementById('btn-download-texts-json')?.addEventListener('click', downloadTextsJson);

  // Quick Text Modal Form Handler
  document.getElementById('form-quick-edit-all-texts')?.addEventListener('submit', handleQuickTextFormSubmit);
  document.getElementById('btn-reset-to-default-texts')?.addEventListener('click', handleResetDefaultTexts);

  // Quick Font Switcher
  document.querySelectorAll('[data-quick-font]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const font = btn.getAttribute('data-quick-font');
      state.siteSettings.fontFamily = font;
      applySiteSettings(state.siteSettings);
      saveSiteSettings(state.siteSettings);
      updateQuickSwitcherActiveStates();
      showToast(`Font diubah ke: ${font.toUpperCase()}`, 'info');
    });
  });

  // Quick Layout Switcher
  document.querySelectorAll('[data-quick-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const layout = btn.getAttribute('data-quick-layout');
      state.siteSettings.layoutStyle = layout;
      applySiteSettings(state.siteSettings);
      saveSiteSettings(state.siteSettings);
      updateQuickSwitcherActiveStates();
      showToast(`Tata letak diubah ke: ${layout.toUpperCase()}`, 'info');
    });
  });
}

function openQuickTextModal() {
  const modal = document.getElementById('modal-edit-all-texts');
  if (!modal) return;

  const texts = getCustomTexts();
  const keys = [
    'announcement_text',
    'brand_name', 'brand_tagline', 'brand_subtagline', 'hero_title', 
    'hero_subtitle', 'btn_pasang_iklan', 'search_placeholder', 
    'terms_content', 'copyright_text'
  ];

  keys.forEach((k) => {
    const el = document.getElementById(`quick-text-${k}`);
    if (el) el.value = texts[k] || '';
  });

  openModal('modal-edit-all-texts');
}

function handleQuickTextFormSubmit(e) {
  e.preventDefault();
  const keys = [
    'announcement_text',
    'brand_name', 'brand_tagline', 'brand_subtagline', 'hero_title', 
    'hero_subtitle', 'btn_pasang_iklan', 'search_placeholder', 
    'terms_content', 'copyright_text'
  ];

  const updated = { ...state.customTexts };
  keys.forEach((k) => {
    const el = document.getElementById(`quick-text-${k}`);
    if (el) updated[k] = el.value.trim();
  });

  const saved = saveCustomTexts(updated);
  state.customTexts = saved;
  applyCustomTexts(saved);
  closeModal('modal-edit-all-texts');
  showToast("💾 Seluruh teks berhasil disimpan secara permanen!", "success");
}

function handleResetDefaultTexts() {
  if (confirm("Kembalikan seluruh teks aplikasi ke pengaturan standar awal?")) {
    const res = resetCustomTexts();
    state.customTexts = res;
    applyCustomTexts(res);
    closeModal('modal-edit-all-texts');
    showToast("🔄 Seluruh teks dikembalikan ke standar awal.", "info");
  }
}

function downloadTextsJson() {
  const texts = getCustomTexts();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(texts, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "custom_texts.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("📥 Berkas custom_texts.json berhasil diunduh!", "success");
}

function openAdminLoginModal() {
  const modal = document.getElementById('modal-admin-login');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('modal-login-error')?.classList.add('hidden');
    const uInput = document.getElementById('modal-admin-username');
    const pInput = document.getElementById('modal-admin-password');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    setTimeout(() => {
      uInput?.focus();
    }, 100);
    if (window.lucide) window.lucide.createIcons();
  }
}

function closeAdminLoginModal() {
  const modal = document.getElementById('modal-admin-login');
  if (modal) modal.classList.add('hidden');
}

function handleModalAdminLogin(e) {
  e.preventDefault();
  const u = document.getElementById('modal-admin-username').value.trim();
  const p = document.getElementById('modal-admin-password').value.trim();
  const errorBox = document.getElementById('modal-login-error');

  if (u === 'ratakanan' && p === '280995') {
    sessionStorage.setItem('pusat_barkas_admin_auth', 'true');
    closeAdminLoginModal();
    enableVisualEditor();
    showToast("🎉 Akses Berhasil! Mode Live Visual Editor Aktif. Klik langsung teks apa saja untuk mengedit.", "success");
  } else {
    if (errorBox) {
      errorBox.classList.remove('hidden');
      errorBox.classList.add('animate-bounce');
      setTimeout(() => errorBox.classList.remove('animate-bounce'), 800);
    }
  }
}

function enableVisualEditor() {
  state.isVisualEditorActive = true;
  document.body.classList.add('visual-editor-active');
  const bar = document.getElementById('floating-live-editor-bar');
  if (bar) {
    bar.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // Make all user-facing text elements directly editable
  document.querySelectorAll('[data-text-key]').forEach((el) => {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      // Inputs are naturally editable
    } else {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    }
  });

  updateQuickSwitcherActiveStates();
}

function disableVisualEditor() {
  state.isVisualEditorActive = false;
  document.body.classList.remove('visual-editor-active');
  const bar = document.getElementById('floating-live-editor-bar');
  if (bar) bar.classList.add('hidden');

  document.querySelectorAll('[data-text-key]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });

  showToast("Mode Live Visual Editor dinonaktifkan.", "info");
}

function updateQuickSwitcherActiveStates() {
  const currentFont = state.siteSettings?.fontFamily || 'sans';
  const currentLayout = state.siteSettings?.layoutStyle || 'grid';

  document.querySelectorAll('[data-quick-font]').forEach((btn) => {
    if (btn.getAttribute('data-quick-font') === currentFont) {
      btn.className = "px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shadow";
    } else {
      btn.className = "px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-300 text-[11px] font-bold";
    }
  });

  document.querySelectorAll('[data-quick-layout]').forEach((btn) => {
    if (btn.getAttribute('data-quick-layout') === currentLayout) {
      btn.className = "px-2 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold shadow";
    } else {
      btn.className = "px-2 py-1 rounded-lg hover:bg-slate-800 text-slate-300 text-[11px] font-bold";
    }
  });
}

function saveVisualChanges() {
  const collectedTexts = { ...state.customTexts };

  document.querySelectorAll('[data-text-key]').forEach((el) => {
    const key = el.getAttribute('data-text-key');
    if (!key) return;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      if (key === 'search_placeholder' || el.hasAttribute('placeholder')) {
        const typedVal = el.value ? el.value.trim() : '';
        if (typedVal !== '') {
          collectedTexts[key] = typedVal;
          el.setAttribute('placeholder', typedVal);
        } else if (el.placeholder) {
          collectedTexts[key] = el.placeholder.trim();
        }
      } else {
        const typedVal = el.value ? el.value.trim() : '';
        if (typedVal !== '') collectedTexts[key] = typedVal;
      }
    } else {
      const raw = (el.innerText || el.textContent || '').trim();
      if (raw !== '') {
        collectedTexts[key] = raw;
      }
    }
  });

  // Save to persistent storage and broadcast real-time
  const saved = saveCustomTexts(collectedTexts);
  saveSiteSettings(state.siteSettings);
  state.customTexts = saved;

  // Apply immediately across page
  applyCustomTexts(saved);
  applySiteSettings(state.siteSettings);

  // Button visual feedback
  const saveBtn = document.getElementById('btn-save-live-visual');
  if (saveBtn) {
    const originalHtml = saveBtn.innerHTML;
    saveBtn.innerHTML = `
      <i data-lucide="check" class="w-4 h-4 text-white"></i>
      <span>Tersimpan Permanen!</span>
    `;
    saveBtn.classList.remove('from-emerald-600', 'to-teal-600');
    saveBtn.classList.add('from-emerald-500', 'to-green-500', 'scale-105');

    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      saveBtn.innerHTML = originalHtml;
      saveBtn.classList.remove('from-emerald-500', 'to-green-500', 'scale-105');
      saveBtn.classList.add('from-emerald-600', 'to-teal-600');
      if (window.lucide) window.lucide.createIcons();
    }, 2000);
  }

  showToast("💾 Seluruh perubahan teks & visual berhasil disimpan permanen!", "success");
}

// -------------------------------------------------------------
// GLOBAL CUSTOM TEXTS APPLIER
// -------------------------------------------------------------
function applyCustomTexts(texts) {
  if (!texts) return;
  state.customTexts = texts;

  document.querySelectorAll('[data-text-key]').forEach((el) => {
    const key = el.getAttribute('data-text-key');
    if (texts[key] !== undefined) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.hasAttribute('placeholder')) {
          el.setAttribute('placeholder', texts[key]);
        } else {
          el.value = texts[key];
        }
      } else {
        el.textContent = texts[key];
      }
    }
  });

  const indicator = document.getElementById('region-current-indicator');
  if (indicator && state.selectedRegion === 'all') {
    indicator.textContent = texts.region_indicator_all || 'Menampilkan: 7 Wilayah Solo Raya';
  }
}

// -------------------------------------------------------------
// DYNAMIC SITE APPEARANCE & LAYOUT SETTINGS (FROM ADMIN)
// -------------------------------------------------------------
function applySiteSettings(settings) {
  if (!settings) return;

  // 1. Font Family
  document.body.classList.remove('font-sans', 'font-serif', 'font-mono', 'font-poppins');
  if (settings.fontFamily === 'serif') {
    document.body.classList.add('font-serif');
  } else if (settings.fontFamily === 'mono') {
    document.body.classList.add('font-mono');
  } else if (settings.fontFamily === 'poppins') {
    document.body.classList.add('font-poppins');
  } else {
    document.body.classList.add('font-sans');
  }

  // 2. Filter Position (Above Hero vs Below Hero)
  const heroSection = document.getElementById('hero-banner-section');
  const regionSection = document.getElementById('region-filter-section');
  const mainContainer = document.getElementById('main-content-container');

  if (heroSection && regionSection && mainContainer) {
    if (settings.filterPosition === 'above_hero') {
      mainContainer.insertBefore(regionSection, heroSection);
    } else {
      mainContainer.insertBefore(heroSection, regionSection);
    }
  }

  // 3. Site Announcement Banner
  const announcementBar = document.getElementById('site-announcement-bar');
  const announcementText = document.getElementById('site-announcement-text');
  if (announcementBar && announcementText) {
    if (settings.showAnnouncement !== false) {
      announcementBar.classList.remove('hidden');
      if (state.customTexts && state.customTexts.announcement_text) {
        announcementText.textContent = state.customTexts.announcement_text;
      } else if (settings.announcementText) {
        announcementText.textContent = settings.announcementText;
      }
    } else {
      announcementBar.classList.add('hidden');
    }
  }

  // 4. Re-render listings grid to apply list/grid layout
  renderListings();
}

// Render Auth Header
function renderAuthNav() {
  const container = document.getElementById('auth-nav-container');
  const user = state.currentUser;
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <button id="btn-header-login" class="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold shadow-sm transition-all">
        <svg class="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span class="hidden sm:inline">Masuk</span> Google
      </button>
    `;
    document.getElementById('btn-header-login')?.addEventListener('click', () => openGoogleAuthModal());
  } else {
    container.innerHTML = `
      <div class="relative group">
        <button id="btn-header-user-menu" class="flex items-center gap-2 p-1 pr-2.5 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors">
          <img src="${user.avatar}" alt="${user.displayName}" class="w-7 h-7 rounded-full object-cover border border-slate-300">
          <span class="text-xs font-bold text-slate-800 max-w-[120px] truncate hidden sm:inline">${user.displayName || user.googleName}</span>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-500"></i>
        </button>

        <div class="hidden group-hover:block absolute right-0 top-full pt-1 w-56 z-50">
          <div class="bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 text-xs text-slate-700">
            <div class="px-3.5 py-2 border-b border-slate-100">
              <div class="font-extrabold text-slate-900 truncate">${user.displayName || user.googleName}</div>
              <div class="text-[11px] text-slate-500 truncate">${user.email}</div>
              <div class="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <i data-lucide="phone" class="w-3 h-3"></i>
                <span>WA: ${user.phone ? formatDisplayPhone(user.phone) : 'Belum diatur'}</span>
              </div>
            </div>

            <button id="menu-btn-my-listings" class="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 font-semibold">
              <i data-lucide="package" class="w-4 h-4 text-slate-500"></i>
              <span>Kelola Iklan Saya</span>
            </button>

            <button id="menu-btn-edit-display-name" class="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 font-semibold">
              <i data-lucide="user-cog" class="w-4 h-4 text-slate-500"></i>
              <span>Ubah Nama Akun / WA</span>
            </button>

            <div class="border-t border-slate-100 my-1"></div>

            <button id="menu-btn-logout" class="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('menu-btn-my-listings')?.addEventListener('click', () => openMyListingsModal());
    document.getElementById('menu-btn-edit-display-name')?.addEventListener('click', () => openDisplayNameSetupModal());
    document.getElementById('menu-btn-logout')?.addEventListener('click', () => {
      logout();
      showToast("Anda telah keluar dari akun.", "info");
    });
  }

  if (window.lucide) window.lucide.createIcons();
}
// Render 7 Solo Raya Region Filter Pills
function renderRegionPills() {
  const container = document.getElementById('region-pills-container');
  if (!container) return;

  const listings = getPublicListings();
  const allCount = listings.length;

  let html = `
    <button 
      data-region="all" 
      class="region-pill flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
        state.selectedRegion === 'all' 
          ? 'bg-rose-900 text-white border-rose-900 shadow-sm' 
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
      }"
    >
      <span>🌟 Semua Wilayah</span>
      <span class="px-1.5 py-0.2 rounded-full text-[10px] ${
        state.selectedRegion === 'all' ? 'bg-rose-800 text-amber-300' : 'bg-slate-100 text-slate-600'
      }">${allCount}</span>
    </button>
  `;

  SOLO_RAYA_REGIONS.forEach((reg) => {
    const isSelected = state.selectedRegion === reg.id;
    const count = listings.filter((l) => l.regionId === reg.id).length;

    html += `
      <button 
        data-region="${reg.id}" 
        class="region-pill flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
          isSelected 
            ? 'bg-rose-900 text-white border-rose-900 shadow-sm' 
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
        }"
      >
        <span class="w-2 h-2 rounded-full" style="background-color: ${reg.accentColor}"></span>
        <span>${reg.shortName}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${
          isSelected ? 'bg-rose-800 text-amber-300' : 'bg-slate-100 text-slate-600'
        }">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.region-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const regionId = pill.getAttribute('data-region');
      setRegionFilter(regionId);
    });
  });

  const indicator = document.getElementById('region-current-indicator');
  if (indicator) {
    if (state.selectedRegion === 'all') {
      indicator.textContent = state.customTexts.region_indicator_all || 'Menampilkan: 7 Wilayah Solo Raya';
    } else {
      const reg = getRegionById(state.selectedRegion);
      indicator.textContent = `Menampilkan: ${reg ? reg.name : state.selectedRegion}`;
    }
  }
}

// Render Categories Bar
function renderCategoryPills() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  let html = '';
  CATEGORIES.forEach((cat) => {
    const isSelected = state.selectedCategory === cat.id;

    html += `
      <button 
        data-category="${cat.id}"
        class="category-pill flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
          isSelected 
            ? 'bg-slate-800 text-white border-slate-800' 
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
        }"
      >
        <i data-lucide="${cat.icon}" class="w-3.5 h-3.5"></i>
        <span>${cat.name}</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.category-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const catId = pill.getAttribute('data-category');
      state.selectedCategory = catId;
      renderCategoryPills();
      renderListings();
      if (window.lucide) window.lucide.createIcons();
    });
  });
}

// Filter and Render Product Listings (Supports Grid & List View Layouts)
function renderListings() {
  const grid = document.getElementById('listings-grid');
  const emptyState = document.getElementById('empty-state');
  const countBadge = document.getElementById('listings-count');
  if (!grid) return;

  const isListView = state.siteSettings && state.siteSettings.layoutStyle === 'list';
  const chatWaText = state.customTexts.btn_chat_wa_card || "Chat WA";
  const detailText = state.customTexts.btn_detail_card || "Detail";

  // Apply layout CSS to container
  if (isListView) {
    grid.className = "flex flex-col gap-3 transition-all";
  } else {
    grid.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 transition-all";
  }

  // Get only active, non-hidden public listings
  let listings = getPublicListings();

  if (state.selectedRegion !== 'all') {
    listings = listings.filter((l) => l.regionId === state.selectedRegion);
  }
  if (state.selectedDistrict !== 'all') {
    listings = listings.filter((l) => l.district && l.district.toLowerCase() === state.selectedDistrict.toLowerCase());
  }
  if (state.selectedCategory !== 'all') {
    listings = listings.filter((l) => l.category === state.selectedCategory);
  }
  if (state.selectedCondition !== 'all') {
    listings = listings.filter((l) => l.condition === state.selectedCondition);
  }
  if (state.minPrice !== null && !isNaN(state.minPrice)) {
    listings = listings.filter((l) => l.price >= state.minPrice);
  }
  if (state.maxPrice !== null && !isNaN(state.maxPrice)) {
    listings = listings.filter((l) => l.price <= state.maxPrice);
  }

  if (state.searchQuery && state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toLowerCase().trim();
    listings = listings.filter((l) => {
      const titleMatch = l.title.toLowerCase().includes(q);
      const descMatch = l.description && l.description.toLowerCase().includes(q);
      const distMatch = l.district && l.district.toLowerCase().includes(q);
      const sellerMatch = l.seller && l.seller.displayName && l.seller.displayName.toLowerCase().includes(q);
      return titleMatch || descMatch || distMatch || sellerMatch;
    });
  }

  listings.sort((a, b) => {
    if (state.sortBy === 'price_low') return a.price - b.price;
    if (state.sortBy === 'price_high') return b.price - a.price;
    if (state.sortBy === 'views') return (b.views || 0) - (a.views || 0);
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (countBadge) countBadge.textContent = listings.length;
  updateActiveFilterChips();

  if (listings.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  let cardsHtml = '';
  listings.forEach((item) => {
    const region = getRegionById(item.regionId);
    const regionName = region ? region.shortName : item.regionId;
    const isFav = isFavorite(item.id);
    const waUrl = generateWhatsAppUrl(item, state.currentUser?.displayName);
    const priceFormatted = formatRupiah(item.price);
    const timeAgoStr = timeAgo(item.createdAt);
    const sellerName = item.seller?.displayName || item.seller?.name || 'Penjual Solo';

    if (isListView) {
      // ---------------- LIST VIEW LAYOUT CARD ----------------
      cardsHtml += `
        <div 
          data-listing-id="${item.id}"
          class="product-card group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex flex-col sm:flex-row overflow-hidden relative cursor-pointer"
        >
          <!-- Image Section (Aspect 4:5) -->
          <div class="relative w-full sm:w-44 aspect-[4/5] bg-slate-100 overflow-hidden flex-shrink-0">
            <img 
              src="${item.images[0]}" 
              alt="${item.title}" 
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            >
            
            ${item.images && item.images.length > 1 ? `
              <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-950/75 text-white backdrop-blur-xs flex items-center gap-1 shadow">
                <i data-lucide="image" class="w-3 h-3 text-amber-300"></i>
                <span>${item.images.length} Foto</span>
              </span>
            ` : ''}

            ${item.isSold ? `
              <div class="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] flex items-center justify-center">
                <span class="bg-rose-600 text-white font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md shadow">TERJUAL</span>
              </div>
            ` : ''}

            <div class="absolute bottom-2 left-2">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs bg-white/95 text-slate-800 border-slate-200 backdrop-blur-xs flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3 h-3 text-rose-800"></i>
                <span>${regionName} • ${item.district || '-'}</span>
              </span>
            </div>

            <button 
              data-action="favorite"
              data-id="${item.id}"
              class="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-400 hover:text-rose-600 hover:scale-110 shadow-sm transition-all"
              title="Simpan ke favorit"
            >
              <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600' : ''}"></i>
            </button>
          </div>

          <!-- Content Section -->
          <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
            <div class="space-y-1.5">
              <div class="flex items-baseline justify-between gap-2">
                <span class="text-base sm:text-lg font-black text-rose-900">${priceFormatted}</span>
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                  ${item.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'}
                </span>
              </div>

              <h3 class="text-sm sm:text-base font-bold text-slate-800 group-hover:text-rose-900 transition-colors leading-snug">
                ${item.title}
              </h3>

              <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                ${item.description}
              </p>
            </div>

            <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-xs text-slate-500">
                <span class="font-bold text-slate-700 flex items-center gap-1">
                  <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span>${sellerName}</span>
                </span>
                <span>•</span>
                <span class="text-[11px] text-slate-400">${timeAgoStr}</span>
              </div>

              <div class="flex items-center gap-2">
                <a 
                  href="${waUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-action="whatsapp"
                  class="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs shadow-sm transition-colors"
                >
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                  <span>${chatWaText}</span>
                </a>
                <button 
                  data-action="view-detail"
                  data-id="${item.id}"
                  class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                  <span class="hidden sm:inline">${detailText}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
    } else {
      // ---------------- GRID VIEW LAYOUT CARD (Aspect 4:5) ----------------
      cardsHtml += `
        <div 
          data-listing-id="${item.id}"
          class="product-card group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex flex-col overflow-hidden relative cursor-pointer"
        >
          <div class="relative aspect-[4/5] bg-slate-100 overflow-hidden">
            <img 
              src="${item.images[0]}" 
              alt="${item.title}" 
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            >
            
            ${item.images && item.images.length > 1 ? `
              <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-950/75 text-white backdrop-blur-xs flex items-center gap-1 shadow">
                <i data-lucide="image" class="w-3 h-3 text-amber-300"></i>
                <span>${item.images.length} Foto</span>
              </span>
            ` : ''}

            ${item.isSold ? `
              <div class="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] flex items-center justify-center">
                <span class="bg-rose-600 text-white font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-md shadow">TERJUAL</span>
              </div>
            ` : ''}

            <div class="absolute bottom-2 left-2 flex items-center gap-1">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs bg-white/95 text-slate-800 border-slate-200 backdrop-blur-xs flex items-center gap-1">
                <i data-lucide="map-pin" class="w-3 h-3 text-rose-800"></i>
                <span>${regionName} • ${item.district || '-'}</span>
              </span>
            </div>

            <button 
              data-action="favorite"
              data-id="${item.id}"
              class="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-400 hover:text-rose-600 hover:scale-110 shadow-sm transition-all"
              title="Simpan ke favorit"
            >
              <i data-lucide="heart" class="w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600' : ''}"></i>
            </button>
          </div>

          <div class="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
            
            <div class="space-y-1">
              <div class="flex items-baseline justify-between gap-1 flex-wrap">
                <span class="text-sm sm:text-base font-extrabold text-rose-900">${priceFormatted}</span>
                <span class="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                  ${item.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'}
                </span>
              </div>

              <h3 class="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-rose-900 transition-colors line-clamp-2 leading-snug" title="${item.title}">
                ${item.title}
              </h3>
            </div>

            <div class="pt-2 border-t border-slate-100 space-y-2">
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                <div class="flex items-center gap-1.5 truncate pr-1" title="Penjual: ${sellerName}">
                  <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"></i>
                  <span class="font-medium text-slate-700 truncate">${sellerName}</span>
                </div>
                <span class="text-[10px] text-slate-400 flex-shrink-0">${timeAgoStr}</span>
              </div>

              <div class="flex items-center gap-1.5 pt-0.5">
                <a 
                  href="${waUrl}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-action="whatsapp"
                  class="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 font-bold py-1.5 px-2 rounded-xl text-xs transition-colors"
                  title="Chat Penjual via WhatsApp"
                >
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                  <span>${chatWaText}</span>
                </a>

                <button 
                  data-action="view-detail"
                  data-id="${item.id}"
                  class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                  title="Lihat Detail"
                >
                  <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                </button>
              </div>

            </div>

          </div>
        </div>
      `;
    }
  });

  grid.innerHTML = cardsHtml;

  grid.querySelectorAll('.product-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="favorite"]')) {
        const btn = e.target.closest('[data-action="favorite"]');
        const id = btn.getAttribute('data-id');
        const isNowFav = toggleFavorite(id);
        renderListings();
        showToast(isNowFav ? "Ditambahkan ke favorit" : "Dihapus dari favorit", "info");
        return;
      }
      if (e.target.closest('[data-action="whatsapp"]')) {
        return;
      }

      const listingId = card.getAttribute('data-listing-id');
      openProductDetail(listingId);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

function updateActiveFilterChips() {
  const container = document.getElementById('active-filter-chips');
  if (!container) return;

  const chips = [];

  if (state.selectedRegion !== 'all') {
    const reg = getRegionById(state.selectedRegion);
    chips.push({
      label: `Wilayah: ${reg ? reg.shortName : state.selectedRegion}`,
      action: () => setRegionFilter('all')
    });
  }

  if (state.selectedDistrict !== 'all') {
    chips.push({
      label: `Kec. ${state.selectedDistrict}`,
      action: () => {
        state.selectedDistrict = 'all';
        renderListings();
      }
    });
  }

  if (state.selectedCategory !== 'all') {
    const cat = CATEGORIES.find((c) => c.id === state.selectedCategory);
    chips.push({
      label: `Kategori: ${cat ? cat.name : state.selectedCategory}`,
      action: () => {
        state.selectedCategory = 'all';
        renderCategoryPills();
        renderListings();
      }
    });
  }

  if (state.selectedCondition !== 'all') {
    const cond = CONDITIONS.find((c) => c.id === state.selectedCondition);
    chips.push({
      label: `Kondisi: ${cond ? cond.label.split('(')[0] : state.selectedCondition}`,
      action: () => {
        state.selectedCondition = 'all';
        renderListings();
      }
    });
  }

  if (state.searchQuery) {
    chips.push({
      label: `Cari: "${state.searchQuery}"`,
      action: () => {
        state.searchQuery = '';
        const dInput = document.getElementById('desktop-search-input');
        const mInput = document.getElementById('mobile-search-input');
        if (dInput) dInput.value = '';
        if (mInput) mInput.value = '';
        renderListings();
      }
    });
  }

  if (state.minPrice || state.maxPrice) {
    chips.push({
      label: `Harga: ${state.minPrice ? formatRupiah(state.minPrice) : '0'} - ${state.maxPrice ? formatRupiah(state.maxPrice) : 'Max'}`,
      action: () => {
        state.minPrice = null;
        state.maxPrice = null;
        renderListings();
      }
    });
  }

  if (chips.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  chips.forEach((chip, index) => {
    html += `
      <span class="inline-flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-200 px-2 py-0.5 rounded-full text-[11px] font-bold">
        <span>${chip.label}</span>
        <button data-chip-idx="${index}" class="text-rose-700 hover:text-rose-950">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </span>
    `;
  });

  html += `
    <button id="btn-clear-all-chips" class="text-rose-800 text-[11px] font-bold hover:underline ml-1">
      Hapus Semua
    </button>
  `;

  container.innerHTML = html;

  container.querySelectorAll('button[data-chip-idx]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-chip-idx'), 10);
      if (chips[idx]) chips[idx].action();
    });
  });

  document.getElementById('btn-clear-all-chips')?.addEventListener('click', () => {
    resetAllFilters();
  });
}
// Open Product Detail Modal
function openProductDetail(listingId) {
  const listing = getListingById(listingId);
  if (!listing) return;

  incrementListingViews(listingId);
  state.currentDetailListing = listing;

  const region = getRegionById(listing.regionId);
  const regionName = region ? region.name : listing.regionId;
  const isFav = isFavorite(listing.id);

  // Set Details & Multi-Photo Gallery (Aspect 4:5)
  const mainDetailImg = document.getElementById('detail-image');
  const thumbContainer = document.getElementById('detail-thumbnails-container');
  mainDetailImg.src = listing.images[0];

  if (thumbContainer) {
    if (listing.images && listing.images.length > 1) {
      thumbContainer.classList.remove('hidden');
      let thumbsHtml = '';
      listing.images.forEach((imgUrl, idx) => {
        thumbsHtml += `
          <button 
            type="button" 
            data-img-index="${idx}"
            class="detail-thumb-btn w-14 sm:w-16 aspect-[4/5] rounded-xl overflow-hidden border-2 transition-all ${idx === 0 ? 'border-rose-800 ring-2 ring-rose-300 scale-105' : 'border-slate-300 opacity-70 hover:opacity-100'}"
          >
            <img src="${imgUrl}" alt="${listing.title} Foto ${idx+1}" class="w-full h-full object-cover">
          </button>
        `;
      });
      thumbContainer.innerHTML = thumbsHtml;

      thumbContainer.querySelectorAll('.detail-thumb-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-img-index'), 10);
          mainDetailImg.src = listing.images[idx];
          thumbContainer.querySelectorAll('.detail-thumb-btn').forEach((b, i) => {
            if (i === idx) {
              b.className = "detail-thumb-btn w-14 sm:w-16 aspect-[4/5] rounded-xl overflow-hidden border-2 border-rose-800 ring-2 ring-rose-300 scale-105 transition-all";
            } else {
              b.className = "detail-thumb-btn w-14 sm:w-16 aspect-[4/5] rounded-xl overflow-hidden border-2 border-slate-300 opacity-70 hover:opacity-100 transition-all";
            }
          });
        });
      });
    } else {
      thumbContainer.classList.add('hidden');
      thumbContainer.innerHTML = '';
    }
  }

  document.getElementById('detail-title').textContent = listing.title;
  document.getElementById('detail-price').textContent = formatRupiah(listing.price);
  
  const cat = CATEGORIES.find((c) => c.id === listing.category);
  document.getElementById('detail-category-badge').textContent = cat ? cat.name : 'Barkas';
  
  document.getElementById('detail-region-badge').textContent = region ? region.shortName : 'Solo Raya';
  
  const cond = CONDITIONS.find((c) => c.id === listing.condition);
  document.getElementById('detail-condition-badge').textContent = cond ? cond.label.split('(')[0] : 'Bekas';
  
  const negoBadge = document.getElementById('detail-nego-badge');
  const negoObj = NEGO_TYPES.find((n) => n.id === listing.negoType);
  negoBadge.textContent = negoObj ? negoObj.label : 'Nego Alus';

  document.getElementById('detail-time-ago').querySelector('span').textContent = timeAgo(listing.createdAt);
  
  const viewsEl = document.getElementById('detail-views-count');
  if (viewsEl) viewsEl.textContent = `${(listing.views || 0) + 1} kali dilihat`;

  // Location and COD
  const locText = listing.district ? `${regionName}, Kec. ${listing.district}` : regionName;
  document.getElementById('detail-location-text').textContent = locText;
  document.getElementById('detail-cod-text').textContent = listing.codPoint || `Area ${listing.district || regionName}`;
  
  // Description
  document.getElementById('detail-description').textContent = listing.description;

  // SELLER CARD (NAMA AKUN PUBLIK PENJUAL)
  const sellerAvatar = document.getElementById('detail-seller-avatar');
  const sellerName = document.getElementById('detail-seller-name');
  const sellerRegion = document.getElementById('detail-seller-region').querySelector('span');
  
  sellerAvatar.src = listing.seller?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(listing.seller?.displayName || 'solo')}`;
  sellerName.textContent = listing.seller?.displayName || listing.seller?.googleName || 'Penjual Terverifikasi';
  sellerRegion.textContent = region ? region.name : 'Solo Raya';

  // Sold overlay check
  const soldOverlay = document.getElementById('detail-sold-overlay');
  if (listing.isSold) {
    soldOverlay.classList.remove('hidden');
  } else {
    soldOverlay.classList.add('hidden');
  }

  // Favorite button
  const favBtn = document.getElementById('btn-detail-favorite');
  favBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-rose-600 text-rose-600' : 'text-slate-400'}"></i>`;
  favBtn.onclick = () => {
    const isNow = toggleFavorite(listing.id);
    favBtn.innerHTML = `<i data-lucide="heart" class="w-5 h-5 ${isNow ? 'fill-rose-600 text-rose-600' : 'text-slate-400'}"></i>`;
    renderListings();
    showToast(isNow ? "Disimpan ke favorit" : "Dihapus dari favorit", "info");
    if (window.lucide) window.lucide.createIcons();
  };

  // DIRECT WHATSAPP BUTTON (CTA) & MESSAGE PREVIEW
  const waBtn = document.getElementById('btn-detail-whatsapp');
  const waUrl = generateWhatsAppUrl(listing, state.currentUser?.displayName);
  waBtn.href = waUrl;

  const waPreviewText = document.getElementById('detail-wa-preview-text');
  if (waPreviewText) {
    const sellerDisp = listing.seller?.displayName || 'Penjual';
    const locSnippet = listing.district ? `${regionName}, ${listing.district}` : regionName;
    const buyerName = state.currentUser?.displayName || 'Calon Pembeli';
    const msg = `Halo ${sellerDisp}, permisi... 👋\n\nSaya tertarik dengan iklan barang bekas Anda di Pusat Barkas Solo Raya:\n📦 Barang: ${listing.title}\n💰 Harga: ${formatRupiah(listing.price)} (${listing.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'})\n📍 Lokasi: ${locSnippet}\n${listing.codPoint ? `🤝 Titik COD: ${listing.codPoint}\n` : ''}\nApakah barang tersebut masih tersedia dan bisa COD?\n\nTerima kasih,\n— ${buyerName}`;
    waPreviewText.textContent = msg;

    const copyBtn = document.getElementById('btn-copy-wa-message');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(msg).then(() => {
          showToast("Format pesan WhatsApp berhasil disalin ke clipboard!", "success");
        }).catch(() => {
          showToast("Teks disalin", "info");
        });
      };
    }
  }

  // Share Button
  const shareBtn = document.getElementById('btn-detail-share');
  shareBtn.onclick = () => {
    const shareUrl = generateShareWhatsAppUrl(listing);
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text: `Cek barang bekas ini di Solo Raya: ${listing.title} - ${formatRupiah(listing.price)}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      window.open(shareUrl, '_blank');
    }
    showToast("Tautan siap dibagikan ke WhatsApp", "success");
  };

  openModal('modal-product-detail');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// GOOGLE AUTH & ONBOARDING / DISPLAY NAME MANAGEMENT
// -------------------------------------------------------------
function openGoogleAuthModal(step = 'login') {
  const loginStep = document.getElementById('auth-step-login');
  const onboardingStep = document.getElementById('auth-step-onboarding');

  if (step === 'login') {
    loginStep?.classList.remove('hidden');
    onboardingStep?.classList.add('hidden');
    renderGooglePresets();
  } else {
    loginStep?.classList.add('hidden');
    onboardingStep?.classList.remove('hidden');
    populateOnboardingForm();
  }

  openModal('modal-google-auth');
  if (window.lucide) window.lucide.createIcons();
}

function renderGooglePresets() {
  const container = document.getElementById('google-preset-list');
  if (!container) return;

  let html = '';
  PRESET_GOOGLE_ACCOUNTS.forEach((acc) => {
    html += `
      <button 
        type="button"
        data-account-id="${acc.id}"
        class="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 text-left transition-all group"
      >
        <img src="${acc.avatar}" alt="${acc.name}" class="w-9 h-9 rounded-full object-cover border border-slate-200">
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold text-slate-800 group-hover:text-rose-900">${acc.name}</div>
          <div class="text-[11px] text-slate-400 truncate">${acc.email}</div>
          <div class="text-[10px] text-emerald-600 font-semibold mt-0.5">Nama Akun Publik: ${acc.suggestedDisplayName}</div>
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-rose-800"></i>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('button[data-account-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-account-id');
      const acc = PRESET_GOOGLE_ACCOUNTS.find((a) => a.id === id);
      if (acc) {
        handleGoogleAccountSelection(acc);
      }
    });
  });
}

function handleGoogleAccountSelection(googleAccount) {
  const user = loginWithGoogle(googleAccount);
  
  if (!user.isProfileConfigured) {
    showToast(`Selamat datang ${user.googleName}! Silakan atur Nama Akun publik Anda.`, "info");
    openGoogleAuthModal('onboarding');
  } else {
    closeModal('modal-google-auth');
    showToast(`Berhasil masuk sebagai ${user.displayName || user.googleName}`, "success");
  }
}

function openDisplayNameSetupModal() {
  openGoogleAuthModal('onboarding');
}

function populateOnboardingForm() {
  const user = state.currentUser;
  const nameInput = document.getElementById('setup-display-name');
  const phoneInput = document.getElementById('setup-phone');
  const regionSelect = document.getElementById('setup-region');

  if (user) {
    if (nameInput) nameInput.value = user.displayName || user.googleName || '';
    if (phoneInput) phoneInput.value = user.phone || '081223456789';
  }

  if (regionSelect) {
    let regionOptions = '';
    SOLO_RAYA_REGIONS.forEach((r) => {
      const isSelected = user && user.region === r.id;
      regionOptions += `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.name}</option>`;
    });
    regionSelect.innerHTML = regionOptions;
  }
}

// -------------------------------------------------------------
// CREATE LISTING (PASANG IKLAN BARKAS)
// -------------------------------------------------------------
function openCreateListingModal() {
  if (!isUserLoggedIn()) {
    showToast("Silakan login dengan Google terlebih dahulu untuk memasang iklan.", "warning");
    openGoogleAuthModal('login');
    return;
  }

  const user = state.currentUser;
  if (!user.displayName || !user.phone) {
    showToast("Harap lengkapi Nama Akun publik & WhatsApp Anda terlebih dahulu.", "info");
    openDisplayNameSetupModal();
    return;
  }

  updateCreateListingSellerInfo();
  resetCreateListingForm();
  openModal('modal-create-listing');
  if (window.lucide) window.lucide.createIcons();
}

function updateCreateListingSellerInfo() {
  const user = state.currentUser;
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');

  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar;
    nameEl.textContent = user.displayName || user.googleName;
    phoneEl.textContent = `WA: ${formatDisplayPhone(user.phone || 'Belum diatur')}`;
  }
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

function resetCreateListingForm() {
  const form = document.getElementById('form-create-listing');
  if (form) form.reset();
  state.uploadedImages = [];
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

  const count = state.uploadedImages.length;
  if (counterBadge) {
    counterBadge.textContent = `${count}/3 Foto (Rasio 4:5)`;
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
  state.uploadedImages.forEach((imgUrl, idx) => {
    html += `
      <div class="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 border-2 border-rose-200 shadow-sm group">
        <img src="${imgUrl}" alt="Foto ${idx+1}" class="w-full h-full object-cover">
        <span class="absolute top-1.5 left-1.5 bg-slate-950/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-xs">
          ${idx === 0 ? 'Utama' : `Foto ${idx+1}`}
        </span>
        <button 
          type="button" 
          data-remove-idx="${idx}" 
          class="absolute top-1.5 right-1.5 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs shadow-md transition-transform hover:scale-110"
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
      state.uploadedImages.splice(idx, 1);
      renderFormImagePreviews();
      if (window.lucide) window.lucide.createIcons();
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// MY LISTINGS (KELOLA IKLAN SAYA)
// -------------------------------------------------------------
function openMyListingsModal() {
  if (!isUserLoggedIn()) {
    showToast("Silakan login dengan Google terlebih dahulu.", "warning");
    openGoogleAuthModal('login');
    return;
  }

  const user = state.currentUser;
  const infoEl = document.getElementById('my-listings-seller-info');
  if (infoEl) infoEl.textContent = `Akun: ${user.displayName || user.googleName} (${user.email})`;
  
  renderMyListings();
  openModal('modal-my-listings');
  if (window.lucide) window.lucide.createIcons();
}

function renderMyListings() {
  const container = document.getElementById('my-listings-container');
  const emptyView = document.getElementById('my-listings-empty');
  const user = state.currentUser;
  if (!container || !user) return;

  const myListings = getMyListings(user.id);

  if (myListings.length === 0) {
    container.innerHTML = '';
    emptyView?.classList.remove('hidden');
    return;
  }

  emptyView?.classList.add('hidden');

  let html = '';
  myListings.forEach((item) => {
    const region = getRegionById(item.regionId);
    const regionName = region ? region.shortName : item.regionId;

    html += `
      <div class="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 transition-all">
        <img src="${item.images[0]}" alt="${item.title}" class="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-slate-200">
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${item.isSold ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
              ${item.isSold ? 'TERJUAL' : 'TERSEDIA'}
            </span>
            <span class="text-[10px] text-slate-500">${regionName} • ${item.district}</span>
          </div>
          <h4 class="text-xs font-bold text-slate-800 truncate mt-0.5">${item.title}</h4>
          <div class="text-xs font-extrabold text-rose-900">${formatRupiah(item.price)}</div>
        </div>

        <div class="flex flex-col gap-1.5 flex-shrink-0">
          <button 
            data-action="toggle-sold" 
            data-id="${item.id}"
            class="px-3 py-1.5 text-[11px] font-bold rounded-xl ${item.isSold ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'} shadow-xs"
          >
            ${item.isSold ? 'Aktifkan' : 'Tandai Terjual'}
          </button>
          
          <button 
            data-action="delete-listing" 
            data-id="${item.id}"
            class="px-3 py-1 text-[11px] font-bold rounded-xl text-rose-600 hover:bg-rose-100 transition-colors"
          >
            Hapus
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('[data-action="toggle-sold"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const updated = toggleSoldStatus(id);
      renderMyListings();
      renderListings();
      renderRegionPills();
      showToast(updated.isSold ? "Barang ditandai Terjual!" : "Barang kembali Tersedia!", "success");
    });
  });

  container.querySelectorAll('[data-action="delete-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Apakah Anda yakin ingin menghapus iklan barkas ini?")) {
        deleteListing(id);
        renderMyListings();
        renderListings();
        renderRegionPills();
        showToast("Iklan berhasil dihapus.", "info");
      }
    });
  });
}

// -------------------------------------------------------------
// FILTER MODAL MANAGEMENT
// -------------------------------------------------------------
function populateFilterModalOptions() {
  const regSelect = document.getElementById('filter-modal-region');
  const distSelect = document.getElementById('filter-modal-district');
  if (!regSelect || !distSelect) return;

  function updateFilterDistricts() {
    const regId = regSelect.value;
    if (regId === 'all') {
      distSelect.innerHTML = '<option value="all">Semua Kecamatan</option>';
      return;
    }
    const districts = getDistrictsByRegionId(regId);
    let distHtml = '<option value="all">Semua Kecamatan</option>';
    districts.forEach((d) => {
      distHtml += `<option value="${d}">${d}</option>`;
    });
    distSelect.innerHTML = distHtml;
  }

  regSelect.addEventListener('change', updateFilterDistricts);
}

function openFilterModal() {
  const regSelect = document.getElementById('filter-modal-region');
  const catSelect = document.getElementById('filter-modal-category');
  const condSelect = document.getElementById('filter-modal-condition');
  const minPriceInput = document.getElementById('filter-min-price');
  const maxPriceInput = document.getElementById('filter-max-price');

  if (regSelect) regSelect.value = state.selectedRegion;
  if (catSelect) catSelect.value = state.selectedCategory;
  if (condSelect) condSelect.value = state.selectedCondition;
  if (minPriceInput) minPriceInput.value = state.minPrice || '';
  if (maxPriceInput) maxPriceInput.value = state.maxPrice || '';

  const event = new Event('change');
  regSelect?.dispatchEvent(event);

  openModal('modal-filter');
}

function applyFilterModal() {
  const regSelect = document.getElementById('filter-modal-region');
  const distSelect = document.getElementById('filter-modal-district');
  const catSelect = document.getElementById('filter-modal-category');
  const condSelect = document.getElementById('filter-modal-condition');
  const minPriceInput = document.getElementById('filter-min-price');
  const maxPriceInput = document.getElementById('filter-max-price');

  state.selectedRegion = regSelect ? regSelect.value : 'all';
  state.selectedDistrict = distSelect ? distSelect.value : 'all';
  state.selectedCategory = catSelect ? catSelect.value : 'all';
  state.selectedCondition = condSelect ? condSelect.value : 'all';
  state.minPrice = minPriceInput && minPriceInput.value ? Number(minPriceInput.value) : null;
  state.maxPrice = maxPriceInput && maxPriceInput.value ? Number(maxPriceInput.value) : null;

  closeModal('modal-filter');
  renderRegionPills();
  renderCategoryPills();
  renderListings();
  showToast("Filter diterapkan", "info");
}

function setRegionFilter(regionId) {
  state.selectedRegion = regionId;
  state.selectedDistrict = 'all';
  renderRegionPills();
  renderListings();
}

function resetAllFilters() {
  state.selectedRegion = 'all';
  state.selectedDistrict = 'all';
  state.selectedCategory = 'all';
  state.selectedCondition = 'all';
  state.searchQuery = '';
  state.minPrice = null;
  state.maxPrice = null;

  const dInput = document.getElementById('desktop-search-input');
  const mInput = document.getElementById('mobile-search-input');
  if (dInput) dInput.value = '';
  if (mInput) mInput.value = '';

  renderRegionPills();
  renderCategoryPills();
  renderListings();
  showToast("Semua filter telah direset.", "info");
}

// -------------------------------------------------------------
// EVENT LISTENERS & MODAL CONTROLLERS
// -------------------------------------------------------------
function initEventListeners() {
  const desktopSearch = document.getElementById('desktop-search-input');
  const mobileSearch = document.getElementById('mobile-search-input');
  const dClear = document.getElementById('desktop-search-clear');
  const mClear = document.getElementById('mobile-search-clear');

  function handleSearch(val) {
    state.searchQuery = val;
    if (dClear) dClear.classList.toggle('hidden', !val);
    if (mClear) mClear.classList.toggle('hidden', !val);
    renderListings();
  }

  desktopSearch?.addEventListener('input', (e) => {
    if (mobileSearch) mobileSearch.value = e.target.value;
    handleSearch(e.target.value);
  });

  mobileSearch?.addEventListener('input', (e) => {
    if (desktopSearch) desktopSearch.value = e.target.value;
    handleSearch(e.target.value);
  });

  dClear?.addEventListener('click', () => {
    if (desktopSearch) desktopSearch.value = '';
    if (mobileSearch) mobileSearch.value = '';
    handleSearch('');
  });

  mClear?.addEventListener('click', () => {
    if (desktopSearch) desktopSearch.value = '';
    if (mobileSearch) mobileSearch.value = '';
    handleSearch('');
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderListings();
  });

  document.getElementById('btn-create-listing-nav')?.addEventListener('click', openCreateListingModal);
  document.getElementById('nav-btn-create')?.addEventListener('click', openCreateListingModal);
  document.getElementById('btn-create-first-listing')?.addEventListener('click', () => {
    closeModal('modal-my-listings');
    openCreateListingModal();
  });
  document.getElementById('btn-form-edit-profile')?.addEventListener('click', () => {
    closeModal('modal-create-listing');
    openDisplayNameSetupModal();
  });

  document.getElementById('nav-btn-home')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setRegionFilter('all');
  });

  document.getElementById('nav-btn-filter')?.addEventListener('click', openFilterModal);
  document.getElementById('btn-open-filter-modal')?.addEventListener('click', openFilterModal);
  document.getElementById('btn-apply-filter-modal')?.addEventListener('click', applyFilterModal);
  document.getElementById('btn-reset-filter-modal')?.addEventListener('click', () => {
    resetAllFilters();
    closeModal('modal-filter');
  });

  document.getElementById('nav-btn-my-listings')?.addEventListener('click', openMyListingsModal);
  document.getElementById('nav-btn-profile')?.addEventListener('click', () => {
    if (isUserLoggedIn()) {
      openMyListingsModal();
    } else {
      openGoogleAuthModal('login');
    }
  });

  document.getElementById('btn-reset-filters-empty')?.addEventListener('click', resetAllFilters);

  // Form input live helpers (Live Rupiah & Char counter)
  const priceInput = document.getElementById('form-input-price');
  const pricePreview = document.getElementById('price-rupiah-preview');
  priceInput?.addEventListener('input', (e) => {
    const val = Number(e.target.value) || 0;
    if (pricePreview) pricePreview.textContent = formatRupiah(val);
  });

  const titleInput = document.getElementById('form-input-title');
  const titleCharCount = document.getElementById('title-char-count');
  titleInput?.addEventListener('input', (e) => {
    if (titleCharCount) titleCharCount.textContent = `${e.target.value.length}/80 karakter`;
  });

  // Preset Photo Buttons (Append up to 3 photos in 4:5 aspect ratio)
  document.querySelectorAll('.btn-preset-photo').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.uploadedImages.length >= 3) {
        showToast("Maksimal 3 foto per barang. Hapus foto lama jika ingin mengganti.", "warning");
        return;
      }
      const presetKey = btn.getAttribute('data-preset');
      const photoUrl = PRESET_SAMPLE_PHOTOS[presetKey];
      if (photoUrl) {
        state.uploadedImages.push(photoUrl);
        renderFormImagePreviews();
        showToast(`Contoh foto (${btn.textContent.trim()}) ditambahkan (${state.uploadedImages.length}/3)`, "info");
      }
    });
  });

  // File Upload Handler (Supports Multi-file selection up to 3 photos in 4:5 ratio)
  const imageFileInput = document.getElementById('form-image-file');

  imageFileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const availableSlots = 3 - state.uploadedImages.length;
    if (availableSlots <= 0) {
      showToast("Maksimal 3 foto per barang. Hapus foto yang sudah ada jika ingin menambah baru.", "warning");
      imageFileInput.value = '';
      return;
    }

    const filesToRead = files.slice(0, availableSlots);
    let loadedCount = 0;

    filesToRead.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.uploadedImages.push(event.target.result);
        loadedCount++;
        if (loadedCount === filesToRead.length) {
          renderFormImagePreviews();
          imageFileInput.value = '';
          showToast(`${loadedCount} foto berhasil ditambahkan (Rasio 4:5)`, "success");
        }
      };
      reader.readAsDataURL(file);
    });
  });

  // Form Create Listing Submit
  document.getElementById('form-create-listing')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const listingPayload = {
      title: formData.get('title'),
      category: formData.get('category'),
      condition: formData.get('condition'),
      price: formData.get('price'),
      negoType: formData.get('negoType'),
      regionId: formData.get('regionId'),
      district: formData.get('district'),
      codPoint: formData.get('codPoint'),
      description: formData.get('description'),
      images: state.uploadedImages.length > 0 ? [...state.uploadedImages] : [
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80"
      ]
    };

    try {
      const saved = saveListing(listingPayload);
      closeModal('modal-create-listing');
      renderRegionPills();
      renderCategoryPills();
      renderListings();
      showToast("Iklan Anda berhasil dipasang dengan foto rasio 4:5 dan tayang di Solo Raya!", "success");
      setTimeout(() => openProductDetail(saved.id), 400);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Custom Google Login Form
  document.getElementById('form-custom-google-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('custom-google-name').value.trim();
    const email = document.getElementById('custom-google-email').value.trim();
    if (!name || !email) {
      showToast("Harap isi nama dan email Google.", "warning");
      return;
    }

    const customAcc = {
      id: `custom-g-${Date.now()}`,
      name: name,
      email: email,
      suggestedDisplayName: `${name} Barkas`,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      defaultPhone: '081234567890',
      defaultRegion: 'solo'
    };

    handleGoogleAccountSelection(customAcc);
  });

  // Form Display Name Setup Submit
  document.getElementById('form-display-name-setup')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const displayName = document.getElementById('setup-display-name').value.trim();
    const phone = document.getElementById('setup-phone').value.trim();
    const region = document.getElementById('setup-region').value;

    if (!displayName || !phone) {
      showToast("Harap lengkapi Nama Akun publik & Nomor WhatsApp.", "warning");
      return;
    }

    updateProfile({ displayName, phone, region });
    closeModal('modal-google-auth');
    showToast(`Nama akun "${displayName}" berhasil disimpan!`, "success");
  });

  // Close Modals Trigger
  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = el.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModals = document.querySelectorAll('.fixed:not(.hidden)');
      openModals.forEach((m) => {
        if (m.id.startsWith('modal-')) closeModal(m.id);
      });
    }
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  
  const anyOpen = document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]').length > 0;
  if (!anyOpen) {
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let iconName = 'info';
  let bgClass = 'bg-slate-900 text-white';

  if (type === 'success') {
    iconName = 'check-circle';
    bgClass = 'bg-emerald-700 text-white';
  } else if (type === 'warning') {
    iconName = 'alert-triangle';
    bgClass = 'bg-amber-600 text-white';
  } else if (type === 'error') {
    iconName = 'alert-circle';
    bgClass = 'bg-rose-700 text-white';
  }

  toast.className = `toast-item flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold ${bgClass} transition-all pointer-events-auto`;
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

function handleInitialUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const regionParam = params.get('region');
  const itemParam = params.get('item');

  if (regionParam && getRegionById(regionParam)) {
    setRegionFilter(regionParam);
  }

  if (itemParam) {
    setTimeout(() => openProductDetail(itemParam), 300);
  }
}
