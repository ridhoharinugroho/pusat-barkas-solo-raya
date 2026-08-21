/**
 * Pusat Barkas Solo Raya - Main Application Controller
 * Pasang & Cari Barang Bekas di 7 Wilayah Solo Raya
 */

import { SOLO_RAYA_REGIONS, getRegionById, getDistrictsByRegionId } from './data/regions.js';
import { CATEGORIES, CONDITIONS, NEGO_TYPES } from './data/categories.js';
import { formatRupiah, generateWhatsAppUrl, generateShareWhatsAppUrl, timeAgo, formatDisplayPhone } from './services/whatsapp.js';
import { 
  getCurrentUser, isUserLoggedIn, loginUser, registerUser, 
  requestPasswordReset, confirmPasswordReset, updateProfile, 
  logout, subscribeAuth, getRegisteredUsers, getUserById,
  syncUsersFromCloud, syncAllUsersToCloudOnStartup
} from './services/auth.js';
import { 
  initializeStorage, getPublicListings, getListingById, saveListing, 
  updateListing, updateListingStatus, toggleSoldStatus, deleteListing, incrementListingViews, getMyListings, 
  toggleFavorite, isFavorite, getSiteSettings, getCustomTexts,
  saveSiteSettings, saveCustomTexts, getListingsBySellerId, getSellerStats,
  getSellerReviews, addSellerReview, getSellerRatingStats,
  checkSellerVerification, isSellerVerified
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
function startApp() {
  initializeStorage();
  syncAllUsersToCloudOnStartup().catch(() => {});
  
  // Apply initial site appearance & custom texts from database
  applySiteSettings(state.siteSettings);
  applyCustomTexts(state.customTexts);

  // Auth state listener
  subscribeAuth((user) => {
    state.currentUser = user;
    renderAuthNav();
    updateCreateListingSellerInfo();
    const navProfileLabel = document.getElementById('nav-profile-label');
    if (navProfileLabel) {
      navProfileLabel.textContent = user ? "Profil" : "Masuk";
    }
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// -------------------------------------------------------------
// LIVE VISUAL IN-PLACE EDITOR CONTROLLER
// -------------------------------------------------------------
function initLiveVisualEditor() {
  let clickCount = 0;
  let clickTimer = null;
  let lastClickTime = 0;

  // 10-Clicks Hidden Trigger on Brand Logo
  window.handleSecretAdminClick = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    // Debounce very fast duplicate events (< 40ms)
    if (now - lastClickTime < 40) return;
    lastClickTime = now;

    clickCount++;
    clearTimeout(clickTimer);

    // Provide friendly progressive feedback as user gets closer to 10 clicks
    if (clickCount >= 7 && clickCount < 10) {
      const remaining = 10 - clickCount;
      showToast(`🔑 ${remaining} ketukan lagi untuk membuka Akses Admin...`, "info");
    }

    if (clickCount >= 10) {
      clickCount = 0;
      showToast("🔓 10x Ketukan Berhasil! Membuka Panel Admin...", "success");

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

    // Reset click counter if no subsequent click within 4.5 seconds
    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 4500);
  };

  const brandLogo = document.getElementById('brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', window.handleSecretAdminClick);
  }

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
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.zIndex = '10000';
    document.body.style.overflow = 'hidden';
    document.getElementById('modal-login-error')?.classList.add('hidden');
    const uInput = document.getElementById('modal-admin-username');
    const pInput = document.getElementById('modal-admin-password');
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    setTimeout(() => {
      uInput?.focus();
    }, 150);
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
    if (texts[key] !== undefined && texts[key] !== null && typeof texts[key] === 'string' && texts[key].trim() !== '') {
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

  // 4. Brand Logo Rendering (Custom Image URL vs Preset Lucide Icon)
  const logoContainer = document.getElementById('brand-logo-icon-container');
  if (logoContainer) {
    if (settings.logoImageUrl && settings.logoImageUrl.trim() !== '') {
      logoContainer.className = "w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-900 overflow-hidden shadow-xs group-hover:scale-105 transition-transform flex-shrink-0 pointer-events-none";
      logoContainer.innerHTML = `<img src="${settings.logoImageUrl}" alt="Logo" class="w-full h-full object-cover pointer-events-none">`;
    } else {
      const gradient = settings.logoGradient || 'from-rose-900 to-rose-700';
      const icon = settings.logoIcon || 'shopping-bag';
      logoContainer.className = `w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform flex-shrink-0 pointer-events-none`;
      logoContainer.innerHTML = `<i id="brand-logo-icon" data-lucide="${icon}" class="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 pointer-events-none"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // 5. Re-render listings grid to apply list/grid layout
  renderListings();
}

// Render Auth Header
function renderAuthNav() {
  const container = document.getElementById('auth-nav-container');
  const user = state.currentUser || getCurrentUser();
  if (!container) return;

  if (!user) {
    container.innerHTML = `
      <button type="button" id="btn-header-login" class="flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-rose-900 to-rose-800 hover:from-rose-800 hover:to-rose-700 text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black shadow-xs hover:shadow transition-all flex-shrink-0 whitespace-nowrap cursor-pointer">
        <i data-lucide="user" class="w-3.5 h-3.5 text-amber-300 pointer-events-none"></i>
        <span class="pointer-events-none">Masuk</span><span class="hidden sm:inline pointer-events-none"> / Daftar</span>
      </button>
    `;
    document.getElementById('btn-header-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      openUserAuthModal('login');
    });
  } else {
    container.innerHTML = `
      <div class="relative flex-shrink-0">
        <button type="button" id="btn-header-user-menu" class="flex items-center gap-1 sm:gap-2 p-1 pr-1.5 sm:pr-2.5 bg-slate-100 hover:bg-slate-200 rounded-full border border-slate-200 transition-colors cursor-pointer">
          <img src="${user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}" alt="${user.displayName || user.name}" class="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-300">
          <span class="text-xs font-bold text-slate-800 max-w-[70px] sm:max-w-[120px] truncate hidden sm:inline">${user.displayName || user.name}</span>
          <i data-lucide="chevron-down" class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-500"></i>
        </button>

        <div id="header-user-dropdown-menu" class="hidden absolute right-0 top-full pt-1.5 w-56 sm:w-60 z-50">
          <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 text-xs text-slate-700">
            <div class="px-3.5 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <div class="font-black text-slate-900 truncate">${user.storeName || user.displayName || user.name}</div>
              <div class="text-[11px] text-slate-500 truncate">${user.email || ''}</div>
              <div class="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                <i data-lucide="phone" class="w-3 h-3"></i>
                <span>WA: ${user.phone ? formatDisplayPhone(user.phone) : 'Belum diatur'}</span>
              </div>
            </div>

            <div class="py-1">
              <a href="toko-saya.html" id="menu-btn-my-listings" class="w-full text-left px-3.5 py-2.5 hover:bg-rose-50 flex items-center gap-2.5 font-bold text-rose-900 cursor-pointer">
                <div class="p-1 bg-rose-100 rounded-lg text-rose-900">
                  <i data-lucide="store" class="w-4 h-4"></i>
                </div>
                <span>TOKO SAYA (Etalase & Jualan)</span>
              </a>

              <button type="button" id="menu-btn-user-profile" class="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 font-bold text-slate-800 cursor-pointer">
                <div class="p-1 bg-slate-100 rounded-lg text-slate-700">
                  <i data-lucide="user-cog" class="w-4 h-4"></i>
                </div>
                <span>Pengaturan Akun / Profil</span>
              </button>
            </div>

            <div class="border-t border-slate-100 my-1"></div>

            <button type="button" id="menu-btn-logout" class="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-bold cursor-pointer">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              <span>Keluar Akun</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const userMenuBtn = document.getElementById('btn-header-user-menu');
    const userMenuDropdown = document.getElementById('header-user-dropdown-menu');
    
    if (userMenuBtn && userMenuDropdown) {
      userMenuBtn.onclick = (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('hidden');
      };
      
      document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userMenuDropdown.contains(e.target)) {
          userMenuDropdown.classList.add('hidden');
        }
      });
    }

    document.getElementById('menu-btn-my-listings')?.addEventListener('click', () => {
      userMenuDropdown?.classList.add('hidden');
      window.location.href = 'toko-saya.html';
    });
    
    document.getElementById('menu-btn-user-profile')?.addEventListener('click', () => {
      userMenuDropdown?.classList.add('hidden');
      openUserProfileModal();
    });
    
    document.getElementById('menu-btn-logout')?.addEventListener('click', () => {
      userMenuDropdown?.classList.add('hidden');
      closeModal('modal-user-profile');
      closeModal('modal-my-listings');
      logout();
      state.currentUser = null;
      renderAuthNav();
      renderListings();
      updateStickyHeaderVisibility(true);
      showToast("Anda telah keluar dari akun.", "info");
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

              ${item.codPoint ? `
                <div class="text-[10px] text-amber-900 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 truncate flex items-center gap-1">
                  <i data-lucide="map-pin" class="w-3 h-3 text-rose-800 flex-shrink-0"></i>
                  <span class="truncate">${item.codPoint}</span>
                </div>
              ` : ''}
            </div>

            <div class="pt-2 border-t border-slate-100 space-y-2">
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                ${(() => {
                  const isVer = isSellerVerified(item.seller?.id || item.seller);
                  return `
                    <div class="flex items-center gap-1.5 truncate pr-1" title="${isVer ? 'Penjual Terverifikasi: ' : 'Penjual: '}${sellerName}">
                      <i data-lucide="${isVer ? 'shield-check' : 'user'}" class="w-3.5 h-3.5 ${isVer ? 'text-emerald-600' : 'text-slate-400'} flex-shrink-0"></i>
                      <span class="${isVer ? 'font-bold text-slate-800' : 'font-medium text-slate-700'} truncate">${sellerName}</span>
                    </div>
                  `;
                })()}
                <span class="text-[10px] text-slate-400 flex-shrink-0">${timeAgoStr}</span>
              </div>

              <div class="flex items-center gap-1.5 pt-0.5">
                ${(item.isSold || item.status === 'sold') ? `
                  <button 
                    disabled 
                    class="flex-1 flex items-center justify-center gap-1.5 bg-slate-200 text-slate-500 font-bold py-1.5 px-2 rounded-xl text-xs cursor-not-allowed opacity-80"
                  >
                    <span>Terjual</span>
                  </button>
                ` : `
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
                `}

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
        if (!isUserLoggedIn()) {
          e.preventDefault();
          e.stopPropagation();
          openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk menghubungi penjual via WhatsApp.');
          return;
        }
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

  // Status Badge
  const statusBadge = document.getElementById('detail-status-badge');
  const itemStatus = listing.status || (listing.isSold ? 'sold' : 'available');
  if (statusBadge) {
    if (itemStatus === 'sold' || listing.isSold) {
      statusBadge.textContent = 'TERJUAL';
      statusBadge.className = 'text-xs font-black px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 shadow-xs uppercase tracking-wide';
    } else if (itemStatus === 'booked') {
      statusBadge.textContent = 'BOOKED';
      statusBadge.className = 'text-xs font-black px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shadow-xs uppercase tracking-wide';
    } else {
      statusBadge.textContent = 'TERSEDIA';
      statusBadge.className = 'text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs uppercase tracking-wide';
    }
  }

  // Location and COD
  const locText = listing.district ? `${regionName}, Kec. ${listing.district}` : regionName;
  document.getElementById('detail-location-text').textContent = locText;
  document.getElementById('detail-cod-text').textContent = listing.codPoint || `Area ${listing.district || regionName}`;
  
  // Description
  document.getElementById('detail-description').textContent = listing.description;

  // SELLER CARD (NAMA AKUN PUBLIK PENJUAL & RATING)
  const sellerId = listing.seller?.id;
  const sellerUser = getUserById(sellerId);
  const sellerAvatar = document.getElementById('detail-seller-avatar');
  const sellerName = document.getElementById('detail-seller-name');
  const sellerRegion = document.getElementById('detail-seller-region').querySelector('span');
  const sellerRatingText = document.getElementById('detail-seller-rating-text');
  const sellerJoinedText = document.getElementById('detail-seller-joined');
  const sellerBadgeText = document.getElementById('detail-seller-badge-text');

  const ratingStats = getSellerRatingStats(sellerId);
  if (sellerRatingText) {
    sellerRatingText.textContent = `${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalReviews} Ulasan)`;
  }

  const isSellerVer = isSellerVerified(sellerId || listing.seller);
  if (sellerBadgeText) {
    sellerBadgeText.textContent = isSellerVer 
      ? `Toko Lokal ${region ? region.shortName : 'Solo Raya'} Terverifikasi`
      : `Toko Member ${region ? region.shortName : 'Solo Raya'}`;
    const badgeParent = sellerBadgeText.parentElement;
    if (badgeParent) {
      if (isSellerVer) {
        badgeParent.className = "inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      } else {
        badgeParent.className = "inline-flex items-center gap-1 bg-slate-700 text-slate-300 border border-slate-600 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      }
    }
  }

  if (sellerJoinedText) {
    const rawDate = sellerUser?.createdAt || listing.seller?.createdAt || listing.createdAt;
    const d = new Date(rawDate);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Agt 2026';
    sellerJoinedText.textContent = `Bergabung: ${dateStr}`;
  }
  
  sellerAvatar.src = listing.seller?.avatar || sellerUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(listing.seller?.displayName || 'solo')}`;
  sellerName.textContent = sellerUser?.storeName || listing.seller?.displayName || listing.seller?.googleName || 'Penjual Terverifikasi';
  sellerRegion.textContent = region ? region.name : 'Solo Raya';

  // Open Seller Profile Button
  const viewSellerBtn = document.getElementById('btn-view-seller-profile');
  if (viewSellerBtn) {
    viewSellerBtn.onclick = () => {
      closeModal('modal-product-detail');
      openSellerProfileModal(sellerId || listing.seller);
    };
  }

  // Sold overlay check
  const soldOverlay = document.getElementById('detail-sold-overlay');
  if (listing.isSold || itemStatus === 'sold') {
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
  const isItemSold = listing.isSold || itemStatus === 'sold';

  if (isItemSold) {
    waBtn.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none', 'bg-slate-400');
    waBtn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700', 'whatsapp-pulse');
    waBtn.querySelector('span').textContent = 'Barang Ini Sudah Terjual';
  } else {
    waBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none', 'bg-slate-400');
    waBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-700', 'whatsapp-pulse');
    waBtn.querySelector('span').textContent = 'Hubungi Penjual via WhatsApp';
    const waUrl = generateWhatsAppUrl(listing, state.currentUser?.displayName);
    waBtn.href = waUrl;
    waBtn.onclick = (e) => {
      if (!isUserLoggedIn()) {
        e.preventDefault();
        closeModal('modal-product-detail');
        openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk menghubungi penjual via WhatsApp.');
      }
    };
  }

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
    openShareModal(listing);
  };

  openModal('modal-product-detail');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// SHARE PRODUCT MODAL (WA, FB, IG, TELEGRAM, GRUP FB)
// -------------------------------------------------------------
function openShareModal(listing) {
  if (!listing) return;
  const regName = getRegionById(listing.regionId)?.name || 'Solo Raya';
  const locSnippet = listing.district ? `${regName}, ${listing.district}` : regName;
  const shareUrl = window.location.origin + window.location.pathname + `?item=${listing.id}`;
  const shareText = `Cek iklan barang bekas di Solo Raya:\n📦 *${listing.title}*\n💰 Harga: ${formatRupiah(listing.price)} (${listing.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'})\n📍 Lokasi: ${locSnippet}\n\n👉 Klik link untuk melihat iklan lengkap di Pusat Barkas Solo Raya:\n${shareUrl}`;

  const itemImg = document.getElementById('share-modal-item-img');
  const itemTitle = document.getElementById('share-modal-item-title');
  const itemPrice = document.getElementById('share-modal-item-price');
  const itemLoc = document.getElementById('share-modal-item-loc');
  const linkInput = document.getElementById('share-modal-link-input');

  if (itemImg) itemImg.src = listing.images && listing.images[0] ? listing.images[0] : '';
  if (itemTitle) itemTitle.textContent = listing.title;
  if (itemPrice) itemPrice.textContent = formatRupiah(listing.price);
  if (itemLoc) itemLoc.innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 text-rose-700"></i><span>${locSnippet}</span>`;
  if (linkInput) linkInput.value = shareUrl;

  // 1. WhatsApp
  const btnWa = document.getElementById('btn-share-whatsapp');
  if (btnWa) btnWa.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

  // 2. Facebook
  const btnFb = document.getElementById('btn-share-facebook');
  if (btnFb) btnFb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;

  // 3. Instagram (Copy Caption & Open Instagram)
  const btnIg = document.getElementById('btn-share-instagram');
  if (btnIg) {
    btnIg.onclick = (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(shareText).then(() => {
        showToast("Teks & tautan iklan berhasil disalin! Silakan tempel di Story / Feed / DM Instagram Anda.", "success");
      }).catch(() => {
        showToast("Teks iklan disalin ke clipboard", "info");
      });
      setTimeout(() => {
        window.open("https://www.instagram.com/", "_blank");
      }, 350);
    };
  }

  // 4. Telegram
  const btnTg = document.getElementById('btn-share-telegram');
  if (btnTg) btnTg.href = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  // 5. Grup WA (WhatsApp Group Broadcast / Share)
  const btnWaGroup = document.getElementById('btn-share-wagroup');
  if (btnWaGroup) {
    const groupShareText = `*INFO BARKAS SOLO RAYA* 📢\n\nDijual: *${listing.title}*\n💰 Harga: ${formatRupiah(listing.price)} (${listing.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'})\n📍 Lokasi: ${locSnippet}\n\n👉 Klik link untuk lihat foto lengkap & kontak penjual:\n${shareUrl}`;
    btnWaGroup.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(groupShareText)}`;
    btnWaGroup.onclick = () => {
      showToast("Membuka WhatsApp untuk dibagikan ke Grup WA...", "success");
    };
  }

  openModal('modal-share-product');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// USER AUTH & PASSWORD RESET CONTROLLERS
// -------------------------------------------------------------
function openUserAuthModal(tab = 'login', noticeMsg = null) {
  const noticeBox = document.getElementById('auth-notice-box');
  const noticeText = document.getElementById('auth-notice-text');

  if (noticeMsg && noticeBox && noticeText) {
    noticeText.textContent = noticeMsg;
    noticeBox.classList.remove('hidden');
  } else if (noticeBox) {
    noticeBox.classList.add('hidden');
  }

  switchAuthTab(tab);
  populateRegisterDistricts();
  openModal('modal-user-auth');
  if (window.lucide) window.lucide.createIcons();
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const panelLogin = document.getElementById('panel-auth-login');
  const panelRegister = document.getElementById('panel-auth-register');
  const panelForgot = document.getElementById('panel-auth-forgot');
  const tabsContainer = document.getElementById('auth-tabs-container');
  const modalTitle = document.getElementById('auth-modal-title');
  const modalSubtitle = document.getElementById('auth-modal-subtitle');

  if (tab === 'register') {
    tabsContainer?.classList.remove('hidden');
    panelLogin?.classList.add('hidden');
    panelRegister?.classList.remove('hidden');
    panelForgot?.classList.add('hidden');

    tabRegister?.classList.add('bg-white', 'text-rose-900', 'font-black', 'shadow-xs');
    tabRegister?.classList.remove('text-slate-500', 'font-bold');
    tabLogin?.classList.remove('bg-white', 'text-rose-900', 'font-black', 'shadow-xs');
    tabLogin?.classList.add('text-slate-500', 'font-bold');

    if (modalTitle) modalTitle.textContent = "Daftar Akun Penjual";
    if (modalSubtitle) modalSubtitle.textContent = "Mulai pasang iklan gratis se-Solo Raya";
  } else if (tab === 'forgot') {
    tabsContainer?.classList.add('hidden');
    panelLogin?.classList.add('hidden');
    panelRegister?.classList.add('hidden');
    panelForgot?.classList.remove('hidden');

    if (modalTitle) modalTitle.textContent = "Lupa Password Akun";
    if (modalSubtitle) modalSubtitle.textContent = "Atur ulang password akun Anda";
  } else {
    // login
    tabsContainer?.classList.remove('hidden');
    panelLogin?.classList.remove('hidden');
    panelRegister?.classList.add('hidden');
    panelForgot?.classList.add('hidden');

    tabLogin?.classList.add('bg-white', 'text-rose-900', 'font-black', 'shadow-xs');
    tabLogin?.classList.remove('text-slate-500', 'font-bold');
    tabRegister?.classList.remove('bg-white', 'text-rose-900', 'font-black', 'shadow-xs');
    tabRegister?.classList.add('text-slate-500', 'font-bold');

    if (modalTitle) modalTitle.textContent = "Masuk ke Akun";
    if (modalSubtitle) modalSubtitle.textContent = "Pusat Barkas Solo Raya 7 Wilayah";
  }
}

function populateRegisterDistricts() {
  const regionSelect = document.getElementById('reg-select-region');
  const districtSelect = document.getElementById('reg-select-district');
  if (!regionSelect || !districtSelect) return;

  const regionId = regionSelect.value || 'solo';
  const districts = getDistrictsByRegionId(regionId);
  districtSelect.innerHTML = districts.map((d) => `<option value="${d}">${d}</option>`).join('');
}

// -------------------------------------------------------------
// CREATE LISTING (PASANG IKLAN BARKAS)
// -------------------------------------------------------------
function openCreateListingModal() {
  const user = state.currentUser || getCurrentUser();
  if (!user) {
    openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memasang iklan barang bekas.');
    return;
  }
  state.currentUser = user;

  // Reset to Create Mode
  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = '';

  const titleModal = document.getElementById('form-create-listing-title');
  if (titleModal) titleModal.textContent = "Pasang Iklan Barkas Solo Raya";

  const subtitleModal = document.getElementById('form-create-listing-subtitle');
  if (subtitleModal) subtitleModal.textContent = "Jangkau calon pembeli di 7 wilayah Solo Raya";

  const btnSubmitText = document.getElementById('btn-submit-listing-text');
  if (btnSubmitText) btnSubmitText.textContent = "Tayangkan Iklan Sekarang";

  updateCreateListingSellerInfo();
  resetCreateListingForm();
  openModal('modal-create-listing');
  if (window.lucide) window.lucide.createIcons();
}

function updateCreateListingSellerInfo() {
  const user = state.currentUser || getCurrentUser();
  const avatarEl = document.getElementById('form-seller-avatar');
  const nameEl = document.getElementById('form-seller-name-preview');
  const phoneEl = document.getElementById('form-seller-phone-preview');

  if (user && avatarEl && nameEl && phoneEl) {
    avatarEl.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
    nameEl.textContent = user.displayName || user.name;
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
  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = '';
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
// USER PROFILE SETTINGS (TAB PROFIL AKUN)
// -------------------------------------------------------------
let userProfileAvatarData = null;

function openUserProfileModal() {
  const user = state.currentUser || getCurrentUser();
  if (!user) {
    openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk mengatur profil.');
    return;
  }
  state.currentUser = user;
  userProfileAvatarData = user.avatar || '';

  // Avatar & Header Preview
  const avatarPreview = document.getElementById('profile-edit-avatar-preview');
  const namePreview = document.getElementById('profile-edit-name-preview');
  const joinedPreview = document.getElementById('profile-edit-joined-preview');

  if (avatarPreview) avatarPreview.src = user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
  if (namePreview) namePreview.textContent = user.displayName || user.name || 'Pengguna';
  
  const createdDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const dateFormatted = !isNaN(createdDate) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '01 Agustus 2026';
  if (joinedPreview) joinedPreview.textContent = `Bergabung: ${dateFormatted}`;

  // Inputs
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

  // Regions & Districts
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

  // Avatar Upload Listener
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

  // Form Submit
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

        state.currentUser = updated;
        closeModal('modal-user-profile');
        renderAuthNav();
        renderListings();
        showToast("Profil & pengaturan akun berhasil diperbarui!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
  }

  // Logout Button inside Profile Modal
  const logoutBtn = document.getElementById('btn-profile-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      closeModal('modal-user-profile');
      closeModal('modal-my-listings');
      logout();
      state.currentUser = null;
      renderAuthNav();
      renderListings();
      updateStickyHeaderVisibility(true);
      showToast("Anda telah berhasil keluar dari akun.", "info");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  openModal('modal-user-profile');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// TOKO SAYA (SELLER DASHBOARD & MANAJEMEN TOKO)
// -------------------------------------------------------------
let activeStoreFilter = 'all';

function openMyListingsModal() {
  let user = state.currentUser || getCurrentUser();
  if (!user) {
    openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk mengelola TOKO SAYA.');
    return;
  }

  state.currentUser = user;
  const verResult = checkSellerVerification(user);
  const stats = getSellerStats(user.id);
  const ratingStats = getSellerRatingStats(user.id);

  // Fill store info
  const infoEl = document.getElementById('my-listings-seller-info');
  if (infoEl) infoEl.textContent = `Toko: ${user.storeName || user.displayName || user.name} (${user.email})`;

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
    const dateStr = !isNaN(createdDate) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Agt 2026';
    createdEl.textContent = `Bergabung: ${dateStr}`;
  }

  // Highlight: Jumlah Barang Terjual di Profil Toko
  const soldCountText = document.getElementById('my-store-sold-count-text');
  if (soldCountText) soldCountText.textContent = `${stats.soldCount} Terjual`;

  // Dynamic Badge: Strict 5 criteria
  const badgeContainer = document.getElementById('my-store-badge-container');
  if (badgeContainer) {
    if (verResult.isVerified) {
      badgeContainer.innerHTML = `
        <span class="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
          <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i>
          <span>🛡️ Toko Lokal ${user.region ? user.region.toUpperCase() : 'Solo'} Terverifikasi</span>
        </span>
      `;
    } else {
      badgeContainer.innerHTML = `
        <span class="bg-slate-700/80 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <i data-lucide="clock" class="w-3 h-3 text-amber-300"></i>
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
    if (verResult.isVerified) {
      verIcon.setAttribute('data-lucide', 'shield-check');
      verIcon.className = "w-4 h-4 text-emerald-400";
    } else {
      verIcon.setAttribute('data-lucide', 'shield-alert');
      verIcon.className = "w-4 h-4 text-amber-400";
    }
  }

  // Checklist 5 Items
  const c = verResult.criteria;
  
  // 1. Reviews
  const iconReviews = document.getElementById('check-icon-reviews');
  const textReviews = document.getElementById('check-text-reviews');
  if (iconReviews) {
    iconReviews.className = c.reviewsPositive.passed ? "w-4 h-4 text-emerald-400 flex-shrink-0" : "w-4 h-4 text-slate-400 flex-shrink-0";
    iconReviews.setAttribute('data-lucide', c.reviewsPositive.passed ? "check-circle-2" : "circle-dashed");
  }
  if (textReviews) textReviews.innerHTML = `1. Min 20 Ulasan Positif: <b class="${c.reviewsPositive.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.reviewsPositive.current}/20 ulasan</b>`;

  // 2. Rating
  const iconRating = document.getElementById('check-icon-rating');
  const textRating = document.getElementById('check-text-rating');
  if (iconRating) {
    iconRating.className = c.averageRating.passed ? "w-4 h-4 text-emerald-400 flex-shrink-0" : "w-4 h-4 text-slate-400 flex-shrink-0";
    iconRating.setAttribute('data-lucide', c.averageRating.passed ? "check-circle-2" : "circle-dashed");
  }
  if (textRating) textRating.innerHTML = `2. Rating Rata-rata Min 4.5: <b class="${c.averageRating.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.averageRating.current.toFixed(1)} / 5.0</b>`;

  // 3. Listings (Minimal 10 Postingan Barang)
  const iconListings = document.getElementById('check-icon-listings');
  const textListings = document.getElementById('check-text-listings');
  if (iconListings) {
    iconListings.className = c.totalListings.passed ? "w-4 h-4 text-emerald-400 flex-shrink-0" : "w-4 h-4 text-slate-400 flex-shrink-0";
    iconListings.setAttribute('data-lucide', c.totalListings.passed ? "check-circle-2" : "circle-dashed");
  }
  if (textListings) textListings.innerHTML = `3. Posting Min 10 Barang: <b class="${c.totalListings.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.totalListings.current}/10 barang</b>`;

  // 4. Profile
  const iconProfile = document.getElementById('check-icon-profile');
  const textProfile = document.getElementById('check-text-profile');
  if (iconProfile) {
    iconProfile.className = c.profileComplete.passed ? "w-4 h-4 text-emerald-400 flex-shrink-0" : "w-4 h-4 text-slate-400 flex-shrink-0";
    iconProfile.setAttribute('data-lucide', c.profileComplete.passed ? "check-circle-2" : "circle-dashed");
  }
  if (textProfile) textProfile.innerHTML = `4. Profil Lengkap: <b class="${c.profileComplete.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.profileComplete.passed ? 'Lengkap (Foto, Lokasi, WA)' : `Kurang: ${c.profileComplete.missing.join(', ')}`}</b>`;

  // 5. Account Age
  const iconAge = document.getElementById('check-icon-age');
  const textAge = document.getElementById('check-text-age');
  if (iconAge) {
    iconAge.className = c.accountAgeDays.passed ? "w-4 h-4 text-emerald-400 flex-shrink-0" : "w-4 h-4 text-slate-400 flex-shrink-0";
    iconAge.setAttribute('data-lucide', c.accountAgeDays.passed ? "check-circle-2" : "circle-dashed");
  }
  if (textAge) textAge.innerHTML = `5. Usia Akun Min 30 Hari: <b class="${c.accountAgeDays.passed ? 'text-emerald-400' : 'text-amber-300'}">${c.accountAgeDays.current}/30 hari</b>`;

  // Toggle button for verification details
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

  // Update 5 Store Metrics
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
  if (statRating) statRating.textContent = `⭐ ${ratingStats.averageRating.toFixed(1)}`;
  if (statRevLabel) statRevLabel.textContent = `${ratingStats.totalReviews} Ulasan`;

  // Update Etalase Tab Counts
  const countAll = document.getElementById('store-count-all');
  const countAvail = document.getElementById('store-count-available');
  const countBooked = document.getElementById('store-count-booked');
  const countSold = document.getElementById('store-count-sold');

  if (countAll) countAll.textContent = stats.totalListings;
  if (countAvail) countAvail.textContent = stats.availableCount;
  if (countBooked) countBooked.textContent = stats.bookedCount;
  if (countSold) countSold.textContent = stats.soldCount;

  // Setup Etalase Filter Tabs Click Listeners
  document.querySelectorAll('.store-filter-tab').forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll('.store-filter-tab').forEach((t) => {
        t.classList.remove('active', 'bg-rose-900', 'text-white', 'shadow-xs');
        t.classList.add('text-slate-600');
      });
      tab.classList.add('active', 'bg-rose-900', 'text-white', 'shadow-xs');
      tab.classList.remove('text-slate-600');
      activeStoreFilter = tab.getAttribute('data-store-filter') || 'all';
      renderMyListings(activeStoreFilter);
    };
  });

  // Reviews Summary Box
  const reviews = getSellerReviews(user.id);
  const summaryBadge = document.getElementById('my-store-rating-summary-badge');
  const reviewsContainer = document.getElementById('my-store-reviews-container');
  const reviewsEmpty = document.getElementById('my-store-reviews-empty');

  if (summaryBadge) summaryBadge.textContent = `⭐ ${ratingStats.averageRating.toFixed(1)} (${ratingStats.totalReviews} Ulasan)`;

  if (reviewsContainer) {
    if (reviews.length === 0) {
      reviewsContainer.innerHTML = '';
      reviewsEmpty?.classList.remove('hidden');
    } else {
      reviewsEmpty?.classList.add('hidden');
      let revHtml = '';
      reviews.slice(0, 5).forEach((r) => {
        const d = new Date(r.createdAt);
        const dStr = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
        revHtml += `
          <div class="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800">${r.buyerName}</span>
              <span class="text-amber-500 font-black">${'★'.repeat(r.rating)}</span>
            </div>
            <p class="text-slate-600 font-medium">"${r.comment}"</p>
          </div>
        `;
      });
      reviewsContainer.innerHTML = revHtml;
    }
  }

  // Pasang Iklan Baru from dashboard button
  const createBtn = document.getElementById('btn-my-store-create-listing');
  if (createBtn) {
    createBtn.onclick = () => {
      closeModal('modal-my-listings');
      openCreateListingModal();
    };
  }

  renderMyListings(activeStoreFilter);
  openModal('modal-my-listings');
  if (window.lucide) window.lucide.createIcons();
}

function renderMyListings(filter = 'all') {
  const container = document.getElementById('my-listings-container');
  const emptyView = document.getElementById('my-listings-empty');
  const user = state.currentUser;
  if (!container || !user) return;

  const myListings = getMyListings(user.id);

  // Update quick stats
  const stats = getSellerStats(user.id);
  const statTotal = document.getElementById('my-stat-total');
  const statAvailable = document.getElementById('my-stat-available');
  const statBooked = document.getElementById('my-stat-booked');
  const statSold = document.getElementById('my-stat-sold');
  const soldCountText = document.getElementById('my-store-sold-count-text');

  if (statTotal) statTotal.textContent = stats.totalListings;
  if (statAvailable) statAvailable.textContent = stats.availableCount;
  if (statBooked) statBooked.textContent = stats.bookedCount;
  if (statSold) statSold.textContent = stats.soldCount;
  if (soldCountText) soldCountText.textContent = `${stats.soldCount} Terjual`;

  // Filter listings based on active tab
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

    // Prominent Status Badge styling
    let statusBadgeHtml = '';
    let statusBorderColor = 'border-slate-200';
    if (itemStatus === 'sold') {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-rose-600 text-white shadow-xs tracking-wider">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i>
          <span>TERJUAL</span>
        </span>
      `;
      statusBorderColor = 'border-rose-200 bg-rose-50/20';
    } else if (itemStatus === 'booked') {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-500 text-white shadow-xs tracking-wider">
          <i data-lucide="clock" class="w-3 h-3"></i>
          <span>BOOKED</span>
        </span>
      `;
      statusBorderColor = 'border-amber-200 bg-amber-50/20';
    } else {
      statusBadgeHtml = `
        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg bg-emerald-600 text-white shadow-xs tracking-wider">
          <i data-lucide="sparkles" class="w-3 h-3"></i>
          <span>TERSEDIA</span>
        </span>
      `;
      statusBorderColor = 'border-slate-200 bg-white';
    }

    html += `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-2xl border ${statusBorderColor} shadow-2xs hover:shadow-md transition-all">
        
        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
          <div class="relative flex-shrink-0">
            <img src="${item.images[0]}" alt="${item.title}" class="w-20 h-20 sm:w-20 sm:h-20 rounded-2xl object-cover border border-slate-200 shadow-xs">
            <!-- Small status indicator dot on image -->
            <span class="absolute top-1 left-1 w-3 h-3 rounded-full border-2 border-white ${
              itemStatus === 'sold' ? 'bg-rose-600' : itemStatus === 'booked' ? 'bg-amber-500' : 'bg-emerald-500'
            }"></span>
          </div>
          
          <div class="flex-1 min-w-0 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              ${statusBadgeHtml}
              <span class="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                📍 ${regionName} • ${item.district || 'Solo Raya'}
              </span>
              <span class="text-[11px] text-slate-400 font-medium">👁️ ${item.views || 1} tayangan</span>
            </div>

            <h4 class="text-xs sm:text-sm font-black text-slate-900 truncate leading-snug" title="${item.title}">
              ${item.title}
            </h4>

            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs sm:text-sm font-black text-rose-900">${formatRupiah(item.price)}</span>
              <span class="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                ${item.negoType === 'pas' ? 'Harga Pas' : 'Bisa Nego'}
              </span>
            </div>

            ${item.codPoint ? `<div class="text-[10px] text-slate-500 truncate flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-rose-800 flex-shrink-0"></i><span>COD: ${item.codPoint}</span></div>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 flex-shrink-0 self-end sm:self-center">
          
          <!-- Status Selector Dropdown -->
          <div class="space-y-0.5">
            <select 
              data-action="change-status" 
              data-id="${item.id}"
              class="text-xs font-black px-3 py-2 rounded-xl border border-slate-300 ${
                itemStatus === 'sold' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                itemStatus === 'booked' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                'bg-emerald-50 text-emerald-900 border-emerald-300'
              } focus:ring-2 focus:ring-rose-900 focus:outline-none cursor-pointer"
            >
              <option value="available" ${itemStatus === 'available' ? 'selected' : ''}>🟢 Tersedia</option>
              <option value="booked" ${itemStatus === 'booked' ? 'selected' : ''}>🟡 Booked</option>
              <option value="sold" ${itemStatus === 'sold' ? 'selected' : ''}>🔴 Terjual</option>
            </select>
          </div>

          <!-- Edit Button -->
          <button 
            data-action="edit-listing" 
            data-id="${item.id}"
            class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
            title="Sunting / Edit Iklan"
          >
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit</span>
          </button>
          
          <!-- Delete Button -->
          <button 
            data-action="delete-listing" 
            data-id="${item.id}"
            class="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
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
      renderMyListings(activeStoreFilter);
      renderListings();
      renderRegionPills();
      const label = newStatus === 'sold' ? 'Terjual' : newStatus === 'booked' ? 'Booked' : 'Tersedia';
      showToast(`Status barang berhasil diubah menjadi "${label}"!`, "success");
    });
  });

  // Edit listing event
  container.querySelectorAll('[data-action="edit-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      closeModal('modal-my-listings');
      openEditListingModal(id);
    });
  });

  // Delete listing event
  container.querySelectorAll('[data-action="delete-listing"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (confirm("Apakah Anda yakin ingin menghapus barang jualan ini dari etalase toko Anda?")) {
        deleteListing(id);
        renderMyListings(activeStoreFilter);
        renderListings();
        renderRegionPills();
        showToast("Barang jualan berhasil dihapus.", "info");
      }
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// EDIT LISTING MODAL
// -------------------------------------------------------------
function openEditListingModal(listingId) {
  if (!isUserLoggedIn()) {
    openUserAuthModal('login', 'Silakan masuk terlebih dahulu untuk menyunting iklan.');
    return;
  }

  const listing = getListingById(listingId);
  if (!listing) {
    showToast("Data iklan tidak ditemukan.", "error");
    return;
  }

  const editIdInput = document.getElementById('form-input-edit-id');
  if (editIdInput) editIdInput.value = listing.id;

  const titleModal = document.getElementById('form-create-listing-title');
  if (titleModal) titleModal.textContent = "Sunting Iklan Barkas Solo Raya";

  const subtitleModal = document.getElementById('form-create-listing-subtitle');
  if (subtitleModal) subtitleModal.textContent = "Perbarui rincian, foto, harga, atau lokasi COD";

  const btnSubmitText = document.getElementById('btn-submit-listing-text');
  if (btnSubmitText) btnSubmitText.textContent = "Simpan Perubahan Iklan";

  // Pre-fill fields
  const titleInput = document.getElementById('form-input-title');
  if (titleInput) titleInput.value = listing.title;

  const catInput = document.getElementById('form-input-category');
  if (catInput) catInput.value = listing.category;

  const condInput = document.getElementById('form-input-condition');
  if (condInput) condInput.value = listing.condition;

  const priceInput = document.getElementById('form-input-price');
  if (priceInput) {
    priceInput.value = listing.price;
    const pricePreview = document.getElementById('price-rupiah-preview');
    if (pricePreview) pricePreview.textContent = formatRupiah(listing.price);
  }

  const negoInput = document.getElementById('form-input-nego');
  if (negoInput) negoInput.value = listing.negoType;

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

  state.uploadedImages = listing.images ? [...listing.images] : [];
  renderFormImagePreviews();

  openModal('modal-create-listing');
  if (window.lucide) window.lucide.createIcons();
}

