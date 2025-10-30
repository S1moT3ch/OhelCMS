const CACHE_NAME = "app-cache-v1";
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Installazione del service worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Attivazione e pulizia dei vecchi cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
});

// Intercetta richieste fetch
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Cache hit
      if (response) {
        return response;
      }
      // Cache miss
      return fetch(event.request);
    })
  );
});