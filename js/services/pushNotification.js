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
        localStorage.setItem(STORAGE_KEY_PUSH_ENABLED, 'true');
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
      localStorage.removeItem(STORAGE_KEY_PUSH_ENABLED);
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
  }
}

// Auto-run on idle load
if (typeof window !== 'undefined') {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => initPushNotification());
  } else {
    setTimeout(initPushNotification, 2000);
  }
}
