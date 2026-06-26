/* service-worker.js - Wedding RSVP PWA app-shell SW.
 * HARD RULE: live Apps Script data (script.google.com / script.googleusercontent.com),
 * any cross-origin request, and any non-GET request ALWAYS hit the network untouched
 * (no respondWith) - zero chance of stale dashboards or lost RSVP submissions. */

const CACHE = 'wrsvp-shell-v2'; // bump (-v2, -v3...) to invalidate the old shell

const PRECACHE_URLS = [
  './',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png'
];

// install: RESILIENT precache - a missing asset (icons added later) must NOT abort install.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// activate: drop stale caches, claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : undefined)))
    )
  );
  self.clients.claim();
});

// fetch: strict bypass first, then shell caching.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // (a) Never touch non-GET (RSVP POSTs etc.).
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  // (b) STRICT BYPASS: cross-origin + all Google endpoints -> browser handles it, never cached.
  const isCrossOrigin = url.origin !== self.location.origin;
  const host = url.hostname;
  const isGoogle = host === 'script.google.com' ||
                   host === 'script.googleusercontent.com' ||
                   host.includes('google.com');
  if (isCrossOrigin || isGoogle) return;

  // (c) Same-origin navigations -> network-first, fall back to cache (fresh online, works offline).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./')))
    );
    return;
  }

  // (d) Same-origin static assets -> cache-first + runtime caching.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
