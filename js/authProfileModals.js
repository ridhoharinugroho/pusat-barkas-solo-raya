// ============================================================
// AUTH & PROFILE MODALS LOADER
// Single source of truth for loading components/modals/auth-profile.html
// Modals: modal-user-auth, modal-user-profile,
// modal-profile-region-picker, modal-profile-district-picker
// ============================================================

export async function ensureAuthProfileModalsLoaded() {
    if (document.getElementById('modal-user-auth')) {
        return true;
    }
    try {
        const response = await fetch('components/modals/auth-profile.html');
        if (!response.ok) return false;
        const html = await response.text();
        if (!document.getElementById('modal-user-auth')) {
            document.body.insertAdjacentHTML('beforeend', html);
            if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
                try { window.lucide.createIcons(); } catch (e) {}
            }
        }
        return true;
    } catch (err) {
        console.error('[AUTH PROFILE MODALS] Error loading auth & profile modals partial:', err);
        return false;
    }
}

// Auto-prefetch when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureAuthProfileModalsLoaded(); }, { once: true });
} else {
    setTimeout(ensureAuthProfileModalsLoaded, 0);
}
