/**
 * Web Push Notification Service (Supabase & Service Worker VAPID Engine)
 * Pure Web Push Notification implementation without Firebase
 */

import { getCurrentUser } from './auth.js';

export const VAPID_PUBLIC_KEY = 'BOMPQQn3bQc9vJt68WlanKbCfTpN-N2HLoTkB34G0348Cqoh1P1SD5wt4aK40fBG090yDkkAoCVBICK0IigZ07Y';
const STORAGE_KEY_PUSH_ENABLED = 'solosatset_push_enabled';

/**
 * Helper: Convert VAPID base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push Notification is supported in current browser
 */
export function isPushNotificationSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Check current notification permission status ('granted', 'denied', 'default')
 */
export function getNotificationPermissionStatus() {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!isPushNotificationSupported()) {
    throw new Error('Web Push Notification tidak didukung pada browser/perangkat ini.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Izin notifikasi tidak diberikan oleh pengguna.');
  }

  return permission;
}

/**
 * Subscribe current device to Web Push Notification
 */
export async function subscribeUserToPush() {
  if (!isPushNotificationSupported()) return null;

  try {
    const perm = await requestNotificationPermission();
    if (perm !== 'granted') return null;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
    }

    if (subscription) {
      const user = getCurrentUser();
      const payload = {
        action: 'subscribe',
        subscription: subscription.toJSON(),
        userId: user ? user.id : null,
        userEmail: user ? user.email : null
      };

      // Kirim langganan ke backend Supabase
      const response = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        window.__solosatset_push_enabled = true;
        console.log('[Web Push] Perangkat berhasil terdaftar untuk notifikasi push SoloSatSet.');
      }
      return subscription;
    }
  } catch (error) {
    console.error('[Web Push Subscribe Error]', error);
    throw error;
  }
  return null;
}

/**
 * Unsubscribe current device from Web Push Notification
 */
export async function unsubscribeUserFromPush() {
  if (!isPushNotificationSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unsubscribe',
          subscription: subscription.toJSON()
        })
      });

      await subscription.unsubscribe();
      window.__solosatset_push_enabled = false;
      console.log('[Web Push] Perangkat berhasil berhenti berlangganan notifikasi push.');
      return true;
    }
  } catch (error) {
    console.error('[Web Push Unsubscribe Error]', error);
  }
  return false;
}

/**
 * Trigger broadcast push notification (for Admin or System Updates)
 */
export async function sendPushBroadcast({ title, body, url, tag, targetUserId, targetEmail }) {
  try {
    const response = await fetch('/api/push-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title || '📢 Pusat Jual Beli Solo Raya',
        body: body || 'Pembaruan sistem & info barang terbaru!',
        url: url || 'https://solosatset.vercel.app/',
        tag: tag || 'solosatset-update',
        targetUserId,
        targetEmail
      })
    });
    return await response.json();
  } catch (e) {
    console.error('[Web Push Broadcast Error]', e);
    return { success: false, error: e.message };
  }
}

/**
 * Auto-Initialize Web Push on page load if permission was previously granted
 */
export async function initPushNotification() {
  if (!isPushNotificationSupported()) return;

  if (Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const user = getCurrentUser();
        // Sync silently with Supabase
        fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'subscribe',
            subscription: subscription.toJSON(),
            userId: user ? user.id : null,
            userEmail: user ? user.email : null
          })
        }).catch(() => {});
      }
    } catch (e) {}
  } else if (Notification.permission === 'default') {
    // Tampilkan banner ajakan izin notifikasi secara cerdas pada interaksi pertama
    setTimeout(showPushNotificationBanner, 3500);
  }
}

/**
 * Tampilkan Banner Ajakan Izin Notifikasi Asli (Native Notification Prompt Banner)
 */
export function showPushNotificationBanner() {
  if (!isPushNotificationSupported()) return;
  if (Notification.permission !== 'default') return;
  if (sessionStorage.getItem('solosatset_push_prompt_dismissed')) return;
  if (document.getElementById('push-notification-floating-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'push-notification-floating-banner';
  banner.className = 'fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] sm:w-auto sm:max-w-md bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-rose-500/30 flex items-center justify-between gap-3 animate-bounce-in';
  
  banner.innerHTML = `
    <div class="flex items-center gap-2.5 min-w-0">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 to-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      </div>
      <div class="min-w-0">
        <div class="text-xs font-black text-white leading-tight">Aktifkan Notifikasi SoloSatSet?</div>
        <div class="text-[10px] text-slate-300 line-clamp-1 mt-0.5">Dapatkan info pesan pembeli & iklan terbaru di HP Anda</div>
      </div>
    </div>
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button 
        type="button" 
        id="btn-banner-allow-push" 
        class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer select-none active:scale-95 whitespace-nowrap"
      >
        Izinkan
      </button>
      <button 
        type="button" 
        id="btn-banner-dismiss-push" 
        class="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
        title="Tutup"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('btn-banner-allow-push')?.addEventListener('click', async () => {
    try {
      const sub = await subscribeUserToPush();
      if (sub) {
        // Tampilkan notifikasi native perdana sebagai konfirmasi
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('🎉 Notifikasi SoloSatSet Aktif!', {
            body: 'Selamat! Anda akan menerima info barang seken dan pesan pembeli langsung di perangkat ini.',
            icon: './assets/img/app-logo.png?v=2.1',
            badge: './assets/img/app-logo.png?v=2.1',
            vibrate: [200, 100, 200],
            tag: 'solosatset-welcome'
          });
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[Push Banner Notice]', e);
    } finally {
      banner.remove();
    }
  });

  document.getElementById('btn-banner-dismiss-push')?.addEventListener('click', () => {
    sessionStorage.setItem('solosatset_push_prompt_dismissed', 'true');
    banner.remove();
  });
}

// Auto-run on idle load
if (typeof window !== 'undefined') {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => initPushNotification());
  } else {
    setTimeout(initPushNotification, 2000);
  }
}

