const CACHE_NAME = 'kho-giay-mobile-v2.1';

// Assets to strictly pre-cache on install
// Note: We do NOT pre-cache the main JS bundle here because its hash changes every build.
// We handle that in the Runtime Caching logic below.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com', // UI Library
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0', // Icons
  'https://i.postimg.cc/8zF3c24h/image.png' // Logo
];

// URLs to ignore (API calls)
const IGNORE_URLS = [
  'script.google.com',
  'googleusercontent.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Take over immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(PRECACHE_URLS).catch(err => {
         console.warn("[SW] Pre-cache warning:", err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. IGNORE API CALLS (Always Network)
  if (IGNORE_URLS.some(domain => url.hostname.includes(domain)) || event.request.method === 'POST') {
    return;
  }

  // 2. HANDLE EXTERNAL STATIC ASSETS (Fonts, CDN, ZXing) -> Stale-While-Revalidate
  // This ensures we load fast from cache but update in background
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com') || // ZXing Library
    url.hostname.includes('i.postimg.cc')
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const fetchPromise = fetch(event.request, { mode: 'cors', credentials: 'omit' })
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse); // Fallback to cache if network fails

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. HANDLE LOCAL ASSETS (Vite Bundled CSS/JS/Images) -> Cache First
  // Vite generates hashed filenames (e.g., index.a1b2c.js), so if the file exists, it never changes.
  if (url.origin === location.origin && (
      url.pathname.startsWith('/assets/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.json')
  )) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
           if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
           }
           const responseToCache = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
           });
           return networkResponse;
        });
      })
    );
    return;
  }

  // 4. NAVIGATION REQUESTS (SPA fallback)
  // If user reloads offline at /dashboard, return index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }
});