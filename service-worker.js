/* service-worker.js - Wedding RSVP PWA (minimal, pass-through).
 * Caches NOTHING: the app and the dashboards always load fresh from the network,
 * so there is never stale content, and live Apps Script data is never blocked.
 * This worker exists only to keep the app installable (Add to Home Screen). */
const SW_VERSION = 'wrsvp-passthrough-v20-deskrepair2-20260705';

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

/* [WEBPUSH] Push event: payload-less by design. The Worker sends an empty body,
   so there is no data to read - we just show a fixed RTL Hebrew notification and
   route the tap to the dashboard via the existing notificationclick handler. */
self.addEventListener('push', function (event) {
  event.waitUntil(
    self.registration.showNotification('אורח חדש אישר הגעה! 🎉', {
      body: 'היכנסו ללוח הבקרה לצפייה בפרטים.',
      tag: 'wrsvp-push',
      dir: 'rtl',
      lang: 'he',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { page: 'page-dash' }
    })
  );
});

/* [G3-NOTIF] Notification click: focus the app and route it to a SPA page.
   Local notifications are shown BY THE PAGE via reg.showNotification();
   this handler only handles the tap. The SW still caches NOTHING. */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var page = (event.notification.data && event.notification.data.page) || 'page-dash';
  event.waitUntil((async function () {
    var clis = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (var i = 0; i < clis.length; i++) {
      var c = clis[i];
      try { await c.focus(); } catch (e) {}
      try { c.postMessage({ type: 'wrsvp-notification-click', page: page }); } catch (e) {}
      return; /* first client wins */
    }
    try { await self.clients.openWindow('./'); } catch (e) {} /* cold open: SPA restores wrsvpLastPage itself */
  })());
});
