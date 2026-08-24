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
  syncUsersFromCloud, syncAllUsersToCloudOnStartup,
  isDemoUser
} from './services/auth.js';
import { 
  initializeStorage, getPublicListings, getListingById, saveListing, 
  updateListing, updateListingStatus, toggleSoldStatus, deleteListing, incrementListingViews, getMyListings, 
  toggleFavorite, isFavorite, getSiteSettings, getCustomTexts,
  saveSiteSettings, saveCustomTexts, getListingsBySellerId, getSellerStats,
  getSellerReviews, addSellerReview, getSellerRatingStats,
  checkSellerVerification, isSellerVerified,
  toggleHideSellerReview, deleteSellerReview,
  getAppReviews, addAppReview, deleteAppReview, toggleHideAppReview, getAppRatingStats
} from './services/storage.js';
import { initLiveActivityWidget, notifyUserJustLoggedIn, getLiveOnlineCount } from './services/liveActivity.js';

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
  uploadedImages: [], // Max 3 photos (Aspect 1:1 Square)
  currentUser: null,
  siteSettings: getSiteSettings(),
  customTexts: getCustomTexts(),
  isVisualEditorActive: false
};

// Initialize App
function startApp() {
  initializeStorage();
  
  // Apply initial site appearance & custom texts from global state
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

  // Listen to Admin Settings Changes (Instant real-time sync across devices)
  window.addEventListener('siteSettingsChanged', (e) => {
    state.siteSettings = e.detail;
    applySiteSettings(e.detail);
    renderListings();
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

  // Cross-Tab storage listener
  window.addEventListener('storage', (e) => {
    if (e.key === 'pusat_barkas_site_settings') {
      state.siteSettings = getSiteSettings();
      applySiteSettings(state.siteSettings);
      renderListings();
    } else if (e.key === 'pusat_barkas_custom_texts') {
      state.customTexts = getCustomTexts();
      applyCustomTexts(state.customTexts);
    } else if (e.key === 'pusat_barkas_listings') {
      renderRegionPills();
      renderListings();
    }
  });

  // Auto-refresh & Cache-Bust from Central Database when HP user wakes phone/switches tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      initializeStorage();
    }
  });

  renderRegionPills();
  renderCategoryPills();
  initHeroBannerCarousel();
  populateFormRegions();
  populateFilterModalOptions();
  updateSortRadioUI();
  renderListings();
  initEventListeners();
  initAppReviews();
  initLiveVisualEditor();
  initSplashScreen();
  
  if (!window.location.search.includes('mode=mobile_editor')) {
    document.body.classList.remove('visual-editor-active', 'is-in-phone-frame');
    document.getElementById('floating-live-editor-bar')?.classList.add('hidden');
    document.getElementById('live-editor-overlay-bubble')?.classList.add('hidden');
  }

  handleInitialUrlParams();
  
  if (window.lucide) window.lucide.createIcons();
}

function initSplashScreen() {
  const splash = document.getElementById('app-splash-screen');
  if (!splash) return;

  let hidden = false;
  const hideSplash = () => {
    if (hidden) return;
    hidden = true;
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 750);
  };

  // Smooth fade-out after 1.5s
  setTimeout(hideSplash, 1500);

  // Instant dismiss on tap/click
  splash.addEventListener('click', hideSplash);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

// -------------------------------------------------------------
// LIVE VISUAL IN-PLACE EDITOR (OVERLAY APPROACH)
// -------------------------------------------------------------

let activeEditableTarget = null;
let activeEditableKey = null;

function initLiveVisualEditor() {
  let clickCount = 0;
  let clickTimer = null;
  let lastClickTime = 0;

  // 10-Clicks Hidden Trigger on Brand Logo
  window.handleSecretAdminClick = function(e) {
    if (e && e.preventDefault) e.preventDefault();

    const now = Date.now();
    if (now - lastClickTime < 40) return;
    lastClickTime = now;

    clickCount++;
    clearTimeout(clickTimer);

    if (clickCount >= 7 && clickCount < 10) {
      const remaining = 10 - clickCount;
      showToast(`🔑 ${remaining} ketukan lagi untuk membuka Akses Admin...`, "info");
    }

    if (clickCount >= 10) {
      clickCount = 0;
      showToast("🔓 10x Ketukan Berhasil! Mengalihkan ke Studio Visual...", "success");

      const isAuth = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
      if (isAuth) {
        window.location.href = 'admin.html?tab=studio';
      } else {
        openAdminLoginModal();
      }
      return;
    }

    clickTimer = setTimeout(() => {
      clickCount = 0;
    }, 4500);
  };

  const logoContainer = document.getElementById('brand-logo-icon-container');
  if (logoContainer) {
    logoContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.handleSecretAdminClick(e);
    });
  }

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

  // Floating Overlay Bubble Toolbar Controls
  initOverlayBubbleEvents();
}

function initOverlayBubbleEvents() {
  const bubble = document.getElementById('live-editor-overlay-bubble');
  if (!bubble) return;

  // Font Family Selector
  document.getElementById('bubble-font-family')?.addEventListener('change', (e) => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const font = e.target.value;
    activeEditableTarget.style.fontFamily = font !== 'inherit' ? font : '';
    saveElementStyle(activeEditableKey, 'fontFamily', font);
  });

  // Font Size Dec (-)
  document.getElementById('bubble-btn-font-dec')?.addEventListener('click', () => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const currentSize = parseFloat(window.getComputedStyle(activeEditableTarget).fontSize) || 14;
    const newSize = Math.max(9, Math.round(currentSize - 1));
    activeEditableTarget.style.fontSize = `${newSize}px`;
    saveElementStyle(activeEditableKey, 'fontSize', `${newSize}px`);
  });

  // Font Size Inc (+)
  document.getElementById('bubble-btn-font-inc')?.addEventListener('click', () => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const currentSize = parseFloat(window.getComputedStyle(activeEditableTarget).fontSize) || 14;
    const newSize = Math.min(48, Math.round(currentSize + 1));
    activeEditableTarget.style.fontSize = `${newSize}px`;
    saveElementStyle(activeEditableKey, 'fontSize', `${newSize}px`);
  });

  // Bold (B)
  document.getElementById('bubble-btn-bold')?.addEventListener('click', () => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const currentWeight = window.getComputedStyle(activeEditableTarget).fontWeight;
    const isBold = currentWeight === '700' || currentWeight === '800' || currentWeight === '900' || currentWeight === 'bold';
    const newWeight = isBold ? '400' : '800';
    activeEditableTarget.style.fontWeight = newWeight;
    saveElementStyle(activeEditableKey, 'fontWeight', newWeight);
  });

  // Italic (I)
  document.getElementById('bubble-btn-italic')?.addEventListener('click', () => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const currentStyle = window.getComputedStyle(activeEditableTarget).fontStyle;
    const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
    activeEditableTarget.style.fontStyle = newStyle;
    saveElementStyle(activeEditableKey, 'fontStyle', newStyle);
  });

  // Underline (U)
  document.getElementById('bubble-btn-underline')?.addEventListener('click', () => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const currentDecoration = window.getComputedStyle(activeEditableTarget).textDecoration;
    const newDec = currentDecoration.includes('underline') ? 'none' : 'underline';
    activeEditableTarget.style.textDecoration = newDec;
    saveElementStyle(activeEditableKey, 'textDecoration', newDec);
  });

  // Color Picker
  document.getElementById('bubble-color-picker')?.addEventListener('input', (e) => {
    if (!activeEditableTarget || !activeEditableKey) return;
    const color = e.target.value;
    activeEditableTarget.style.color = color;
    saveElementStyle(activeEditableKey, 'color', color);
  });

  // Close Bubble
  document.getElementById('bubble-btn-close')?.addEventListener('click', () => {
    hideOverlayBubble();
  });

  // Reposition on window scroll/resize
  window.addEventListener('scroll', () => {
    if (activeEditableTarget && state.isVisualEditorActive) {
      positionOverlayBubble(activeEditableTarget);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeEditableTarget && state.isVisualEditorActive) {
      positionOverlayBubble(activeEditableTarget);
    }
  }, { passive: true });
}

function broadcastStudioSync() {
  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: 'LIVE_STUDIO_SYNC',
        customTexts: state.customTexts || getCustomTexts(),
        siteSettings: state.siteSettings || getSiteSettings()
      }, '*');
    } catch (e) {}
  }
}

function saveElementStyle(key, prop, value) {
  if (!state.siteSettings) state.siteSettings = getSiteSettings();
  if (!state.siteSettings.textStyles) state.siteSettings.textStyles = {};
  if (!state.siteSettings.textStyles[key]) state.siteSettings.textStyles[key] = {};
  state.siteSettings.textStyles[key][prop] = value;
  broadcastStudioSync();
}

function showOverlayBubbleForElement(el, key) {
  activeEditableTarget = el;
  activeEditableKey = key;

  document.querySelectorAll('.active-editable-target').forEach((e) => e.classList.remove('active-editable-target'));
  el.classList.add('active-editable-target');

  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
    el.focus();
  } else {
    el.focus();
  }

  const bubble = document.getElementById('live-editor-overlay-bubble');
  if (bubble) {
    bubble.classList.remove('hidden');
    positionOverlayBubble(el);

    // Sync current element styles to bubble inputs
    const existingStyle = (state.siteSettings?.textStyles && state.siteSettings.textStyles[key]) || {};
    const fontSelect = document.getElementById('bubble-font-family');
    if (fontSelect) fontSelect.value = existingStyle.fontFamily || 'inherit';

    const colorPicker = document.getElementById('bubble-color-picker');
    if (colorPicker && existingStyle.color) colorPicker.value = existingStyle.color;
  }
}

function hideOverlayBubble() {
  const bubble = document.getElementById('live-editor-overlay-bubble');
  if (bubble) bubble.classList.add('hidden');
  if (activeEditableTarget) {
    activeEditableTarget.classList.remove('active-editable-target');
  }
  activeEditableTarget = null;
  activeEditableKey = null;
}

