// ============================================================
// PRODUCT & SELLER MODALS LOADER
// Single source of truth for loading components/modals/product-seller.html
// Modals: modal-product-detail, modal-create-listing,
// modal-my-listings, modal-seller-profile
// ============================================================

export async function ensureProductSellerModalsLoaded() {
    if (document.getElementById('modal-product-detail')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/product-seller.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-product-detail')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[PRODUCT SELLER MODALS] Error loading product & seller modals partial:', err);
        return false;
    }
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureProductSellerModalsLoaded(); }, { once: true });
} else {
    setTimeout(ensureProductSellerModalsLoaded, 0);
}
