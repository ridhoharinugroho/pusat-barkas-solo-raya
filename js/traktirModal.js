// ============================================================
// TRAKTIR PENGEMBANG MODAL CONTROLLER
// Single source of truth for Traktir Pengembang modal
// ============================================================

export function initTraktirModal() {
    const button = document.getElementById('nav-btn-traktir');
    if (!button) {
        return false;
    }

    // Idempotency guard: prevent duplicate event listeners
    if (button.dataset.traktirReady === 'true') {
        return true;
    }

    button.dataset.traktirReady = 'true';

    button.type = 'button';
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';

    button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();

        const modal = document.getElementById('modal-traktir-kopi');
        if (!modal) {
            console.error('[TRAKTIR] ERROR: #modal-traktir-kopi tidak ditemukan.');
            return;
        }

        // Move modal to body if nested inside container with stacking context issues
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }

        // Use global application modal system
        const openFn = window.openModal || (typeof openModal === 'function' ? openModal : null);

        if (openFn) {
            openFn('modal-traktir-kopi');
        } else {
            console.error('[TRAKTIR] ERROR: openModal() modal system tidak tersedia.');
        }
    });

    return true;
}

function autoInit() {
    if (initTraktirModal()) return;

    let attempts = 0;
    const retry = setInterval(function () {
        attempts++;
        if (initTraktirModal()) {
            clearInterval(retry);
            return;
        }
        if (attempts >= 20) {
            clearInterval(retry);
        }
    }, 250);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
} else {
    setTimeout(autoInit, 0);
}