// -------------------------------------------------------------
// SELLER PROFILE & REVIEWS MODAL
// -------------------------------------------------------------
let activeProfileSellerId = null;

function openSellerProfileModal(sellerIdOrObj) {
  let sellerId = typeof sellerIdOrObj === 'string' ? sellerIdOrObj : sellerIdOrObj?.id;
  if (!sellerId) return;

  activeProfileSellerId = sellerId;
  const sellerUser = getUserById(sellerId);
  const sellerListings = getListingsBySellerId(sellerId);
  const sellerReviews = getSellerReviews(sellerId);
  const ratingStats = getSellerRatingStats(sellerId);

  // Seller header info
  const avatarEl = document.getElementById('seller-profile-avatar');
  const nameEl = document.getElementById('seller-profile-name');
  const badgeTextEl = document.getElementById('seller-profile-badge-text');
  const bioEl = document.getElementById('seller-profile-bio');
  const regionEl = document.getElementById('seller-profile-region').querySelector('span');
  const createdEl = document.getElementById('seller-profile-created').querySelector('span');
  const waBtn = document.getElementById('seller-profile-wa-btn');

  const displayName = sellerUser?.storeName || sellerUser?.displayName || sellerUser?.name || (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.displayName : 'Toko Barkas');
  const avatarUrl = sellerUser?.avatar || (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.avatar : null) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
  const regionName = sellerUser?.region ? sellerUser.region.toUpperCase() : (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.region?.toUpperCase() : 'SOLO RAYA');
  const districtName = sellerUser?.district || '';
  const bioText = sellerUser?.bio || `Pusat jual beli barang bekas amanah dan terpercaya di area ${regionName}. Pantau cocok bayar!`;

  const verCheck = checkSellerVerification(sellerId);
  if (avatarEl) avatarEl.src = avatarUrl;
  if (nameEl) nameEl.textContent = displayName;
  if (badgeTextEl) {
    badgeTextEl.textContent = verCheck.isVerified 
      ? `Toko Lokal ${regionName} Terverifikasi`
      : `Toko Member ${regionName}`;
    const badgeParent = badgeTextEl.parentElement;
    if (badgeParent) {
      if (verCheck.isVerified) {
        badgeParent.className = "inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      } else {
        badgeParent.className = "inline-flex items-center gap-1 bg-slate-700 text-slate-300 border border-slate-600 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      }
    }
  }
  if (bioEl) bioEl.textContent = bioText;
  if (regionEl) regionEl.textContent = districtName ? `${regionName} • ${districtName}` : regionName;

  const rawJoined = sellerUser?.createdAt || '2026-08-01T08:00:00.000Z';
  const joinedDate = new Date(rawJoined);
  const formattedJoined = !isNaN(joinedDate) ? joinedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Agt 2026';
  if (createdEl) createdEl.textContent = `Bergabung: ${formattedJoined}`;

  // WhatsApp Button
  if (waBtn) {
    const phone = sellerUser?.phone || (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.phone : '081234567890');
    const waText = encodeURIComponent(`Halo ${displayName}, saya melihat profil toko Anda di Pusat Barkas Solo Raya. Ingin menanyakan barang jualan Anda. Terima kasih!`);
    waBtn.href = `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, '')}&text=${waText}`;
  }

  // Quick stats
  const activeCount = sellerListings.filter((l) => !l.isSold && l.status !== 'sold').length;
  const soldCount = sellerListings.filter((l) => l.isSold || l.status === 'sold').length;

  document.getElementById('seller-stat-active').textContent = activeCount;
  document.getElementById('seller-stat-sold').textContent = soldCount;
  document.getElementById('seller-stat-rating').querySelector('span').textContent = ratingStats.averageRating.toFixed(1);
  document.getElementById('seller-stat-reviews').textContent = ratingStats.totalReviews;

  document.getElementById('seller-tab-items-count').textContent = sellerListings.length;
  document.getElementById('seller-tab-reviews-count').textContent = ratingStats.totalReviews;

  // Render Tab 1: Listings
  renderSellerProfileListings(sellerListings);

  // Render Tab 2: Reviews
  renderSellerProfileReviews(sellerId, sellerReviews, ratingStats);

  // Reset Tab selection to Tab 1
  switchSellerProfileTab('items');

  // Setup tab click listeners
  document.getElementById('tab-btn-seller-items').onclick = () => switchSellerProfileTab('items');
  document.getElementById('tab-btn-seller-reviews').onclick = () => switchSellerProfileTab('reviews');

  // Setup interactive star rating buttons
  setupStarRatingPicker();

  // Setup Review Form Submit & Instant Auth Interceptor with Mandatory Product Photo
  const reviewForm = document.getElementById('form-submit-seller-review');
  const commentInput = document.getElementById('input-review-comment');
  const reviewImageInput = document.getElementById('input-review-product-image');
  const reviewImagePreviewWrapper = document.getElementById('review-image-preview-wrapper');
  const reviewImagePreview = document.getElementById('review-image-preview');
  const btnRemoveReviewImage = document.getElementById('btn-remove-review-image');
  const reviewUploadLabel = document.getElementById('review-upload-label');
  const reviewUploadLabelWrapper = document.getElementById('review-upload-label-wrapper');
  const starRatingSelector = document.getElementById('star-rating-selector');
  let selectedReviewProductImage = null;

  function triggerInstantAuthPrompt(e) {
    if (!isUserLoggedIn()) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan toko.');
      return true;
    }
    return false;
  }

  function resetReviewImage() {
    selectedReviewProductImage = null;
    if (reviewImageInput) reviewImageInput.value = '';
    if (reviewImagePreview) reviewImagePreview.src = '';
    reviewImagePreviewWrapper?.classList.add('hidden');
    if (reviewUploadLabel) reviewUploadLabel.textContent = 'Ambil / Unggah Foto Barang yang Dibeli';
  }

  resetReviewImage();

  btnRemoveReviewImage?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetReviewImage();
  });

  // Prompt login immediately in 0ms on ANY touch or pointer or click event
  const instantEvents = ['touchstart', 'pointerdown', 'mousedown', 'focusin', 'click'];

  instantEvents.forEach((evtName) => {
    commentInput?.addEventListener(evtName, (e) => {
      if (triggerInstantAuthPrompt(e)) return;
    }, { capture: true });

    starRatingSelector?.addEventListener(evtName, (e) => {
      if (triggerInstantAuthPrompt(e)) return;
    }, { capture: true });

    reviewUploadLabelWrapper?.addEventListener(evtName, (e) => {
      if (triggerInstantAuthPrompt(e)) return;
    }, { capture: true });

    reviewImageInput?.addEventListener(evtName, (e) => {
      if (triggerInstantAuthPrompt(e)) return;
    }, { capture: true });
  });

  reviewImageInput?.addEventListener('change', (e) => {
    if (!isUserLoggedIn()) {
      e.preventDefault();
      reviewImageInput.value = '';
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan toko.');
      return;
    }

    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      selectedReviewProductImage = event.target.result;
      if (reviewImagePreview) reviewImagePreview.src = selectedReviewProductImage;
      reviewImagePreviewWrapper?.classList.remove('hidden');
      if (reviewUploadLabel) reviewUploadLabel.textContent = 'Foto Produk Berhasil Dipilih ✓';
      if (window.lucide) window.lucide.createIcons();
    };
    reader.readAsDataURL(file);
  });

  if (reviewForm) {
    reviewForm.onsubmit = (e) => {
      e.preventDefault();
      if (!isUserLoggedIn()) {
        openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan toko.');
        return;
      }

      const user = state.currentUser || getCurrentUser();
      if (user && user.id === sellerId) {
        showToast("Anda tidak dapat memberikan ulasan untuk toko Anda sendiri.", "error");
        return;
      }

      // Validasi wajib foto produk yang dibeli
      if (!selectedReviewProductImage) {
        showToast("Ulasan ditolak sistem: Anda wajib melampirkan foto barang/produk yang dibeli sebagai bukti ulasan.", "error");
        return;
      }

      const ratingVal = document.getElementById('input-review-rating')?.value || 5;
      const commentVal = document.getElementById('input-review-comment')?.value || '';

      try {
        addSellerReview({
          sellerId,
          rating: Number(ratingVal),
          comment: commentVal,
          productImage: selectedReviewProductImage
        });

        document.getElementById('input-review-comment').value = '';
        resetReviewImage();
        const updatedReviews = getSellerReviews(sellerId);
        const updatedStats = getSellerRatingStats(sellerId);
        
        document.getElementById('seller-stat-rating').querySelector('span').textContent = updatedStats.averageRating.toFixed(1);
        document.getElementById('seller-stat-reviews').textContent = updatedStats.totalReviews;
        document.getElementById('seller-tab-reviews-count').textContent = updatedStats.totalReviews;

        renderSellerProfileReviews(sellerId, updatedReviews, updatedStats);
        showToast("Ulasan terverifikasi & foto produk berhasil dikirim!", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    };
  }

  openModal('modal-seller-profile');
  if (window.lucide) window.lucide.createIcons();
}

function switchSellerProfileTab(tabName) {
  const btnItems = document.getElementById('tab-btn-seller-items');
  const btnReviews = document.getElementById('tab-btn-seller-reviews');
  const panelItems = document.getElementById('seller-tab-panel-items');
  const panelReviews = document.getElementById('seller-tab-panel-reviews');

  if (tabName === 'items') {
    btnItems.className = "pb-2.5 font-bold text-xs sm:text-sm text-rose-900 border-b-2 border-rose-900 flex items-center gap-1.5 transition-all";
    btnReviews.className = "pb-2.5 font-bold text-xs sm:text-sm text-slate-400 hover:text-slate-700 border-b-2 border-transparent flex items-center gap-1.5 transition-all";
    panelItems?.classList.remove('hidden');
    panelReviews?.classList.add('hidden');
  } else {
    btnReviews.className = "pb-2.5 font-bold text-xs sm:text-sm text-rose-900 border-b-2 border-rose-900 flex items-center gap-1.5 transition-all";
    btnItems.className = "pb-2.5 font-bold text-xs sm:text-sm text-slate-400 hover:text-slate-700 border-b-2 border-transparent flex items-center gap-1.5 transition-all";
    panelReviews?.classList.remove('hidden');
    panelItems?.classList.add('hidden');
  }
}

function renderSellerProfileListings(listings) {
  const container = document.getElementById('seller-listings-container');
  const emptyEl = document.getElementById('seller-listings-empty');
  if (!container) return;

  if (listings.length === 0) {
    container.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');

  let html = '';
  listings.forEach((item) => {
    const isSold = item.isSold || item.status === 'sold';
    const isBooked = item.status === 'booked';
    html += `
      <div 
        data-action="seller-item-click" 
        data-id="${item.id}"
        class="group bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col"
      >
        <div class="relative aspect-[4/5] bg-slate-200 overflow-hidden">
          <img src="${item.images[0]}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          ${isSold ? `
            <div class="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
              <span class="bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded">TERJUAL</span>
            </div>
          ` : isBooked ? `
            <div class="absolute top-1.5 left-1.5">
              <span class="bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded">BOOKED</span>
            </div>
          ` : ''}
        </div>
        <div class="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
          <h4 class="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">${item.title}</h4>
          <div class="text-xs font-black text-rose-900">${formatRupiah(item.price)}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('[data-action="seller-item-click"]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      closeModal('modal-seller-profile');
      openProductDetail(id);
    });
  });
}

function renderSellerProfileReviews(sellerId, reviews, ratingStats) {
  // Update score and stars
  const scoreEl = document.getElementById('seller-rating-score');
  const countTextEl = document.getElementById('seller-rating-count-text');
  if (scoreEl) scoreEl.textContent = ratingStats.averageRating.toFixed(1);
  if (countTextEl) countTextEl.textContent = `Berdasarkan ${ratingStats.totalReviews} ulasan`;

  // Progress bars
  const total = ratingStats.totalReviews || 1;
  for (let i = 1; i <= 5; i++) {
    const count = ratingStats.ratingCounts[i] || 0;
    const pct = ratingStats.totalReviews > 0 ? ((count / total) * 100).toFixed(0) : (i === 5 ? 100 : 0);
    const progEl = document.getElementById(`progress-star-${i}`);
    const countEl = document.getElementById(`count-star-${i}`);
    if (progEl) progEl.style.width = `${pct}%`;
    if (countEl) countEl.textContent = count;
  }

  // Reviews list
  const listContainer = document.getElementById('seller-reviews-list-container');
  const emptyReviewsEl = document.getElementById('seller-reviews-empty');
  if (!listContainer) return;

  if (reviews.length === 0) {
    listContainer.innerHTML = '';
    emptyReviewsEl?.classList.remove('hidden');
    return;
  }

  emptyReviewsEl?.classList.add('hidden');

  let html = '';
  reviews.forEach((r) => {
    const d = new Date(r.createdAt);
    const dateFormatted = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Baru saja';
    
    let starsHtml = '';
    for (let s = 1; s <= 5; s++) {
      starsHtml += `<i data-lucide="star" class="w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}"></i>`;
    }

    html += `
      <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <img src="${r.buyerAvatar}" alt="${r.buyerName}" class="w-7 h-7 rounded-full object-cover border border-slate-300">
            <div>
              <div class="font-extrabold text-xs text-slate-900">${r.buyerName}</div>
              <div class="flex items-center gap-0.5">${starsHtml}</div>
            </div>
          </div>
          <span class="text-[10px] text-slate-400 font-medium">${dateFormatted}</span>
        </div>
        <p class="text-xs text-slate-700 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/60 font-medium">
          "${r.comment}"
        </p>
        ${r.productImage ? `
          <div class="flex items-center gap-2.5 p-2 bg-rose-50/80 border border-rose-200/80 rounded-xl">
            <img src="${r.productImage}" alt="Foto Barang yang Dibeli" class="w-14 h-14 rounded-lg object-cover border border-rose-200 shadow-2xs flex-shrink-0 cursor-pointer hover:scale-105 transition-transform" onclick="window.open('${r.productImage}', '_blank')">
            <div class="space-y-0.5 min-w-0">
              <span class="inline-flex items-center gap-1 text-[10px] font-black text-rose-900 bg-rose-200/80 px-2 py-0.5 rounded">
                <i data-lucide="camera" class="w-3 h-3 text-rose-700"></i>
                <span>Foto Produk yang Dibeli</span>
              </span>
              <p class="text-[10.5px] text-slate-600 font-bold truncate">Bukti produk saat transaksi</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  listContainer.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
}

function setupStarRatingPicker() {
  const container = document.getElementById('star-rating-selector');
  const hiddenInput = document.getElementById('input-review-rating');
  const labelEl = document.getElementById('star-rating-label');
  if (!container || !hiddenInput) return;

  const labels = {
    1: '1 Bintang (Kecewa)',
    2: '2 Bintang (Kurang)',
    3: '3 Bintang (Cukup)',
    4: '4 Bintang (Puas)',
    5: '5 Bintang (Sangat Puas)'
  };

  function updateStars(val) {
    hiddenInput.value = val;
    if (labelEl) labelEl.textContent = labels[val] || `${val} Bintang`;

    container.querySelectorAll('.star-btn').forEach((btn) => {
      const r = parseInt(btn.getAttribute('data-rating'), 10);
      if (r <= val) {
        btn.className = "star-btn p-1 text-amber-400 hover:text-amber-500 transition-colors";
      } else {
        btn.className = "star-btn p-1 text-slate-300 hover:text-amber-400 transition-colors";
      }
    });
  }

  container.querySelectorAll('.star-btn').forEach((btn) => {
    ['pointerdown', 'touchstart', 'mousedown', 'click'].forEach((evt) => {
      btn.addEventListener(evt, (e) => {
        if (!isUserLoggedIn()) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
          openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan toko.');
          return;
        }
        if (evt === 'click' || evt === 'pointerdown') {
          const ratingVal = parseInt(btn.getAttribute('data-rating'), 10);
          updateStars(ratingVal);
        }
      }, { capture: true });
    });
  });

  // Default to 5 stars
  updateStars(5);
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

  // Bottom Navigation Dock & Modal Triggers
  document.getElementById('nav-btn-home')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]').forEach((m) => closeModal(m.id));
    updateStickyHeaderVisibility(true);
    resetAllFilters();
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('nav-btn-filter')?.addEventListener('click', (e) => {
    e.preventDefault();
    openFilterModal();
  });
  document.getElementById('btn-open-filter-modal')?.addEventListener('click', (e) => {
    e.preventDefault();
    openFilterModal();
  });
  document.getElementById('btn-apply-filter-modal')?.addEventListener('click', applyFilterModal);
  document.getElementById('btn-reset-filter-modal')?.addEventListener('click', () => {
    resetAllFilters();
    closeModal('modal-filter');
  });

  document.getElementById('nav-btn-traktir')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-traktir-kopi');
  });

  document.getElementById('nav-btn-my-listings')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isUserLoggedIn() || getCurrentUser()) {
      window.location.href = 'toko-saya.html';
    } else {
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk membuka Toko Saya.');
    }
  });

  window.handleProfileNavClick = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const user = state.currentUser || getCurrentUser();
    if (user) {
      openUserProfileModal();
    } else {
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk mengakses profil Anda.');
    }
  };

  document.getElementById('nav-btn-profile')?.addEventListener('click', window.handleProfileNavClick);

  document.addEventListener('click', (e) => {
    const profileBtn = e.target.closest('[data-action="open-user-profile"], [data-action="open-profile"]');
    if (profileBtn) {
      e.preventDefault();
      window.handleProfileNavClick(e);
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

  // Form Create/Edit Listing Submit
  document.getElementById('form-create-listing')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const editId = document.getElementById('form-input-edit-id')?.value;

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
      if (editId) {
        const updated = updateListing(editId, listingPayload);
        closeModal('modal-create-listing');
        renderRegionPills();
        renderCategoryPills();
        renderListings();
        renderMyListings();
        showToast("Iklan berhasil diperbarui!", "success");
        setTimeout(() => openProductDetail(updated.id), 400);
      } else {
        const saved = saveListing(listingPayload);
        closeModal('modal-create-listing');
        renderRegionPills();
        renderCategoryPills();
        renderListings();
        renderMyListings();
        showToast("Iklan Anda berhasil dipasang dengan foto rasio 4:5 dan tayang di Solo Raya!", "success");
        setTimeout(() => openProductDetail(saved.id), 400);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Auth Modal Tab Switchers
  document.getElementById('tab-auth-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('tab-auth-register')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('btn-goto-forgot')?.addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('btn-forgot-back-to-login')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('btn-switch-to-reg-from-login')?.addEventListener('click', () => switchAuthTab('register'));
  document.getElementById('btn-switch-to-login-from-reg')?.addEventListener('click', () => switchAuthTab('login'));

  // Toggle Password Visibility in Login
  document.getElementById('btn-toggle-login-pass')?.addEventListener('click', () => {
    const input = document.getElementById('login-input-password');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  });

  // Dynamic District in Register Form
  document.getElementById('reg-select-region')?.addEventListener('change', () => {
    populateRegisterDistricts();
  });

  // Form User Login Submit
  document.getElementById('form-user-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = (document.getElementById('login-input-identifier')?.value || '').trim();
    const password = (document.getElementById('login-input-password')?.value || '').trim();

    try {
      const user = await loginUser(identifier, password);
      closeModal('modal-user-auth');
      renderAuthNav();
      renderListings();
      updateCreateListingSellerInfo();
      showToast(`🎉 Selamat datang kembali, ${user.displayName || user.name}!`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Form User Register Submit
  document.getElementById('form-user-register')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-input-name').value.trim();
    const storeName = document.getElementById('reg-input-store').value.trim();
    const phone = document.getElementById('reg-input-phone').value.trim();
    const email = document.getElementById('reg-input-email').value.trim();
    const region = document.getElementById('reg-select-region').value;
    const district = document.getElementById('reg-select-district').value;
    const password = document.getElementById('reg-input-password').value;
    const confirmPass = document.getElementById('reg-input-password-confirm').value;

    if (password !== confirmPass) {
      showToast("Konfirmasi password tidak cocok. Periksa kembali password Anda.", "error");
      return;
    }

    try {
      const user = registerUser({ name, storeName, phone, email, region, district, password });
      closeModal('modal-user-auth');
      renderAuthNav();
      showToast(`🎉 Pendaftaran Berhasil! Selamat datang di Pusat Barkas Solo Raya, ${user.displayName || user.name}.`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Form Forgot Password Request Submit
  document.getElementById('form-forgot-request')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-input-email').value.trim();

    try {
      const res = requestPasswordReset(email);
      const step2 = document.getElementById('forgot-step-reset');
      const codeDisplay = document.getElementById('forgot-display-code');
      const codeInput = document.getElementById('forgot-input-code');

      if (step2) step2.classList.remove('hidden');
      if (codeDisplay) codeDisplay.textContent = res.resetCode;
      if (codeInput) codeInput.value = res.resetCode;

      showToast(`Kode pemulihan [${res.resetCode}] berhasil disiapkan untuk ${res.email}`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Form Forgot Password Confirm Submit
  document.getElementById('form-forgot-confirm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-input-email').value.trim();
    const resetCode = document.getElementById('forgot-input-code').value.trim();
    const newPassword = document.getElementById('forgot-input-new-password').value;

    try {
      confirmPasswordReset(email, resetCode, newPassword);
      showToast("Password akun Anda berhasil diperbarui! Silakan masuk dengan password baru.", "success");
      switchAuthTab('login');
      const loginIdInput = document.getElementById('login-input-identifier');
      if (loginIdInput) loginIdInput.value = email;
      const loginPassInput = document.getElementById('login-input-password');
      if (loginPassInput) {
        loginPassInput.value = '';
        setTimeout(() => loginPassInput.focus(), 150);
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Share Modal Copy Link Button
  document.getElementById('btn-share-copy-link')?.addEventListener('click', () => {
    const input = document.getElementById('share-modal-link-input');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value).then(() => {
        showToast("Tautan iklan berhasil disalin ke clipboard!", "success");
      }).catch(() => {
        showToast("Tautan disalin", "info");
      });
    }
  });

  // Mobile Virtual Keyboard Auto-Scroll: Ensure focused input is always centered and visible
  document.addEventListener('focusin', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
      const modal = e.target.closest('#modal-user-auth, #modal-create-listing, #modal-user-profile, #modal-filter');
      if (modal) {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      }
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        setTimeout(() => {
          document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
    });
  }

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

function updateStickyHeaderVisibility(isHome = true) {
  const stickyHeader = document.getElementById('sticky-top-app-wrapper');
  if (!stickyHeader) return;
  if (isHome) {
    stickyHeader.style.display = '';
    stickyHeader.classList.remove('hidden');
  } else {
    stickyHeader.style.display = 'none';
    stickyHeader.classList.add('hidden');
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error("Modal not found:", modalId);
    return;
  }
  // Close any other open modals to prevent duplicate backdrop layering / z-index conflicts
  document.querySelectorAll('.fixed[id^="modal-"]').forEach((m) => {
    if (m.id !== modalId) {
      m.classList.add('hidden');
      m.style.display = 'none';
      m.style.visibility = 'hidden';
    }
  });

  // Sembunyikan sticky header atas saat membuka tab/modal selain Beranda
  updateStickyHeaderVisibility(false);
  
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  document.body.style.overflow = 'hidden';
  if (window.lucide) window.lucide.createIcons();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.style.visibility = 'hidden';
  
  const anyOpen = document.querySelectorAll('.fixed:not(.hidden)[id^="modal-"]').length > 0;
  if (!anyOpen) {
    document.body.style.overflow = '';
    // Kembalikan sticky header saat kembali berada di halaman Beranda
    updateStickyHeaderVisibility(true);
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
  const actionParam = params.get('action') || params.get('tab') || params.get('page');
  const regionParam = params.get('region');
  const itemParam = params.get('item');
  const hash = window.location.hash ? window.location.hash.toLowerCase() : '';

  if (regionParam && getRegionById(regionParam)) {
    setRegionFilter(regionParam);
  }

  if (itemParam) {
    openProductDetail(itemParam);
  } else if (actionParam === 'create-listing' || hash === '#pasang-iklan' || hash === '#jual') {
    if (isUserLoggedIn() || getCurrentUser()) {
      openCreateListingModal();
    } else {
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memasang iklan barang bekas.');
    }
  } else if (actionParam === 'edit' || hash.startsWith('#edit-')) {
    const editId = params.get('id') || hash.replace('#edit-', '');
    if (editId) {
      if (isUserLoggedIn() || getCurrentUser()) {
        openEditListingModal(editId);
      } else {
        openUserAuthModal('login', 'Silakan masuk terlebih dahulu untuk mengubah iklan.');
      }
    }
  } else if (actionParam === 'filter' || hash === '#filter') {
    openModal('modal-filter');
  } else if (actionParam === 'profil' || actionParam === 'profile' || hash === '#profil' || hash === '#profile') {
    if (isUserLoggedIn() || getCurrentUser()) {
      openUserProfileModal();
    } else {
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk melihat profil Anda.');
    }
  } else if (actionParam === 'traktir' || hash === '#traktir') {
    openModal('modal-traktir-kopi');
  }

  // Clear hash and action param from browser history so back/forward and home navigation won't re-trigger modals
  if (actionParam || (hash && hash !== '#' && hash !== '')) {
    try {
      window.history.replaceState({}, document.title, window.location.pathname + (regionParam ? `?region=${regionParam}` : ''));
    } catch (e) {}
  }
}
