// ============================================================
// APP REVIEWS MODAL CONTROLLER & PARTIAL LOADER
// Single source of truth for loading #modal-app-reviews partial
// ============================================================

export async function ensureAppReviewsModalLoaded() {
    if (document.getElementById('modal-app-reviews')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/app-reviews.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-app-reviews')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[APP REVIEWS] Error loading modal partial:', err);
        return false;
    }
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureAppReviewsModalLoaded(); }, { once: true });
} else {
    setTimeout(ensureAppReviewsModalLoaded, 0);
}
