// Service Worker for 進和集團報價系統
// Provides offline caching and PWA install support

const CACHE_NAME = 'cw-quotation-v25';
const CORE_ASSETS = [
  '/products-data.js',
  '/ref-quotations-data.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: cache non-HTML static assets only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching assets');
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches & take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => {
      console.log('[SW] Activated, old caches cleaned');
      return self.clients.claim();
    }).then(() => {
      // Notify all clients that a new version took over
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ action: 'newVersion', version: CACHE_NAME }));
      });
    })
  );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'checkVersion') {
    // The client can check if it matches the current SW version
    event.source.postMessage({ action: 'version', version: CACHE_NAME });
  }
});

// Fetch: network-first for HTML, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip cloud sync API calls
  if (url.hostname === 'api.jsonstorage.net') return;
  
  // HTML files (including root): network first, cache on success, fallback to cache
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  
  // Static assets: stale-while-revalidate (serve cache, update in background)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {});
        return cached || fetchPromise;
      });
    })
  );
});
