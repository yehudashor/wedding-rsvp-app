/* service-worker.js - Wedding RSVP PWA (minimal, pass-through).
 * Caches NOTHING: the app and the dashboards always load fresh from the network,
 * so there is never stale content, and live Apps Script data is never blocked.
 * This worker exists only to keep the app installable (Add to Home Screen). */
const SW_VERSION = 'wrsvp-passthrough-v10-20260702';

self.addEventListener('install', function () {
  // take over as soon as possible
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    // wipe every cache left by older service-worker versions -> kills stale copies
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

/* Network pass-through: no respondWith() means the browser fetches normally.
   A fetch handler must exist for installability; this one forwards everything,
   so nothing is ever served from a cache. */
self.addEventListener('fetch', function () { /* no-op: always go to the network */ });
