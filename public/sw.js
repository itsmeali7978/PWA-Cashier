const CACHE_NAME = 'auth-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Safe addAll to prevent failure on uncacheable resources
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(err => console.log('Failed to cache', url, err));
          })
        );
      })
  );
});

self.addEventListener('fetch', event => {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Exclude API requests from caching
  if (event.request.url.includes('/api/')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request);
      })
  );
});
