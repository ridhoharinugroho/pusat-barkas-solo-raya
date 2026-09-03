// notificationModal.js
/**
 * Utility module for handling the notification modal (Pusat Notifikasi).
 * Provides functions to open, close, initialize, and render notifications.
 *
 * Usage:
 *   import { initNotificationsModal, openNotifications, closeNotifications } from './notificationModal.js';
 *   initNotificationsModal(); // call once on page load
 */

// Cache DOM elements
const modalId = 'modal-notifications';
const btnOpenId = 'btn-open-notifications-modal';
const btnCloseSelector = '[data-close-modal]'; // any element with data-close-modal attribute

/**
 * Opens the notification modal.
 * Resets inline styles that may have been set by closeModal() and ensures body overflow is hidden.
 */
export function openNotifications() {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error('Modal notifikasi tidak ditemukan');
    return;
  }
  // Reset inline styles (in case closeModal set them)
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the notification modal.
 * Restores body overflow and hides the modal via class and inline styles.
 */
export function closeNotifications() {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.style.visibility = 'hidden';
  modal.style.opacity = '0';
  document.body.style.overflow = '';
}

/**
 * Initializes event listeners for opening and closing the notification modal.
 * - Handles click on the bell button.
 * - Handles click on any element with `data-close-modal="modal-notifications"` (backdrop, close button).
 * - Prevents event propagation to avoid accidental backdrop closing.
 */
export function initNotificationsModal() {
  let btnOpenNotif = document.getElementById(btnOpenId);
  if (btnOpenNotif) {
    // Kloning tombol untuk mencegah duplikasi event
    const freshBtnOpen = btnOpenNotif.cloneNode(true);
    btnOpenNotif.replaceWith(freshBtnOpen);
    btnOpenNotif = freshBtnOpen;

    btnOpenNotif.addEventListener('click', (e) => {
      // 1. Hentikan paksa refresh halaman
      e.preventDefault();
      // 2. Cegah bentrok dengan elemen di belakangnya
      e.stopPropagation();

      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error('Elemen modal-notifications tidak ditemukan di DOM!');
        return;
      }

      // 1. Tampilkan modal secara aman dengan me-reset gaya sebaris (inline styles)
      openNotifications();

      // 2. Render data notifikasi dari cache lokal secara aman menggunakan requestAnimationFrame
      requestAnimationFrame(() => {
        try {
          if (typeof renderNotificationsDOM === 'function') {
            const notificationsData = typeof cachedNotifications !== 'undefined' ? cachedNotifications : [];
            renderNotificationsDOM(notificationsData);
          }
        } catch (err) {
          console.warn('Gagal merender daftar notifikasi:', err);
        }
      });

      // 3. Sinkronisasi data terbaru dari database di latar belakang secara asinkron
      setTimeout(() => {
        if (typeof syncUserNotifications === 'function') {
          syncUserNotifications(false).catch(err => {
            console.warn('Sinkronisasi latar belakang tertunda:', err);
          });
        }
      }, 50);
    });
  }

  // Close modal on any element with data-close-modal attribute targeting this modal
  document.querySelectorAll(btnCloseSelector).forEach(el => {
    const target = el.getAttribute('data-close-modal');
    if (target === modalId) {
      el.addEventListener('click', e => {
        e.stopPropagation();
        closeNotifications();
      });
    }
  });
}

// Optional: expose helpers for testing/debugging
window.openNotifications = openNotifications;
window.closeNotifications = closeNotifications;
