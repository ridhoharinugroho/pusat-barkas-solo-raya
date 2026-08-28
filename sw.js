/**
 * solosatset - Service Worker Engine v20260829_v17
 * Instant Cache Invalidation, Automatic Update & Network-First Fresh Code Delivery
 */

const CACHE_NAME = 'solosatset-cache-v20260829_v17';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './toko-saya.html',
  './admin.html',
  './manifest.json',
  './favicon.ico',
  './favicon.png',
  './css/styles.css',
  './assets/img/app-logo.png',
  './assets/img/app-splash.png',
  './assets/img/qris-traktir-kopi.jpg'
];

// 1. INSTALL EVENT - Precache core shell & activate immediately (skipWaiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache partial notice (continuing):', err);
      });
    })
  );
});

// 2. ACTIVATE EVENT - Delete all stale/old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((existingCache) => {
          if (existingCache !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', existingCache);
            return caches.delete(existingCache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH EVENT - Network-First for HTML, Scripts (JS), and Styles (CSS); Cache-First for Media
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET or cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const isCodeOrDocument = 
    request.mode === 'navigate' || 
    request.destination === 'document' ||
    request.destination === 'script' ||
    request.destination === 'style' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css');

  // Network-First for Code & Documents to guarantee real-time updates after deploy
  if (isCodeOrDocument) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-While-Revalidate for Static Media (Images, Fonts, Icons)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. MESSAGE EVENT - Handle explicit skipWaiting and clean cache commands
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.action === 'skipWaiting' || event.data === 'skipWaiting') {
      self.skipWaiting();
    }
    if (event.data.action === 'cleanCache') {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      });
    }
  }
});
