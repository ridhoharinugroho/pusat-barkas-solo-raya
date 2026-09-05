// ============================================================
// TRAKTIR PENGEMBANG MODAL CONTROLLER
// Single source of truth for Traktir Pengembang modal
// ============================================================

export async function ensureTraktirModalLoaded() {
    if (document.getElementById('modal-traktir-kopi')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/traktir-kopi.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-traktir-kopi')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[TRAKTIR] Error loading modal partial:', err);
        return false;
    }
}

export function initTraktirModal() {
    const button = document.getElementById('nav-btn-traktir');
    if (!button) {
        return false;
    }

    // Pre-fetch partial quietly
    ensureTraktirModalLoaded();

    // Idempotency guard: prevent duplicate event listeners
    if (button.dataset.traktirReady === 'true') {
        return true;
    }

    button.dataset.traktirReady = 'true';

    button.type = 'button';
    button.style.pointerEvents = 'auto';
    button.style.cursor = 'pointer';

    button.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopPropagation();

        if (!document.getElementById('modal-traktir-kopi')) {
            await ensureTraktirModalLoaded();
        }

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
    ensureTraktirModalLoaded().then(() => {
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
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true });
} else {
    setTimeout(autoInit, 0);
}