function positionOverlayBubble(targetElement) {
  const bubble = document.getElementById('live-editor-overlay-bubble');
  if (!bubble || !targetElement) return;

  const rect = targetElement.getBoundingClientRect();
  const bubbleWidth = bubble.offsetWidth || 340;
  const bubbleHeight = bubble.offsetHeight || 44;

  let top = rect.top - bubbleHeight - 8;
  if (top < 10) {
    top = rect.bottom + 8;
  }

  let left = rect.left + (rect.width / 2) - (bubbleWidth / 2);
  const maxLeft = window.innerWidth - bubbleWidth - 10;
  left = Math.max(10, Math.min(left, maxLeft));

  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}

// -------------------------------------------------------------
// AUTH MODAL & EDITOR LIFECYCLE
// -------------------------------------------------------------
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
    window.location.href = 'admin.html?tab=studio';
  } else {
    if (errorBox) {
      errorBox.classList.remove('hidden');
      errorBox.classList.add('animate-bounce');
      setTimeout(() => errorBox.classList.remove('animate-bounce'), 800);
    }
  }
}

function enableVisualEditor() {
  const isMobileEditor = window.location.search.includes('mode=mobile_editor');
  if (!isMobileEditor) {
    // Desktop utama SELALU BERSIH: jangan pernah tampilkan garis merah atau bar editor!
    document.body.classList.remove('visual-editor-active', 'is-in-phone-frame');
    document.getElementById('floating-live-editor-bar')?.classList.add('hidden');
    state.isVisualEditorActive = false;
    return;
  }

  state.isVisualEditorActive = true;
  document.body.classList.add('visual-editor-active', 'is-in-phone-frame');
  const bar = document.getElementById('floating-live-editor-bar');
  if (bar) {
    bar.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // Attach click & input listeners to all editable text elements
  document.querySelectorAll('[data-text-key]').forEach((el) => {
    const key = el.getAttribute('data-text-key');
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    }

    el.onclick = (e) => {
      e.stopPropagation();
      showOverlayBubbleForElement(el, key);
    };

    el.oninput = (e) => {
      const typed = (el.innerText || el.textContent || '').trim();
      if (!state.customTexts) state.customTexts = getCustomTexts();
      state.customTexts[key] = typed;
      
      // Live sync duplicate keys on the page
      document.querySelectorAll(`[data-text-key="${key}"]`).forEach((otherEl) => {
        if (otherEl !== el && otherEl.tagName !== 'INPUT' && otherEl.tagName !== 'TEXTAREA') {
          otherEl.textContent = typed;
        }
      });
      broadcastStudioSync();
    };
  });
}

function disableVisualEditor() {
  state.isVisualEditorActive = false;
  document.body.classList.remove('visual-editor-active');
  const bar = document.getElementById('floating-live-editor-bar');
  if (bar) bar.classList.add('hidden');

  hideOverlayBubble();

  // Restore saved texts & settings to ensure pristine state
  state.customTexts = getCustomTexts();
  state.siteSettings = getSiteSettings();
  applyCustomTexts(state.customTexts);
  applySiteSettings(state.siteSettings);

  document.querySelectorAll('[data-text-key]').forEach((el) => {
    el.removeAttribute('contenteditable');
    el.onclick = null;
    el.oninput = null;
  });

  showToast("Mode Edit Visual ditutup.", "info");
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
  const savedTexts = saveCustomTexts(collectedTexts);
  const savedSettings = saveSiteSettings(state.siteSettings);
  state.customTexts = savedTexts;
  state.siteSettings = savedSettings;

  // Apply immediately across page
  applyCustomTexts(savedTexts);
  applySiteSettings(savedSettings);

  if (window.parent && window.parent !== window) {
    try {
      window.parent.postMessage({
        type: 'LIVE_STUDIO_SAVED',
        customTexts: savedTexts,
        siteSettings: savedSettings
      }, '*');
    } catch (e) {}
  }

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

  showToast("💾 Seluruh perubahan teks, logo, grid, dan styling berhasil disimpan secara permanen!", "success");
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

  // 1. Global Font Family
  document.body.classList.remove(
    'font-sans', 'font-serif', 'font-mono', 'font-poppins', 
    'font-inter', 'font-roboto', 'font-montserrat', 'font-outfit', 'font-playfair'
  );
  if (settings.fontFamily === 'serif') {
    document.body.classList.add('font-serif');
  } else if (settings.fontFamily === 'mono') {
    document.body.classList.add('font-mono');
  } else if (settings.fontFamily === 'poppins') {
    document.body.classList.add('font-poppins');
  } else if (settings.fontFamily === 'inter') {
    document.body.classList.add('font-inter');
  } else if (settings.fontFamily === 'roboto') {
    document.body.classList.add('font-roboto');
  } else if (settings.fontFamily === 'montserrat') {
    document.body.classList.add('font-montserrat');
  } else if (settings.fontFamily === 'outfit') {
    document.body.classList.add('font-outfit');
  } else if (settings.fontFamily === 'playfair') {
    document.body.classList.add('font-playfair');
  } else {
    document.body.classList.add('font-sans');
  }

  // 2. Custom Element Styles (Per-element typography & colors from visual editor)
  if (settings.textStyles) {
    Object.keys(settings.textStyles).forEach((key) => {
      const style = settings.textStyles[key];
      if (!style) return;
      document.querySelectorAll(`[data-text-key="${key}"]`).forEach((el) => {
        if (style.fontFamily && style.fontFamily !== 'inherit') el.style.fontFamily = style.fontFamily;
        if (style.fontSize) el.style.fontSize = style.fontSize;
        if (style.fontWeight) el.style.fontWeight = style.fontWeight;
        if (style.fontStyle) el.style.fontStyle = style.fontStyle;
        if (style.textDecoration) el.style.textDecoration = style.textDecoration;
        if (style.color) el.style.color = style.color;
      });
    });
  }

  // 3. Filter Position (Above Hero vs Below Hero)
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

  // 4. Site Announcement Banner
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

  // 5. Brand Logo Rendering
  const logoContainer = document.getElementById('brand-logo-icon-container');
  if (logoContainer) {
    const rawLogoUrl = (settings.logoImageUrl && settings.logoImageUrl.trim() !== '') ? settings.logoImageUrl.trim() : 'assets/img/logo.png';
    let finalImgUrl = rawLogoUrl;
    if (!finalImgUrl.startsWith('data:') && !finalImgUrl.startsWith('assets/')) {
      const sep = finalImgUrl.includes('?') ? '&' : '?';
      finalImgUrl = `${finalImgUrl}${sep}v=${Date.now()}`;
    }
    logoContainer.className = "w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm hover:scale-105 transition-transform";
    logoContainer.innerHTML = `<img src="${finalImgUrl}" alt="Logo Pusat Barkas Solo Raya" class="w-full h-full object-contain pointer-events-none rounded-xl" onerror="this.src='assets/img/logo.png'">`;
  }

  // 6. Grid Switcher Active Button Highlights
  const currentStyle = settings.layoutStyle || 'grid';
  const currentCols = settings.layoutColumns || 'grid2';

  const btnGrid2 = document.getElementById('btn-grid-2-col');
  const btnGrid3 = document.getElementById('btn-grid-3-col');
  const btnList = document.getElementById('btn-grid-list');

  const dockGrid2 = document.getElementById('dock-btn-grid2');
  const dockGrid3 = document.getElementById('dock-btn-grid3');
  const dockList = document.getElementById('dock-btn-list');

  const activeBtnClass = "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all bg-white text-rose-900 shadow-xs cursor-pointer";
  const inactiveBtnClass = "px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all text-slate-600 hover:text-slate-900 cursor-pointer";

  const activeDockClass = "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all bg-rose-900 text-amber-300 cursor-pointer";
  const inactiveDockClass = "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all text-slate-400 hover:text-white cursor-pointer";

  if (currentStyle === 'list') {
    if (btnList) btnList.className = activeBtnClass;
    if (btnGrid2) btnGrid2.className = inactiveBtnClass;
    if (btnGrid3) btnGrid3.className = inactiveBtnClass;
    if (dockList) dockList.className = activeDockClass;
    if (dockGrid2) dockGrid2.className = inactiveDockClass;
    if (dockGrid3) dockGrid3.className = inactiveDockClass;
  } else if (currentCols === 'grid3') {
    if (btnGrid3) btnGrid3.className = activeBtnClass;
    if (btnGrid2) btnGrid2.className = inactiveBtnClass;
    if (btnList) btnList.className = inactiveBtnClass;
    if (dockGrid3) dockGrid3.className = activeDockClass;
    if (dockGrid2) dockGrid2.className = inactiveDockClass;
    if (dockList) dockList.className = inactiveDockClass;
  } else {
    if (btnGrid2) btnGrid2.className = activeBtnClass;
    if (btnGrid3) btnGrid3.className = inactiveBtnClass;
    if (btnList) btnList.className = inactiveBtnClass;
    if (dockGrid2) dockGrid2.className = activeDockClass;
    if (dockGrid3) dockGrid3.className = inactiveDockClass;
    if (dockList) dockList.className = inactiveDockClass;
  }

  // 7. Apply Detail Photo Size & Aspect Ratio Settings
  if (settings.detailImageSettings) {
    applyDetailImageSettings(settings.detailImageSettings);
  }

  // 8. Re-render listings grid to apply list/grid layout
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
      class="region-pill flex-shrink-0 flex items-center gap-1.5 h-8 sm:h-8.5 px-3 py-1 rounded-xl text-[11px] min-[380px]:text-[11.5px] sm:text-xs font-bold border transition-all select-none shadow-2xs ${
        state.selectedRegion === 'all' 
          ? 'bg-rose-900 text-white border-rose-900 ring-2 ring-rose-900/20' 
          : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
      }"
    >
      <span>🌟 Semua</span>
      <span class="px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black leading-none ${
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
        class="region-pill flex-shrink-0 flex items-center gap-1.5 h-8 sm:h-8.5 px-2.5 sm:px-3 py-1 rounded-xl text-[11px] min-[380px]:text-[11.5px] sm:text-xs font-bold border transition-all select-none shadow-2xs ${
          isSelected 
            ? 'bg-rose-900 text-white border-rose-900 ring-2 ring-rose-900/20' 
            : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
        }"
      >
        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${reg.accentColor}"></span>
        <span class="truncate">${reg.shortName}</span>
        <span class="px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black leading-none flex-shrink-0 ${
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

