// ============================================================
// PICKER MODALS LOADER (GROUP A)
// Single source of truth for loading components/modals/pickers.html
// Modals: category-picker, condition-picker, nego-picker,
// payment-method-picker, item-status-picker, app-category-picker,
// filter-category-picker, filter-condition-picker
// ============================================================

export async function ensurePickerModalsLoaded() {
    if (document.getElementById('modal-category-picker')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/pickers.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-category-picker')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[PICKER MODALS] Error loading picker modals partial:', err);
        return false;
    }
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensurePickerModalsLoaded(); }, { once: true });
} else {
    setTimeout(ensurePickerModalsLoaded, 0);
}
