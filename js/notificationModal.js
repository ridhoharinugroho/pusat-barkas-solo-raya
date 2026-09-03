/**
 * Notification Modal Controller
 * Fix:
 * - Tidak clone/replace tombol
 * - Tidak bergantung pada variable module app.js
 * - Event listener hanya dipasang sekali
 * - Modal selalu dibuka melalui controller ini
 */

const MODAL_ID = 'modal-notifications';
const OPEN_BUTTON_ID = 'btn-open-notifications-modal';
const CLOSE_SELECTOR = '[data-close-modal="modal-notifications"]';

let initialized = false;

export function openNotifications() {
    const modal = document.getElementById(MODAL_ID);

    if (!modal) {
        console.error('[Notifications] #modal-notifications tidak ditemukan.');
        return false;
    }

    modal.classList.remove('hidden');

    // Pastikan modal benar-benar visible
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';

    document.body.style.overflow = 'hidden';

    // Beri tahu app.js bahwa modal dibuka
    window.dispatchEvent(
        new CustomEvent('notifications:opened')
    );

    return true;
}

export function closeNotifications() {
    const modal = document.getElementById(MODAL_ID);

    if (!modal) {
        return;
    }

    modal.classList.add('hidden');

    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';

    document.body.style.overflow = '';

    window.dispatchEvent(
        new CustomEvent('notifications:closed')
    );
}

export function initNotificationsModal() {
    // Jangan pasang listener dua kali
    if (initialized) {
        return;
    }

    initialized = true;

    const button = document.getElementById(OPEN_BUTTON_ID);

    if (!button) {
        console.error(
            `[Notifications] Tombol #${OPEN_BUTTON_ID} tidak ditemukan.`
        );
        return;
    }

    /*
     * PENTING:
     * Jangan cloneNode().
     * Jangan replaceWith().
     *
     * Elemen asli dipertahankan supaya listener lain,
     * referensi DOM, dan event delegation tidak rusak.
     */

    button.addEventListener(
        'click',
        function handleNotificationButtonClick(event) {
            event.preventDefault();
            event.stopPropagation();

            console.log('[Notifications] Bell clicked');

            openNotifications();
        },
        false
    );

    /*
     * Close button / backdrop
     */
    document.addEventListener(
        'click',
        function handleNotificationClose(event) {
            const closeElement = event.target.closest(CLOSE_SELECTOR);

            if (!closeElement) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            closeNotifications();
        },
        false
    );

    /*
     * ESC untuk menutup modal
     */
    document.addEventListener(
        'keydown',
        function handleNotificationEscape(event) {
            if (event.key === 'Escape') {
                const modal = document.getElementById(MODAL_ID);

                if (
                    modal &&
                    !modal.classList.contains('hidden')
                ) {
                    closeNotifications();
                }
            }
        },
        false
    );

    /*
     * Klik area backdrop
     */
    const modal = document.getElementById(MODAL_ID);

    if (modal) {
        modal.addEventListener('click', function(event) {
            // Hanya tutup jika yang diklik adalah backdrop/modal container
            if (event.target === modal) {
                closeNotifications();
            }
        });
    }

    // Expose untuk debugging
    window.openNotifications = openNotifications;
    window.closeNotifications = closeNotifications;

    console.log('[Notifications] Controller initialized.');
}
