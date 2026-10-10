const CACHE_NAME = 'fbr-scanner-v1';
const APP_SHELL = ['/', '/scanner', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      ),
      // purge private hub responses cached by earlier versions of this worker
      caches.open(CACHE_NAME).then(cache =>
        cache.keys().then(reqs =>
          Promise.all(reqs.filter(r => new URL(r.url).pathname.startsWith('/hub/')).map(r => cache.delete(r)))
        )
      ),
    ])
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // private hub data (messages, phones, signed URLs) must never enter the cache
  if (new URL(event.request.url).pathname.startsWith('/hub/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/scanner')))
  );
});
