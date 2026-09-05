// ============================================================
// FILTER MODALS LOADER (GROUP B)
// Single source of truth for loading components/modals/filters.html
// Modals: sort, filter, filter-region-picker, filter-district-picker
// ============================================================

export async function ensureFilterModalsLoaded() {
    if (document.getElementById('modal-filter')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/filters.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-filter')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[FILTER MODALS] Error loading filter modals partial:', err);
        return false;
    }
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureFilterModalsLoaded(); }, { once: true });
} else {
    setTimeout(ensureFilterModalsLoaded, 0);
}
