// ============================================================
// NOTIFICATION MODAL CONTROLLER & PARTIAL LOADER
// Single source of truth for loading #modal-notifications partial
// ============================================================

const MODAL_ID = 'modal-notifications';
const OPEN_BUTTON_ID = 'btn-open-notifications-modal';

let initialized = false;

export async function ensureNotificationsModalLoaded() {
  if (document.getElementById(MODAL_ID)) {
    return true;
  }
  try {
    const response = await fetch('components/modals/notifications.html');
    if (!response.ok) {
      console.error('[Notifications] Error loading modal partial: HTTP', response.status);
      return false;
    }
    const html = await response.text();
    if (!document.getElementById(MODAL_ID)) {
      document.body.insertAdjacentHTML('beforeend', html);
      if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
        try { window.lucide.createIcons(); } catch (e) {}
      }
    }
    return true;
  } catch (err) {
    console.error('[Notifications] Error loading modal partial:', err);
    return false;
  }
}

export function ensureNotificationsModal() {
  const el = document.getElementById(MODAL_ID);
  if (el) {
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    return el;
  }
  ensureNotificationsModalLoaded();
  return document.getElementById(MODAL_ID);
}

export async function openNotifications() {
  await ensureNotificationsModalLoaded();

  const modal = document.getElementById(MODAL_ID);
  if (!modal) {
    console.error('[Notifications] ERROR: #modal-notifications tidak ditemukan.');
    return false;
  }

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  const openFn = window.openModal || (typeof openModal === 'function' ? openModal : null);
  if (openFn) {
    openFn(MODAL_ID);
  } else {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    document.body.style.overflow = 'hidden';
  }

  window.dispatchEvent(new CustomEvent('notifications:opened'));
  return true;
}

export function closeNotifications() {
  const closeFn = window.closeModal || (typeof closeModal === 'function' ? closeModal : null);
  if (closeFn) {
    closeFn(MODAL_ID);
  } else {
    const modal = document.getElementById(MODAL_ID);
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      modal.style.visibility = 'hidden';
      document.body.style.overflow = '';
    }
  }

  window.dispatchEvent(new CustomEvent('notifications:closed'));
}

export function initNotificationsModal() {
  ensureNotificationsModalLoaded();

  if (initialized) {
    return;
  }
  initialized = true;

  const button = document.getElementById(OPEN_BUTTON_ID);
  if (button) {
    button.type = 'button';
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';

    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openNotifications();
    });
  }

  window.openNotifications = openNotifications;
  window.closeNotifications = closeNotifications;
  window.ensureNotificationsModal = ensureNotificationsModal;
  window.ensureNotificationsModalLoaded = ensureNotificationsModalLoaded;
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initNotificationsModal(); }, { once: true });
} else {
  setTimeout(initNotificationsModal, 0);
}