// Render Minimalist Categories Horizontal Scroll (6 Columns in 1 Row)
function renderCategoryPills() {
  const container = document.getElementById('category-pills-container');
  if (!container) return;

  let html = '';
  CATEGORIES.forEach((cat) => {
    const isSelected = state.selectedCategory === cat.id;
    const labelHtml = cat.displayHtml || cat.name;

    html += `
      <button 
        type="button"
        data-category="${cat.id}"
        class="category-pill flex flex-col items-center justify-start flex-shrink-0 w-[52px] min-[380px]:w-[58px] sm:w-[68px] group cursor-pointer text-center select-none"
        title="${cat.name}"
      >
        <div class="w-[44px] h-[44px] min-[380px]:w-[48px] min-[380px]:h-[48px] sm:w-[56px] sm:h-[56px] rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-200 ${
          isSelected 
            ? 'bg-rose-900 text-amber-300 shadow-sm ring-2 ring-rose-900/25 scale-105 border-2 border-rose-800' 
            : 'bg-[#edf2f9] text-rose-900 border border-[#e2e8f2]/90 shadow-2xs group-hover:bg-[#e4ebf5] group-hover:border-rose-300 group-hover:scale-105'
        }">
          <i data-lucide="${cat.icon}" class="w-5 h-5 min-[380px]:w-5.5 min-[380px]:h-5.5 sm:w-6.5 sm:h-6.5 transition-transform group-hover:scale-110"></i>
        </div>
        <span class="mt-1 px-0.5 text-[8px] min-[360px]:text-[8.5px] min-[380px]:text-[9.5px] sm:text-[10.5px] font-bold leading-[1.15] text-center tracking-tight transition-colors h-5.5 min-[380px]:h-6 sm:h-6.5 flex items-start justify-center overflow-hidden ${
          isSelected 
            ? 'text-rose-950 font-black' 
            : 'text-slate-700 group-hover:text-rose-900'
        }">
          ${labelHtml}
        </span>
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

// -------------------------------------------------------------
// 16:9 PEEK-A-BOO INFINITE LOOP BANNER CAROUSEL CONTROLLER
// -------------------------------------------------------------
function initHeroBannerCarousel() {
  const carousel = document.getElementById('hero-banner-carousel');
  const dotsContainer = document.getElementById('hero-carousel-dots');
  const prevBtn = document.getElementById('btn-carousel-prev');
  const nextBtn = document.getElementById('btn-carousel-next');
  if (!carousel || !dotsContainer) return;

  // Delegate create listing clicks
  carousel.querySelectorAll('.btn-trigger-create-listing, #btn-hero-create-listing').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openCreateListingModal();
    };
  });

  const originalSlides = Array.from(carousel.querySelectorAll('.hero-carousel-slide:not(.clone)'));
  if (originalSlides.length < 2) return;

  const totalOriginal = originalSlides.length;

  // Clean existing clones if any
  carousel.querySelectorAll('.hero-carousel-slide.clone').forEach(el => el.remove());

  // Clone first & last slides for infinite loop
  const firstClone = originalSlides[0].cloneNode(true);
  firstClone.classList.add('clone');
  firstClone.setAttribute('data-clone', 'first');

  const lastClone = originalSlides[totalOriginal - 1].cloneNode(true);
  lastClone.classList.add('clone');
  lastClone.setAttribute('data-clone', 'last');

  carousel.insertBefore(lastClone, originalSlides[0]);
  carousel.appendChild(firstClone);

  // Setup click listeners for clone buttons too
  [firstClone, lastClone].forEach(clone => {
    clone.querySelectorAll('.btn-trigger-create-listing, #btn-hero-create-listing').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openCreateListingModal();
      };
    });
  });

  const allSlides = Array.from(carousel.querySelectorAll('.hero-carousel-slide'));
  const dots = dotsContainer.querySelectorAll('.hero-dot');

  let currentIndex = 1; // Start on first real slide (index 1)
  let isTransitioning = false;
  let autoTimer = null;

  function getSlideOffset(slideIndex) {
    const slide = allSlides[slideIndex];
    if (!slide) return 0;
    return slide.offsetLeft - (carousel.clientWidth - slide.offsetWidth) / 2;
  }

  function scrollToSlide(slideIndex, smooth = true) {
    if (slideIndex < 0 || slideIndex >= allSlides.length) return;
    currentIndex = slideIndex;
    const targetLeft = getSlideOffset(slideIndex);
    
    if (!smooth) {
      carousel.style.scrollBehavior = 'auto';
      carousel.scrollLeft = targetLeft;
      carousel.style.scrollBehavior = 'smooth';
    } else {
      carousel.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
    updateDots();
  }

  function updateDots() {
    let realIdx = 0;
    if (currentIndex === 0) {
      realIdx = totalOriginal - 1;
    } else if (currentIndex === allSlides.length - 1) {
      realIdx = 0;
    } else {
      realIdx = currentIndex - 1;
    }

    dots.forEach((dot, idx) => {
      if (idx === realIdx) {
        dot.className = "hero-dot w-5 h-1.5 rounded-full bg-rose-900 transition-all cursor-pointer";
      } else {
        dot.className = "hero-dot w-2 h-1.5 rounded-full bg-slate-300 transition-all cursor-pointer";
      }
    });
  }

  // Initial centering on real Slide 1
  setTimeout(() => {
    scrollToSlide(1, false);
    if (window.lucide) window.lucide.createIcons();
  }, 100);

  // Seamless Infinite Looping on Scroll End / Settlement
  let scrollTimeout = null;
  carousel.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (isTransitioning) return;

      const currentScroll = carousel.scrollLeft;
      let closestIdx = 1;
      let minDiff = Infinity;
      allSlides.forEach((slide, idx) => {
        const diff = Math.abs(currentScroll - getSlideOffset(idx));
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      currentIndex = closestIdx;
      updateDots();

      // Looping teleportation
      if (closestIdx === 0) {
        // At cloned last slide -> silently jump to real last slide
        isTransitioning = true;
        scrollToSlide(totalOriginal, false);
        setTimeout(() => { isTransitioning = false; }, 60);
      } else if (closestIdx === allSlides.length - 1) {
        // At cloned first slide -> silently jump to real first slide
        isTransitioning = true;
        scrollToSlide(1, false);
        setTimeout(() => { isTransitioning = false; }, 60);
      }
    }, 120);
  }, { passive: true });

  // Smooth Next / Prev functions
  function nextSlide() {
    if (currentIndex >= allSlides.length - 1) {
      scrollToSlide(1, false);
      setTimeout(() => scrollToSlide(2, true), 30);
    } else {
      scrollToSlide(currentIndex + 1, true);
    }
  }

  function prevSlide() {
    if (currentIndex <= 0) {
      scrollToSlide(totalOriginal, false);
      setTimeout(() => scrollToSlide(totalOriginal - 1, true), 30);
    } else {
      scrollToSlide(currentIndex - 1, true);
    }
  }

  nextBtn?.addEventListener('click', () => {
    resetAutoTimer();
    nextSlide();
  });

  prevBtn?.addEventListener('click', () => {
    resetAutoTimer();
    prevSlide();
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      resetAutoTimer();
      const idx = parseInt(dot.getAttribute('data-slide-index') || '0', 10);
      scrollToSlide(idx + 1, true);
    });
  });

  function startAutoTimer() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      nextSlide();
    }, 5500);
  }

  function resetAutoTimer() {
    startAutoTimer();
  }

  carousel.addEventListener('touchstart', () => clearInterval(autoTimer), { passive: true });
  carousel.addEventListener('touchend', () => resetAutoTimer(), { passive: true });
  carousel.addEventListener('mouseenter', () => clearInterval(autoTimer));
  carousel.addEventListener('mouseleave', () => resetAutoTimer());

  startAutoTimer();
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

  // Apply 2-column grid layout (2 grid per baris)
  const gridColumns = (state.siteSettings && state.siteSettings.layoutColumns) || 'grid2';
  if (isListView) {
    grid.className = "flex flex-col gap-3 transition-all";
  } else {
    grid.className = "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4.5 transition-all";
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

    const isDemo = isDemoUser(item.seller?.id || item.seller) || Boolean(item.isDemo) || Boolean(item.id && item.id.startsWith('barkas-0'));
    // Tentukan metode pembayaran untuk kartu: 'cod' atau 'in_store' (bergantian/terpisah)
    const paymentType = item.paymentMethod || ((String(item.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (item.title || '').length) % 2 === 0 ? 'cod' : 'in_store');

    if (isListView) {
      // ---------------- LIST VIEW LAYOUT CARD ----------------
      cardsHtml += `
        <div 
          data-listing-id="${item.id}"
          class="product-card group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex flex-col sm:flex-row overflow-hidden relative cursor-pointer"
        >
          <!-- Image Section (Aspect 1:1 Persegi) -->
          <div class="relative w-full sm:w-44 aspect-square bg-slate-100 overflow-hidden flex-shrink-0">
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

            ${isDemo ? `
              <span class="absolute top-2 ${item.images && item.images.length > 1 ? 'left-20' : 'left-2'} px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-500 shadow-md flex items-center gap-1 z-10">
                <i data-lucide="tag" class="w-2.5 h-2.5"></i>
                <span>DEMO</span>
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
          <div class="p-4 flex-1 flex flex-col justify-between space-y-2.5">
            <div class="space-y-1.5">
              
              <!-- 1. Baris Harga (Hanya Nominal Harga Saja) -->
              <div>
                <span class="text-base sm:text-lg md:text-xl font-black text-rose-900 tracking-tight">${priceFormatted}</span>
              </div>

              <!-- 2. Status Tipe Harga & Metode Pembayaran (Di Baris Bawah Harga) -->
              <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                  ${item.negoType === 'pas' ? 'Nett' : 'Bisa Nego'}
                </span>

                ${paymentType === 'cod' ? `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                    <i data-lucide="handshake" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>COD</span>
                  </span>
                ` : `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200/90 shadow-2xs">
                    <i data-lucide="store" class="w-3.5 h-3.5 text-sky-600"></i>
                    <span>In Store</span>
                  </span>
                `}
              </div>

              <!-- 3. Judul Produk -->
              <h3 class="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-rose-900 transition-colors leading-snug pt-0.5">
                ${item.title}
              </h3>

              <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                ${item.description}
              </p>
            </div>

            <!-- 4. Nama Penjual & Keterangan Waktu + Action Buttons -->
            <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div class="flex items-center justify-between sm:justify-start gap-2 text-xs text-slate-500">
                <span class="font-bold text-slate-700 flex items-center gap-1.5">
                  <i data-lucide="user" class="w-3.5 h-3.5 text-slate-400"></i>
                  <span>${sellerName}</span>
                </span>
                <span class="text-slate-300">•</span>
                <span class="text-[11px] text-slate-400 font-medium">${timeAgoStr}</span>
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
      // ---------------- GRID VIEW LAYOUT CARD (Aspect 1:1 Persegi) ----------------
      cardsHtml += `
        <div 
          data-listing-id="${item.id}"
          class="product-card group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex flex-col overflow-hidden relative cursor-pointer"
        >
          <!-- Image Section (Aspect 1:1 Persegi) -->
          <div class="relative aspect-square bg-slate-100 overflow-hidden">
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

            ${isDemo ? `
              <span class="absolute top-2 ${item.images && item.images.length > 1 ? 'left-18 sm:left-20' : 'left-2'} px-1.5 sm:px-2 py-0.5 rounded-md text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-500 shadow-md flex items-center gap-0.5 z-10">
                <i data-lucide="tag" class="w-2.5 h-2.5"></i>
                <span>DEMO</span>
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

          <!-- Content Section (New Ordered Sequence) -->
          <div class="p-3 sm:p-3.5 space-y-2 flex-1 flex flex-col justify-between">
            
            <div class="space-y-1.5">
              <!-- 1. BARIS HARGA (Hanya Nominal Harga Saja) -->
              <div>
                <span class="text-sm sm:text-base md:text-[17px] font-black text-rose-900 leading-tight tracking-tight">${priceFormatted}</span>
              </div>

              <!-- 2. STATUS TIPE HARGA & METODE PEMBAYARAN (Di Baris Bawah Harga) -->
              <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                  ${item.negoType === 'pas' ? 'Nett' : 'Nego'}
                </span>

                ${paymentType === 'cod' ? `
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
                    <i data-lucide="handshake" class="w-3 h-3 text-emerald-600"></i>
                    <span>COD</span>
                  </span>
                ` : `
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200/90 shadow-2xs">
                    <i data-lucide="store" class="w-3 h-3 text-sky-600"></i>
                    <span>In Store</span>
                  </span>
                `}
              </div>

              <!-- 3. JUDUL PRODUK -->
              <h3 class="text-xs sm:text-[13px] font-bold text-slate-800 group-hover:text-rose-900 transition-colors line-clamp-2 leading-snug pt-0.5" title="${item.title}">
                ${item.title}
              </h3>
            </div>

            <!-- 4. NAMA PENJUAL & KETERANGAN WAKTU + TOMBOL AKSI -->
            <div class="pt-2 border-t border-slate-100/90 space-y-2">
              <div class="flex items-center justify-between text-[10.5px] sm:text-xs text-slate-500 gap-1.5">
                ${(() => {
                  const isVer = isSellerVerified(item.seller?.id || item.seller);
                  return `
                    <div class="flex items-center gap-1.5 truncate min-w-0" title="${isVer ? 'Penjual Terverifikasi: ' : 'Penjual: '}${sellerName}">
                      <i data-lucide="${isVer ? 'shield-check' : 'user'}" class="w-3.5 h-3.5 ${isVer ? 'text-emerald-600' : 'text-slate-400'} flex-shrink-0"></i>
                      <span class="${isVer ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'} truncate">${sellerName}</span>
                    </div>
                  `;
                })()}
                <span class="text-[9.5px] sm:text-[10.5px] font-medium text-slate-400 flex-shrink-0 whitespace-nowrap">${timeAgoStr}</span>
              </div>

              <div class="flex items-center gap-1.5 pt-0.5">
                ${(item.isSold || item.status === 'sold') ? `
                  <button 
                    disabled 
                    class="flex-1 flex items-center justify-center gap-1 bg-slate-200 text-slate-500 font-bold py-1.5 px-2 rounded-xl text-[10.5px] sm:text-xs cursor-not-allowed opacity-80"
                  >
                    <span>Terjual</span>
                  </button>
                ` : `
                  <a 
                    href="${waUrl}" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    data-action="whatsapp"
                    class="flex-1 flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 hover:border-emerald-600 font-bold py-1.5 px-2 rounded-xl text-[10.5px] sm:text-xs transition-colors shadow-2xs"
                    title="Chat Penjual via WhatsApp"
                  >
                    <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    <span>${chatWaText}</span>
                  </a>
                `}

                <button 
                  data-action="view-detail"
                  data-id="${item.id}"
                  class="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-2xs cursor-pointer"
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

// -------------------------------------------------------------
// SORT MODAL UI & RADIO SYNC (Clean Upright Font, Vibrant Accent)
// -------------------------------------------------------------
function updateSortRadioUI() {
  const currentSort = state.sortBy || 'newest';
  const sortLabels = {
    'newest': 'Terbaru',
    'price_low': 'Termurah',
    'price_high': 'Termahal',
    'views': 'Banyak dilihat'
  };

  const labelEl = document.getElementById('current-sort-label');
  if (labelEl) {
    labelEl.textContent = sortLabels[currentSort] || 'Terbaru';
  }

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = currentSort;
  }

  document.querySelectorAll('.sort-option-item').forEach((item) => {
    const val = item.getAttribute('data-sort-val');
    const isSelected = val === currentSort;
    const indicator = item.querySelector('.sort-radio-indicator');
    const dot = item.querySelector('.sort-radio-dot');

    if (isSelected) {
      item.classList.add('bg-rose-50/80', 'border-rose-200/90', 'shadow-2xs');
      item.classList.remove('border-transparent', 'hover:bg-slate-50');
      if (indicator) {
        indicator.className = 'sort-radio-indicator flex-shrink-0 w-4.5 h-4.5 rounded-full border-2 border-rose-900 bg-white flex items-center justify-center shadow-xs';
      }
      if (dot) {
        dot.className = 'sort-radio-dot w-2 h-2 rounded-full bg-rose-900';
      }
    } else {
      item.classList.remove('bg-rose-50/80', 'border-rose-200/90', 'shadow-2xs');
      item.classList.add('border-transparent', 'hover:bg-slate-50');
      if (indicator) {
        indicator.className = 'sort-radio-indicator flex-shrink-0 w-4.5 h-4.5 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center';
      }
      if (dot) {
        dot.className = 'sort-radio-dot w-2 h-2 rounded-full bg-transparent';
      }
    }
  });
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
// -------------------------------------------------------------
// DETAIL PRODUCT PHOTO RESIZER & ASPECT RATIO CONTROLLER (ADMIN)
// -------------------------------------------------------------
function applyDetailImageSettings(customSettings = null) {
  const settings = customSettings || (state.siteSettings && state.siteSettings.detailImageSettings) || (getSiteSettings().detailImageSettings) || {
    aspectRatio: 'aspect-square',
    maxWidth: 448,
    maxHeight: 448,
    objectFit: 'cover'
  };

  const wrapper = document.getElementById('detail-image-wrapper');
  const container = document.getElementById('detail-photo-container');
  const img = document.getElementById('detail-image');
  if (!container || !img) return;

  // Remove existing aspect ratio classes and add selected
  container.classList.remove('aspect-[4/5]', 'aspect-square', 'aspect-[4/3]', 'aspect-video', 'aspect-[3/4]');
  container.classList.add(settings.aspectRatio || 'aspect-square');

  if (wrapper && settings.maxWidth) {
    wrapper.style.maxWidth = `${settings.maxWidth}px`;
  }

  if (settings.maxHeight) {
    container.style.maxHeight = `${settings.maxHeight}px`;
  }

  if (settings.objectFit) {
    img.style.objectFit = settings.objectFit;
  }
}

function initDetailImageResizeControls() {
  const toolbar = document.getElementById('admin-detail-image-toolbar');
  if (!toolbar) return;

  const currentSettings = (state.siteSettings && state.siteSettings.detailImageSettings) || (getSiteSettings().detailImageSettings) || {
    aspectRatio: 'aspect-square',
    maxWidth: 448,
    maxHeight: 448,
    objectFit: 'cover'
  };

  const ratioLabel = document.getElementById('detail-aspect-ratio-label');
  const widthSlider = document.getElementById('detail-width-slider');
  const widthLabel = document.getElementById('detail-width-label');
  const heightSlider = document.getElementById('detail-height-slider');
  const heightLabel = document.getElementById('detail-height-label');
  const objectFitSelect = document.getElementById('detail-object-fit-select');
  const saveBtn = document.getElementById('btn-save-detail-photo-size');

  // Set initial control values
  if (widthSlider) {
    widthSlider.value = currentSettings.maxWidth || 448;
    if (widthLabel) widthLabel.textContent = `${widthSlider.value}px`;
  }
  if (heightSlider) {
    heightSlider.value = currentSettings.maxHeight || 448;
    if (heightLabel) heightLabel.textContent = `${heightSlider.value}px`;
  }
  if (objectFitSelect) {
    objectFitSelect.value = currentSettings.objectFit || 'cover';
  }

  const ratioDescriptions = {
    'aspect-square': '1:1 (Persegi Kotak)',
    'aspect-[4/5]': '4:5 (Portrait Standard)',
    'aspect-[4/3]': '4:3 (Standar Klasik)',
    'aspect-video': '16:9 (Widescreen Lebar)'
  };

  if (ratioLabel) {
    ratioLabel.textContent = ratioDescriptions[currentSettings.aspectRatio] || '1:1 (Persegi Kotak)';
  }

  // Highlight active aspect ratio button
  toolbar.querySelectorAll('.btn-aspect-ratio').forEach((btn) => {
    const r = btn.getAttribute('data-ratio');
    if (r === currentSettings.aspectRatio) {
      btn.className = "btn-aspect-ratio py-1.5 px-2 rounded-xl bg-rose-900 text-white border border-rose-700 font-bold text-[11px] shadow-sm cursor-pointer";
    } else {
      btn.className = "btn-aspect-ratio py-1.5 px-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all font-bold text-[11px] cursor-pointer";
    }

    btn.onclick = (e) => {
      e.preventDefault();
      const chosenRatio = btn.getAttribute('data-ratio');
      currentSettings.aspectRatio = chosenRatio;
      
      toolbar.querySelectorAll('.btn-aspect-ratio').forEach((b) => {
        b.className = "btn-aspect-ratio py-1.5 px-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all font-bold text-[11px] cursor-pointer";
      });
      btn.className = "btn-aspect-ratio py-1.5 px-2 rounded-xl bg-rose-900 text-white border border-rose-700 font-bold text-[11px] shadow-sm cursor-pointer";
      if (ratioLabel) ratioLabel.textContent = ratioDescriptions[chosenRatio] || chosenRatio;

      applyDetailImageSettings(currentSettings);
    };
  });

  // Width Slider Listener (with proportional aspect-locked scaling)
  if (widthSlider) {
    widthSlider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      currentSettings.maxWidth = val;
      if (widthLabel) widthLabel.textContent = `${val}px`;

      // Auto-calculate proportional height so image NEVER stretches ("Anti-Gepeng")
      let ratioVal = 4 / 5;
      if (currentSettings.aspectRatio === 'aspect-square') ratioVal = 1 / 1;
      else if (currentSettings.aspectRatio === 'aspect-[4/3]') ratioVal = 4 / 3;
      else if (currentSettings.aspectRatio === 'aspect-video') ratioVal = 16 / 9;

      const proportionalHeight = Math.round(val / ratioVal);
      if (heightSlider && proportionalHeight <= parseInt(heightSlider.max, 10) && proportionalHeight >= parseInt(heightSlider.min, 10)) {
        heightSlider.value = proportionalHeight;
        currentSettings.maxHeight = proportionalHeight;
        if (heightLabel) heightLabel.textContent = `${proportionalHeight}px`;
      }

      applyDetailImageSettings(currentSettings);
    };
  }

  // Height Slider Listener
  if (heightSlider) {
    heightSlider.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      currentSettings.maxHeight = val;
      if (heightLabel) heightLabel.textContent = `${val}px`;
      applyDetailImageSettings(currentSettings);
    };
  }

  // Object-Fit Select Listener
  if (objectFitSelect) {
    objectFitSelect.onchange = (e) => {
      currentSettings.objectFit = e.target.value;
      applyDetailImageSettings(currentSettings);
    };
  }

  // Save Settings to Database
  if (saveBtn) {
    saveBtn.onclick = (e) => {
      e.preventDefault();
      if (!state.siteSettings) state.siteSettings = getSiteSettings();
      state.siteSettings.detailImageSettings = { ...currentSettings };
      saveSiteSettings(state.siteSettings);
      broadcastStudioSync();

      const originalHtml = saveBtn.innerHTML;
      saveBtn.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5 text-white"></i><span>Tersimpan!</span>`;
      saveBtn.classList.remove('from-emerald-600', 'to-teal-600');
      saveBtn.classList.add('from-emerald-500', 'to-green-500');
      if (window.lucide) window.lucide.createIcons();

      setTimeout(() => {
        saveBtn.innerHTML = originalHtml;
        saveBtn.classList.remove('from-emerald-500', 'to-green-500');
        saveBtn.classList.add('from-emerald-600', 'to-teal-600');
        if (window.lucide) window.lucide.createIcons();
      }, 2000);

      showToast("💾 Ukuran & aspek rasio foto produk berhasil disimpan secara permanen ke database!", "success");
    };
  }
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

  // Set Details & Multi-Photo Gallery
  const mainDetailImg = document.getElementById('detail-image');
  const thumbContainer = document.getElementById('detail-thumbnails-container');
  mainDetailImg.src = listing.images[0];

  // Admin Photo Resizer & Aspect Ratio Toolbar Check
  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
  const adminToolbar = document.getElementById('admin-detail-image-toolbar');
  if (adminToolbar) {
    if (isAdmin) {
      adminToolbar.classList.remove('hidden');
      initDetailImageResizeControls();
    } else {
      adminToolbar.classList.add('hidden');
    }
  }

  // Apply Configured Image Size & Aspect Ratio
  applyDetailImageSettings();

  if (thumbContainer) {
    if (listing.images && listing.images.length > 1) {
      thumbContainer.classList.remove('hidden');
      let thumbsHtml = '';
      listing.images.forEach((imgUrl, idx) => {
        thumbsHtml += `
          <button 
            type="button" 
            data-img-index="${idx}"
            class="detail-thumb-btn w-14 sm:w-16 aspect-square rounded-xl overflow-hidden border-2 transition-all ${idx === 0 ? 'border-rose-800 ring-2 ring-rose-300 scale-105' : 'border-slate-300 opacity-70 hover:opacity-100'}"
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
              b.className = "detail-thumb-btn w-14 sm:w-16 aspect-square rounded-xl overflow-hidden border-2 border-rose-800 ring-2 ring-rose-300 scale-105 transition-all";
            } else {
              b.className = "detail-thumb-btn w-14 sm:w-16 aspect-square rounded-xl overflow-hidden border-2 border-slate-300 opacity-70 hover:opacity-100 transition-all";
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
  
  // 0. Metode Transaksi Badge (Lencana Di Luar & Tepat Di Atas Gambar Produk)
  const paymentBadge = document.getElementById('detail-payment-method-badge');
  if (paymentBadge) {
    const pMethod = listing.paymentMethod || ((String(listing.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (listing.title || '').length) % 2 === 0 ? 'cod' : 'in_store');
    if (pMethod === 'cod') {
      paymentBadge.innerHTML = `<i data-lucide="handshake" class="w-3.5 h-3.5 text-emerald-700"></i><span>COD</span>`;
      paymentBadge.className = 'px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-300 shadow-2xs flex items-center gap-1.5';
    } else {
      paymentBadge.innerHTML = `<i data-lucide="store" class="w-3.5 h-3.5 text-sky-700"></i><span>In Store</span>`;
      paymentBadge.className = 'px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold bg-sky-100/90 text-sky-800 border border-sky-300 shadow-2xs flex items-center gap-1.5';
    }
  }

  // 1. Kategori Badge
  const cat = CATEGORIES.find((c) => c.id === listing.category);
  const catBadge = document.getElementById('detail-category-badge');
  if (catBadge) {
    catBadge.innerHTML = `<i data-lucide="tag" class="w-3 h-3 text-rose-800"></i><span>${cat ? cat.name : 'Barkas'}</span>`;
  }
  
  // 2. Lokasi Badge (Tanpa Kurung, Pemisah Titik Kecil)
  const regBadge = document.getElementById('detail-region-badge');
  if (regBadge) {
    const shortRegName = region ? (region.shortName || region.name.replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim()) : (listing.regionId || 'Solo');
    const locSnippet = listing.district ? `${shortRegName} • ${listing.district}` : shortRegName;
    regBadge.innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 text-rose-700"></i><span>${locSnippet}</span>`;
  }
  
  // 3. Status Badge (Format Huruf Standar: Tersedia / Terjual / Booked)
  const statusBadge = document.getElementById('detail-status-badge');
  const itemStatus = listing.status || (listing.isSold ? 'sold' : 'available');
  if (statusBadge) {
    if (itemStatus === 'sold' || listing.isSold) {
      statusBadge.innerHTML = `<i data-lucide="x-circle" class="w-3 h-3 text-rose-600"></i><span>Terjual</span>`;
      statusBadge.className = 'px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs flex items-center gap-1';
    } else if (itemStatus === 'booked') {
      statusBadge.innerHTML = `<i data-lucide="clock" class="w-3 h-3 text-amber-600"></i><span>Booked</span>`;
      statusBadge.className = 'px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs flex items-center gap-1';
    } else {
      statusBadge.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3 text-emerald-600"></i><span>Tersedia</span>`;
      statusBadge.className = 'px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs flex items-center gap-1';
    }
  }

  // 4. Kondisi Badge
  const cond = CONDITIONS.find((c) => c.id === listing.condition);
  const condBadge = document.getElementById('detail-condition-badge');
  if (condBadge) {
    const condLabel = cond ? cond.label.split('(')[0].trim() : 'Bekas';
    condBadge.innerHTML = `<i data-lucide="check-circle" class="w-3 h-3 text-blue-600"></i><span>${condLabel}</span>`;
  }
  
  // 5. Tipe Harga Badge
  const negoBadge = document.getElementById('detail-nego-badge');
  const negoObj = NEGO_TYPES.find((n) => n.id === listing.negoType);
  if (negoBadge) {
    const negoLabel = listing.negoType === 'pas' ? 'Nett' : (negoObj ? (negoObj.short || negoObj.label.split('(')[0].trim()) : 'Bisa Nego');
    negoBadge.innerHTML = `<i data-lucide="badge-percent" class="w-3 h-3 text-amber-700"></i><span>${negoLabel}</span>`;
  }

  document.getElementById('detail-time-ago').querySelector('span').textContent = timeAgo(listing.createdAt);
  
  const viewsEl = document.getElementById('detail-views-count');
  if (viewsEl) viewsEl.textContent = `${(listing.views || 0) + 1} kali dilihat`;

  // Location and COD
  const locEl = document.getElementById('detail-location-text');
  if (locEl) {
    const locText = listing.district ? `${regionName}, Kec. ${listing.district}` : regionName;
    locEl.textContent = locText;
  }
  
  const codEl = document.getElementById('detail-cod-text');
  const codBox = document.getElementById('detail-cod-container');
  if (codEl) {
    if (listing.codPoint && listing.codPoint.trim()) {
      codEl.textContent = listing.codPoint;
      if (codBox) codBox.classList.remove('hidden');
    } else {
      codEl.textContent = `Area ${listing.district ? listing.district + ', ' : ''}${regionName} (Bisa janjian via WhatsApp)`;
      if (codBox) codBox.classList.remove('hidden');
    }
  }
  
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
  const isDemo = isDemoUser(sellerId || listing.seller) || Boolean(listing.isDemo) || Boolean(listing.id && listing.id.startsWith('barkas-0'));

  if (sellerBadgeText) {
    if (isDemo) {
      sellerBadgeText.textContent = `AKUN DEMO / PERAGA`;
      const badgeParent = sellerBadgeText.parentElement;
      if (badgeParent) {
        badgeParent.className = "inline-flex items-center gap-1 bg-amber-400 text-slate-950 border border-amber-500 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs";
      }
    } else if (isSellerVer) {
      sellerBadgeText.textContent = `Toko Lokal ${region ? region.shortName : 'Solo Raya'} Terverifikasi`;
      const badgeParent = sellerBadgeText.parentElement;
      if (badgeParent) {
        badgeParent.className = "inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      }
    } else {
      sellerBadgeText.textContent = `Toko Member ${region ? region.shortName : 'Solo Raya'}`;
      const badgeParent = sellerBadgeText.parentElement;
      if (badgeParent) {
        badgeParent.className = "inline-flex items-center gap-1 bg-slate-700 text-slate-300 border border-slate-600 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      }
    }
  }

  // Photo Frame Demo Badge
  const existingDemoBadge = document.getElementById('detail-photo-demo-badge');
  if (isDemo) {
    if (!existingDemoBadge) {
      const demoBadge = document.createElement('div');
      demoBadge.id = 'detail-photo-demo-badge';
      demoBadge.className = 'absolute top-3 left-3 z-10 px-2.5 py-1 rounded-xl text-xs font-black bg-amber-400 text-slate-950 border border-amber-500 shadow-md flex items-center gap-1.5';
      demoBadge.innerHTML = '<i data-lucide="tag" class="w-3.5 h-3.5"></i><span>AKUN DEMO / PERAGA</span>';
      document.getElementById('detail-photo-container')?.appendChild(demoBadge);
    }
  } else {
    existingDemoBadge?.remove();
  }

  if (sellerJoinedText) {
    const rawDate = sellerUser?.createdAt || listing.seller?.createdAt || listing.createdAt;
    const d = new Date(rawDate);
    const dateStr = !isNaN(d) ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Agt 2026';
    sellerJoinedText.textContent = `Bergabung: ${dateStr}`;
  }
  
  sellerAvatar.src = listing.seller?.avatar || sellerUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(listing.seller?.displayName || 'solo')}`;
  sellerName.textContent = sellerUser?.storeName || listing.seller?.displayName || listing.seller?.googleName || 'Penjual Terverifikasi';
  
  const shortReg = region ? (region.shortName || region.name.replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim()) : (listing.regionId || 'Solo');
  const capReg = shortReg.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const distClean = (listing.district || sellerUser?.district || '').trim().replace(/\.+$/, '').replace(/^Kec\.?\s*/i, '');
  const capDist = distClean ? distClean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
  sellerRegion.textContent = capDist ? `${capReg} • ${capDist}` : capReg;

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
// USER AUTH & PASSWORD RESET CONTROLLERS (NOTIFIKASI ERROR TEPAT DI ATAS TOMBOL & BAWAH INPUT)
// -------------------------------------------------------------
function showLoginError(message) {
  // 1. Tampilkan notifikasi error tepat di atas tombol submit
  const alertBox = document.getElementById('login-error-alert');
  const textEl = document.getElementById('login-error-text');
  if (alertBox && textEl) {
    textEl.textContent = message;
    alertBox.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 2. Tampilkan teks error langsung di bawah kolom password
  const fieldError = document.getElementById('login-field-error-msg');
  const fieldText = document.getElementById('login-field-error-text');
  if (fieldError && fieldText) {
    fieldText.textContent = message;
    fieldError.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // 3. Highlight input fields dengan warna merah
  const idInput = document.getElementById('login-input-identifier');
  const passInput = document.getElementById('login-input-password');
  if (idInput) idInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-400', 'bg-rose-50/40');
  if (passInput) passInput.classList.add('border-rose-500', 'ring-2', 'ring-rose-400', 'bg-rose-50/40');

  showToast(message, "error", 6000);
}

function showRegisterError(message) {
  // 1. Tampilkan notifikasi error tepat di atas tombol daftar
  const alertBox = document.getElementById('register-error-alert');
  const textEl = document.getElementById('register-error-text');
  if (alertBox && textEl) {
    textEl.textContent = message;
    alertBox.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 2. Tampilkan teks error di bawah kolom konfirmasi password
  const fieldError = document.getElementById('reg-field-error-msg');
  const fieldText = document.getElementById('reg-field-error-text');
  if (fieldError && fieldText) {
    fieldText.textContent = message;
    fieldError.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  showToast(message, "error", 6000);
}

function showForgotError(message) {
  const alertBox = document.getElementById('forgot-error-alert');
  const textEl = document.getElementById('forgot-error-text');
  if (alertBox && textEl) {
    textEl.textContent = message;
    alertBox.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  showToast(message, "error", 6000);
}

function showForgotConfirmError(message) {
  const alertBox = document.getElementById('forgot-confirm-error-alert');
  const textEl = document.getElementById('forgot-confirm-error-text');
  if (alertBox && textEl) {
    textEl.textContent = message;
    alertBox.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  showToast(message, "error", 6000);
}

function clearAllAuthErrors() {
  document.getElementById('login-error-alert')?.classList.add('hidden');
  document.getElementById('register-error-alert')?.classList.add('hidden');
  document.getElementById('forgot-error-alert')?.classList.add('hidden');
  document.getElementById('forgot-confirm-error-alert')?.classList.add('hidden');
  document.getElementById('login-field-error-msg')?.classList.add('hidden');
  document.getElementById('reg-field-error-msg')?.classList.add('hidden');

  // Remove red highlights from inputs
  document.querySelectorAll('#modal-user-auth input').forEach((inp) => {
    inp.classList.remove('border-rose-500', 'ring-2', 'ring-rose-400', 'bg-rose-50/40');
  });
}

function openUserAuthModal(tab = 'login', noticeMsg = null) {
  clearAllAuthErrors();
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
  clearAllAuthErrors();
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
  selectFormCategory('elektronik');
  selectFormCondition('good');
  selectFormNego('nego_alus');
  selectFormPaymentMethod('cod');
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
  selectFormCategory('elektronik');
  selectFormCondition('good');
  selectFormNego('nego_alus');
  selectFormPaymentMethod('cod');
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
  state.uploadedImages.forEach((imgUrl, idx) => {
    html += `
      <div class="relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border-2 border-rose-200 shadow-sm group">
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
  if (locEl) {
    const userRegObj = getRegionById(user.region);
    let regName = userRegObj ? (userRegObj.shortName || userRegObj.name.replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim()) : (user.region || 'Solo');
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
    const dateStr = !isNaN(createdDate) ? createdDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '01 Agt 2026';
    createdEl.textContent = `Bergabung: ${dateStr}`;
  }

  // Highlight: Jumlah Barang Terjual di Profil Toko
  const soldCountText = document.getElementById('my-store-sold-count-text');
  if (soldCountText) soldCountText.textContent = `${stats.soldCount} Terjual`;

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
  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
  const sellerUser = getUserById(sellerId);
  const sellerListings = getListingsBySellerId(sellerId);
  const sellerReviews = getSellerReviews(sellerId, isAdmin);
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
  
  const rawReg = sellerUser?.region || (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.region : null);
  const sellerRegObj = getRegionById(rawReg);
  let regionName = sellerRegObj ? (sellerRegObj.shortName || sellerRegObj.name.replace(/Kota|Kab\./gi, '').replace(/\(.*?\)/g, '').trim()) : (rawReg || 'Solo');
  regionName = regionName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  const distRaw = (sellerUser?.district || (typeof sellerIdOrObj === 'object' ? sellerIdOrObj?.district : null) || '').trim().replace(/\.+$/, '').replace(/^Kec\.?\s*/i, '');
  const districtName = distRaw ? distRaw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
  const bioText = sellerUser?.bio || `Pusat jual beli barang bekas amanah dan terpercaya di area ${regionName}. Pantau cocok bayar!`;

  const verCheck = checkSellerVerification(sellerId);
  const isDemo = isDemoUser(sellerId || sellerUser || sellerIdOrObj);

  if (avatarEl) avatarEl.src = avatarUrl;
  if (nameEl) nameEl.textContent = displayName;
  if (badgeTextEl) {
    if (isDemo) {
      badgeTextEl.textContent = `AKUN DEMO / PERAGA (${regionName})`;
      const badgeParent = badgeTextEl.parentElement;
      if (badgeParent) {
        badgeParent.className = "inline-flex items-center gap-1 bg-amber-400 text-slate-950 border border-amber-500 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-xs";
      }
    } else if (verCheck.isVerified) {
      badgeTextEl.textContent = `Toko Lokal ${regionName} Terverifikasi`;
      const badgeParent = badgeTextEl.parentElement;
      if (badgeParent) {
        badgeParent.className = "inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full";
      }
    } else {
      badgeTextEl.textContent = `Toko Member ${regionName}`;
      const badgeParent = badgeTextEl.parentElement;
      if (badgeParent) {
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
        <div class="relative aspect-square bg-slate-200 overflow-hidden">
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
  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';

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

    const isHidden = !!r.isHidden;
    const cardBgClass = isHidden 
      ? 'bg-purple-50/90 border-purple-300 ring-1 ring-purple-400/40 opacity-90' 
      : 'bg-slate-50 border-slate-200/80';

    html += `
      <div class="p-3.5 ${cardBgClass} rounded-2xl border space-y-2.5 transition-all">
        ${isHidden ? `
          <div class="flex items-center justify-between p-1.5 px-2.5 bg-purple-950 text-purple-200 border border-purple-800 rounded-xl text-[10px] font-extrabold shadow-2xs">
            <span class="flex items-center gap-1.5">
              <i data-lucide="eye-off" class="w-3 h-3 text-purple-300"></i>
              <span>ULASAN DISEMBUNYIKAN (Hanya Admin yang Melihat)</span>
            </span>
            <span class="text-purple-300 bg-purple-900 px-1.5 py-0.5 rounded text-[9.5px]">Spam / Fake</span>
          </div>
        ` : ''}

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

        ${isAdmin ? `
          <div class="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap bg-slate-100/90 -mx-3.5 -mb-3.5 p-2.5 rounded-b-2xl">
            <div class="flex items-center gap-1 text-[10.5px] font-black text-rose-950">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-rose-800"></i>
              <span>Moderasi Ulasan (Admin):</span>
            </div>
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                data-action="admin-toggle-hide-review" 
                data-review-id="${r.id}" 
                data-seller-id="${sellerId}"
                class="px-2.5 py-1 rounded-lg ${isHidden ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'} text-[11px] font-extrabold transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                title="${isHidden ? 'Tampilkan kembali ulasan ini ke publik' : 'Sembunyikan ulasan mencurigakan ini dari publik'}"
              >
                <i data-lucide="${isHidden ? 'eye' : 'eye-off'}" class="w-3.5 h-3.5"></i>
                <span>${isHidden ? 'Buka Sembunyi' : 'Sembunyikan'}</span>
              </button>
              <button 
                type="button" 
                data-action="admin-delete-review" 
                data-review-id="${r.id}" 
                data-seller-id="${sellerId}"
                class="px-2.5 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-[11px] font-extrabold transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                title="Hapus ulasan spam/mencurigakan ini secara permanen"
              >
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  });

  listContainer.innerHTML = html;

  if (isAdmin) {
    listContainer.querySelectorAll('[data-action="admin-toggle-hide-review"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const revId = btn.getAttribute('data-review-id');
        const sId = btn.getAttribute('data-seller-id');
        try {
          const updated = toggleHideSellerReview(revId);
          if (updated) {
            showToast(updated.isHidden ? "🛡️ Ulasan berhasil disembunyikan dari publik secara real-time." : "👁️ Ulasan ditampilkan kembali ke publik secara real-time.", "info");
            const updatedReviews = getSellerReviews(sId, true);
            const updatedStats = getSellerRatingStats(sId);
            renderSellerProfileReviews(sId, updatedReviews, updatedStats);
          }
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

    listContainer.querySelectorAll('[data-action="admin-delete-review"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const revId = btn.getAttribute('data-review-id');
        const sId = btn.getAttribute('data-seller-id');
        if (confirm("Apakah Anda yakin ingin menghapus ulasan ini secara permanen dari database? Tindakan ini tidak dapat dibatalkan.")) {
          try {
            const ok = deleteSellerReview(revId);
            if (ok) {
              showToast("🗑️ Ulasan spam/mencurigakan berhasil dihapus permanen.", "success");
              const updatedReviews = getSellerReviews(sId, true);
              const updatedStats = getSellerRatingStats(sId);
              renderSellerProfileReviews(sId, updatedReviews, updatedStats);
            }
          } catch (err) {
            showToast(err.message, "error");
          }
        }
      });
    });
  }

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
// APP & DEVELOPER REVIEWS & FEEDBACK CONTROLLER
// -------------------------------------------------------------
function openAppReviewsModal() {
  const modal = document.getElementById('modal-app-reviews');
  if (!modal) return;

  const currentUser = state.currentUser || getCurrentUser();
  const authReqBox = document.getElementById('app-review-auth-required');
  const reviewForm = document.getElementById('form-submit-app-review');
  const userNameEl = document.getElementById('app-review-user-name');
  const userAvatarEl = document.getElementById('app-review-user-avatar');

  if (currentUser) {
    authReqBox?.classList.add('hidden');
    reviewForm?.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = `${currentUser.displayName || currentUser.name} (${currentUser.region ? currentUser.region.toUpperCase() : 'Solo Raya'})`;
    if (userAvatarEl) userAvatarEl.src = currentUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80";
  } else {
    authReqBox?.classList.remove('hidden');
    reviewForm?.classList.add('hidden');
  }

  setAppReviewRating(5);
  renderAppReviews();
  openModal('modal-app-reviews');
  if (window.lucide) window.lucide.createIcons();
}

function setAppReviewRating(rating) {
  const hiddenInput = document.getElementById('app-input-rating-val');
  const label = document.getElementById('app-star-rating-label');
  const starContainer = document.getElementById('app-star-rating-selector');
  if (hiddenInput) hiddenInput.value = rating;

  const labels = {
    1: '⭐ (Perlu Banyak Perbaikan)',
    2: '⭐⭐ (Kurang Puas)',
    3: '⭐⭐⭐ (Cukup Baik)',
    4: '⭐⭐⭐⭐ (Bagus & Bermanfaat)',
    5: '⭐⭐⭐⭐⭐ (Sangat Puas & Membantu)'
  };
  if (label) label.textContent = labels[rating] || '⭐⭐⭐⭐⭐ (Sangat Puas & Membantu)';

  if (starContainer) {
    starContainer.querySelectorAll('.star-btn').forEach((btn) => {
      const starVal = parseInt(btn.getAttribute('data-star'), 10);
      const icon = btn.querySelector('svg, i');
      if (icon) {
        if (starVal <= rating) {
          icon.classList.add('fill-amber-400', 'text-amber-400');
          icon.classList.remove('fill-none', 'text-slate-300');
        } else {
          icon.classList.remove('fill-amber-400', 'text-amber-400');
          icon.classList.add('fill-none', 'text-slate-300');
        }
      }
    });
  }
}

function renderAppReviews() {
  const container = document.getElementById('app-reviews-list-container');
  const avgScoreEl = document.getElementById('app-rating-avg-score');
  const countTextEl = document.getElementById('app-rating-count-text');
  const totalBadge = document.getElementById('app-reviews-total-badge');
  if (!container) return;

  const isAdmin = sessionStorage.getItem('pusat_barkas_admin_auth') === 'true';
  const reviews = getAppReviews(isAdmin);
  const stats = getAppRatingStats();

  if (avgScoreEl) avgScoreEl.textContent = stats.totalReviews > 0 ? stats.averageRating.toFixed(1) : '5.0';
  if (countTextEl) countTextEl.textContent = `Berdasarkan ${stats.totalReviews} ulasan komunitas`;
  if (totalBadge) totalBadge.textContent = `${stats.totalReviews} Ulasan`;

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2">
        <i data-lucide="message-square" class="w-8 h-8 mx-auto text-slate-300"></i>
        <p class="text-xs font-semibold text-slate-600">Belum ada ulasan komunitas.</p>
        <p class="text-[11px]">Jadilah yang pertama memberikan penilaian dan saran untuk aplikasi ini!</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let html = '';
  reviews.forEach((rev) => {
    const isHidden = Boolean(rev.isHidden);
    let starsHtml = '';
    for (let s = 1; s <= 5; s++) {
      starsHtml += `<i data-lucide="star" class="w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}"></i>`;
    }

    const timeStr = timeAgo(rev.createdAt);

    const isDemoReview = rev.id?.startsWith('app-rev-') || isDemoUser(rev.userId);

    html += `
      <div class="p-4 bg-white rounded-2xl border ${isHidden ? 'border-amber-300 bg-amber-50/50 opacity-75' : 'border-slate-200'} shadow-xs space-y-2.5 transition-all">
        <div class="flex items-start justify-between gap-2.5">
          <div class="flex items-center gap-2.5 min-w-0">
            <img src="${rev.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}" alt="${rev.userName}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 flex-shrink-0">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-bold text-slate-900 truncate">${rev.userName}</span>
                <span class="text-[9.5px] font-extrabold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">${rev.userRole || 'Warga'}</span>
                ${isDemoReview ? '<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 border border-amber-300">AKUN DEMO</span>' : ''}
                ${isHidden ? '<span class="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-600 text-white">DISEMBUNYIKAN (ADMIN)</span>' : ''}
              </div>
              <div class="flex items-center gap-2 text-[10px] text-slate-400">
                <span>${timeStr}</span>
                <span>•</span>
                <span class="text-rose-900 font-semibold">${rev.category || 'Pengalaman Pengguna'}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-0.5 flex-shrink-0">
            ${starsHtml}
          </div>
        </div>

        <p class="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
          ${rev.comment}
        </p>

        ${isAdmin ? `
          <div class="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-xs font-bold">
            <button 
              type="button" 
              data-admin-toggle-app-review="${rev.id}"
              class="px-2.5 py-1 rounded-lg ${isHidden ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} text-[11px] hover:scale-105 transition-all cursor-pointer"
            >
              ${isHidden ? 'Tampilkan Publik' : 'Sembunyikan'}
            </button>
            <button 
              type="button" 
              data-admin-delete-app-review="${rev.id}"
              class="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-[11px] hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
            >
              Hapus
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = html;

  if (isAdmin) {
    container.querySelectorAll('[data-admin-toggle-app-review]').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-admin-toggle-app-review');
        toggleHideAppReview(id);
        renderAppReviews();
        showToast("Status visibilitas ulasan berhasil diperbarui", "info");
      };
    });
    container.querySelectorAll('[data-admin-delete-app-review]').forEach((btn) => {
      btn.onclick = () => {
        if (confirm("Apakah Anda yakin ingin menghapus ulasan ini?")) {
          const id = btn.getAttribute('data-admin-delete-app-review');
          deleteAppReview(id);
          renderAppReviews();
          showToast("Ulasan berhasil dihapus", "success");
        }
      };
    });
  }

  if (window.lucide) window.lucide.createIcons();
}

function initAppReviews() {
  const starContainer = document.getElementById('app-star-rating-selector');
  if (starContainer) {
    starContainer.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const rating = parseInt(btn.getAttribute('data-star'), 10);
        setAppReviewRating(rating);
      });
    });
  }

  document.getElementById('btn-login-for-app-review')?.addEventListener('click', () => {
    closeModal('modal-app-reviews');
    openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan aplikasi.');
  });

  document.getElementById('btn-scroll-to-write-review')?.addEventListener('click', () => {
    const currentUser = state.currentUser || getCurrentUser();
    if (!currentUser) {
      closeModal('modal-app-reviews');
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan aplikasi.');
      return;
    }
    const target = document.getElementById('section-write-app-review');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('app-review-comment-input')?.focus();
    }
  });

  const form = document.getElementById('form-submit-app-review');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const currentUser = state.currentUser || getCurrentUser();
    if (!currentUser) {
      closeModal('modal-app-reviews');
      openUserAuthModal('login', 'Silakan masuk atau daftar akun terlebih dahulu untuk memberikan ulasan aplikasi.');
      return;
    }

    const rating = parseInt(document.getElementById('app-input-rating-val')?.value || '5', 10);
    const category = document.getElementById('app-review-category-select')?.value || 'Pengalaman Pengguna';
    const comment = document.getElementById('app-review-comment-input')?.value?.trim();

    if (!comment) {
      showToast("Silakan tuliskan ulasan atau masukan Anda.", "warning");
      return;
    }

    try {
      addAppReview({
        rating,
        category,
        comment
      });

      const commentEl = document.getElementById('app-review-comment-input');
      if (commentEl) commentEl.value = '';

      renderAppReviews();
      showToast("Terima kasih! Ulasan & masukan Anda berhasil dikirim.", "success");
    } catch (err) {
      showToast(err.message || "Gagal mengirim ulasan", "error");
    }
  });

  window.addEventListener('appReviewsChanged', () => {
    renderAppReviews();
  });
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

  // -------------------------------------------------------------
  // MODERN SORT MODAL / BOTTOM SHEET HANDLERS
  // -------------------------------------------------------------
  document.getElementById('btn-open-sort-modal')?.addEventListener('click', () => {
    updateSortRadioUI();
    openModal('modal-sort');
  });

  document.querySelectorAll('.sort-option-item').forEach((item) => {
    item.addEventListener('click', () => {
      const val = item.getAttribute('data-sort-val');
      if (val) {
        state.sortBy = val;
        updateSortRadioUI();
        renderListings();
        setTimeout(() => {
          closeModal('modal-sort');
        }, 120);
      }
    });
  });

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    updateSortRadioUI();
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

  // Category & Condition Popover Picker Modal Triggers
  document.getElementById('btn-open-category-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-category-picker');
  });

  document.getElementById('btn-open-condition-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-condition-picker');
  });

  // Category Item Selection
  document.querySelectorAll('.picker-item-category').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormCategory(id);
        closeModal('modal-category-picker');
      }
    });
  });

  // Condition Item Selection
  document.querySelectorAll('.picker-item-condition').forEach((btn) => {
    btn.addEventListener('click', () => {
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
    openModal('modal-nego-picker');
  });

  document.getElementById('btn-open-payment-method-picker')?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal('modal-payment-method-picker');
  });

  // Nego Item Selection
  document.querySelectorAll('.picker-item-nego').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormNego(id);
        closeModal('modal-nego-picker');
      }
    });
  });

  // Payment Method Item Selection
  document.querySelectorAll('.picker-item-payment-method').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      if (id) {
        selectFormPaymentMethod(id);
        closeModal('modal-payment-method-picker');
      }
    });
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

  // Fitur Ulasan & Masukan Pengembang
  document.getElementById('nav-btn-reviews')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAppReviewsModal();
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

  // File Upload Handler (Enforces Strict 1:1 Square Aspect Ratio for all uploads)
  const imageFileInput = document.getElementById('form-image-file');

  imageFileInput?.addEventListener('change', async (e) => {
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

    for (const file of filesToRead) {
      try {
        const squareDataUrl = await processSquareImage(file);
        state.uploadedImages.push(squareDataUrl);
        loadedCount++;
      } catch (err) {
        showToast(err.message || "Gagal memproses foto", "error");
      }
    }

    if (loadedCount > 0) {
      renderFormImagePreviews();
      imageFileInput.value = '';
      showToast(`${loadedCount} foto berhasil diproses & divalidasi ke Rasio 1:1 (Persegi)!`, "success");
    }
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
      paymentMethod: formData.get('paymentMethod') || 'cod',
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
        showToast("Iklan berhasil diperbarui dengan foto rasio 1:1 (Persegi)!", "success");
        setTimeout(() => openProductDetail(updated.id), 400);
      } else {
        const saved = saveListing(listingPayload);
        closeModal('modal-create-listing');
        renderRegionPills();
        renderCategoryPills();
        renderListings();
        renderMyListings();
        showToast("Iklan Anda berhasil dipasang dengan foto rasio 1:1 (Persegi) dan tayang di Solo Raya!", "success");
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

  // Close Auth Error Banners & Floating Overlay Buttons
  document.getElementById('btn-close-floating-error')?.addEventListener('click', clearAllAuthErrors);
  document.querySelectorAll('.btn-dismiss-error').forEach((btn) => {
    btn.addEventListener('click', clearAllAuthErrors);
  });

  // Automatically clear error highlight when user types
  document.querySelectorAll('#modal-user-auth input').forEach((inp) => {
    inp.addEventListener('input', () => {
      inp.classList.remove('border-rose-500', 'ring-2', 'ring-rose-400', 'bg-rose-50/40');
    });
  });

  // Form User Login Submit
  document.getElementById('form-user-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllAuthErrors();
    const identifier = (document.getElementById('login-input-identifier')?.value || '').trim();
    const password = (document.getElementById('login-input-password')?.value || '').trim();

    try {
      const user = await loginUser(identifier, password);
      closeModal('modal-user-auth');
      renderAuthNav();
      renderListings();
      updateCreateListingSellerInfo();
      notifyUserJustLoggedIn(user.displayName || user.name);
      showToast(`🎉 Selamat datang kembali, ${user.displayName || user.name}!`, "success");
    } catch (err) {
      showLoginError(err.message || "Gagal masuk. Periksa kembali nomor WA/email dan password Anda.");
    }
  });

  // Form User Register Submit
  document.getElementById('form-user-register')?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllAuthErrors();
    const name = document.getElementById('reg-input-name').value.trim();
    const storeName = document.getElementById('reg-input-store').value.trim();
    const phone = document.getElementById('reg-input-phone').value.trim();
    const email = document.getElementById('reg-input-email').value.trim();
    const region = document.getElementById('reg-select-region').value;
    const district = document.getElementById('reg-select-district').value;
    const password = document.getElementById('reg-input-password').value;
    const confirmPass = document.getElementById('reg-input-password-confirm').value;

    if (password !== confirmPass) {
      showRegisterError("Konfirmasi password tidak cocok. Periksa kembali password yang Anda masukkan.");
      return;
    }

    try {
      const user = registerUser({ name, storeName, phone, email, region, district, password });
      closeModal('modal-user-auth');
      renderAuthNav();
      notifyUserJustLoggedIn(user.displayName || user.name);
      showToast(`🎉 Pendaftaran Berhasil! Selamat datang di Pusat Barkas Solo Raya, ${user.displayName || user.name}. Email aktivasi telah dikirim ke ${user.email}.`, "success", 6000);
    } catch (err) {
      showRegisterError(err.message || "Pendaftaran akun gagal. Silakan coba beberapa saat lagi.");
    }
  });

  // Form Forgot Password Request Submit
  document.getElementById('form-forgot-request')?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllAuthErrors();
    const email = document.getElementById('forgot-input-email').value.trim();

    try {
      const res = requestPasswordReset(email);
      const step2 = document.getElementById('forgot-step-reset');
      const codeDisplay = document.getElementById('forgot-display-code');
      const codeInput = document.getElementById('forgot-input-code');

      if (step2) step2.classList.remove('hidden');
      if (codeDisplay) codeDisplay.textContent = res.resetCode;
      if (codeInput) codeInput.value = res.resetCode;

      showToast(`📧 Kode pemulihan [${res.resetCode}] berhasil dikirim ke ${res.email}! Cek Inbox atau folder Spam.`, "success", 6000);
    } catch (err) {
      showForgotError(err.message || "Gagal membuat kode reset password.");
    }
  });

  // Form Forgot Password Confirm Submit
  document.getElementById('form-forgot-confirm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    clearAllAuthErrors();
    const email = document.getElementById('forgot-input-email').value.trim();
    const resetCode = document.getElementById('forgot-input-code').value.trim();
    const newPassword = document.getElementById('forgot-input-new-password').value;

    try {
      confirmPasswordReset(email, resetCode, newPassword);
      showToast("Password akun Anda berhasil diperbarui! Silakan masuk dengan password baru.", "success", 6000);
      switchAuthTab('login');
      const loginIdInput = document.getElementById('login-input-identifier');
      if (loginIdInput) loginIdInput.value = email;
      const loginPassInput = document.getElementById('login-input-password');
      if (loginPassInput) {
        loginPassInput.value = '';
        setTimeout(() => loginPassInput.focus(), 150);
      }
    } catch (err) {
      showForgotConfirmError(err.message || "Gagal mengatur ulang password. Pastikan kode verifikasi 6 digit sudah tepat.");
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

function showToast(message, type = 'info', duration = 4500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2.5 max-w-md w-[92%] sm:w-auto sm:min-w-[360px] pointer-events-none';
    document.body.appendChild(container);
  }

  // Ensure z-index is highest and top-center
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

function handleInitialUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const actionParam = params.get('action') || params.get('tab') || params.get('page');
  const regionParam = params.get('region');
  const itemParam = params.get('item');
  const hash = window.location.hash ? window.location.hash.toLowerCase() : '';

  // Live Studio Split View Modes (Kiri: Mobile Editor | Kanan: Passive Preview)
  const modeParam = params.get('mode');
  if (modeParam === 'mobile_editor') {
    document.getElementById('app-splash-screen')?.remove();
    document.body.classList.add('is-in-phone-frame');
    sessionStorage.setItem('pusat_barkas_admin_auth', 'true');
    setTimeout(() => {
      enableVisualEditor();
    }, 150);
  } else if (modeParam === 'passive_preview') {
    document.getElementById('app-splash-screen')?.remove();
    state.isVisualEditorActive = false;
    document.body.classList.remove('visual-editor-active');
    document.getElementById('floating-live-editor-bar')?.classList.add('hidden');
    
    // Live passive listener from left phone editor
    window.addEventListener('message', (e) => {
      if (e.data && (e.data.type === 'LIVE_STUDIO_SYNC' || e.data.type === 'LIVE_STUDIO_SAVED')) {
        if (e.data.customTexts) {
          state.customTexts = e.data.customTexts;
          applyCustomTexts(e.data.customTexts);
        }
        if (e.data.siteSettings) {
          state.siteSettings = e.data.siteSettings;
          applySiteSettings(e.data.siteSettings);
        }
      }
    });
  }

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
  } else if (actionParam === 'ulasan' || actionParam === 'reviews' || hash === '#ulasan' || hash === '#reviews') {
    openAppReviewsModal();
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

  // Inisialisasi Live Activity & Online Widget (+196 Pengguna Aktif)
  initLiveActivityWidget();

  // Clear hash and action param from browser history so back/forward and home navigation won't re-trigger modals
  if (actionParam || (hash && hash !== '#' && hash !== '')) {
    try {
      window.history.replaceState({}, document.title, window.location.pathname + (regionParam ? `?region=${regionParam}` : ''));
    } catch (e) {}
  }
}
