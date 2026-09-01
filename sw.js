/**
 * solosatset - Service Worker Engine v20260902_v209
 * Instant Cache Invalidation, Automatic Update & Network-First Fresh Code Delivery
 */

const CACHE_NAME = 'solosatset-cache-v20260902_v209';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './toko-saya.html',
  './admin.html',
  './css/styles.css',
  './assets/img/app-logo.png',
  './assets/img/app-splash.png',
  './manifest.json',
  './favicon.ico',
  './favicon.png'
];

// 1. INSTALL EVENT - Precache Critical App Shell dengan Resilient Caching
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response && response.status === 200) {
              await cache.put(url, response);
            }
          } catch (err) {
            console.warn(`[SW Precache] Notice for ${url}:`, err.message);
          }
        })
      );
    })
  );
});

// 2. ACTIVATE EVENT - Fast Cache Invalidation for Outdated Builds
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Purging legacy cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT - Network-First Strategy for Fresh Code
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Bypass non-GET, dynamic APIs, WebSockets, Supabase & analytics
  if (
    event.request.method !== 'GET' ||
    requestUrl.protocol.startsWith('chrome-extension') ||
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.hostname.includes('supabase.co') ||
    requestUrl.hostname.includes('firebaseio.com') ||
    requestUrl.hostname.includes('identitytoolkit') ||
    requestUrl.hostname.includes('googleapis.com') ||
    requestUrl.hostname.includes('google-analytics') ||
    requestUrl.hostname.includes('googletagmanager')
  ) {
    return;
  }

  // Network First for HTML and JavaScript files
  if (
    event.request.mode === 'navigate' ||
    requestUrl.pathname.endsWith('.html') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname === '/' ||
    requestUrl.pathname === ''
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html') || caches.match('./');
            }
            return new Response('Network connection offline', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // Stale-While-Revalidate for Static Assets (Images, Fonts, CSS)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. MESSAGE EVENT - Instant Cache Invalidation Trigger
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 5. PUSH EVENT - Handle incoming Web Push Notifications (Supabase & VAPID Engine)
self.addEventListener('push', (event) => {
  let data = {
    title: '📢 Pusat Jual Beli Solo Raya',
    body: 'Ada info barang seken dan pembaruan sistem terbaru!',
    icon: './assets/img/app-logo.png?v=2.1',
    image: null,
    badge: './assets/img/app-logo.png?v=2.1',
    url: './',
    tag: 'solosatset-notification'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const isBu = data.tag && data.tag.includes('bu-');
  const options = {
    body: data.body || data.message,
    icon: data.icon || './assets/img/app-logo.png?v=2.1',
    image: data.image || null,
    badge: data.badge || './assets/img/app-logo.png?v=2.1',
    tag: data.tag || 'solosatset-notification',
    renotify: true,
    requireInteraction: true,
    vibrate: isBu ? [200, 100, 200, 100, 200] : [200, 100, 200],
    dir: 'auto',
    lang: 'id-ID',
    data: {
      url: data.url || './',
      timestamp: data.timestamp || Date.now()
    },
    actions: [
      { action: 'open', title: 'Lihat Iklan 🔥' },
      { action: 'close', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 6. NOTIFICATION CLICK EVENT - Open app or focus existing window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('solosatset') && 'focus' in client) {
          if (client.navigate) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

