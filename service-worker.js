/* service-worker.js - Wedding RSVP PWA (minimal, pass-through).
 * Caches NOTHING: the app and the dashboards always load fresh from the network,
 * so there is never stale content, and live Apps Script data is never blocked.
 * This worker exists only to keep the app installable (Add to Home Screen). */
const SW_VERSION = 'wrsvp-passthrough-v38-gmail-20260707';

/* [SMART-UPDATE 2026-07-06] Do NOT skipWaiting automatically on install. A freshly
   installed worker WAITS until the open page explicitly tells it to activate (via a
   {type:'SKIP_WAITING'} message). That lets the client decide: update silently when the
   app is backgrounded, or show a polite toast when the organiser is actively using it -
   so a deploy never yanks the page or loses data. (First-ever install has no active
   worker to wait behind, so new visitors still activate immediately.) */
self.addEventListener('install', function () { /* wait for the page's SKIP_WAITING */ });

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') { self.skipWaiting(); }
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

/* [WEBPUSH D1/D2 2026-07-07]
   Push event: payload-less by design. The Worker sends an empty body.

   Strategy (fixes D1 double-notification + D2 delayed detailed notification):
   - If the app page is open (any window client found via clients.matchAll):
       postMessage a 'wrsvp-push-signal' to trigger an IMMEDIATE pollOnce() on the
       client, which delivers a DETAILED notification (guest name, counts, blessing).
       Do NOT show the generic SW notification — the client poll will handle it.
   - If the app is fully closed (no clients):
       Show the generic fallback notification so the user still gets alerted.

   Result for D1 (installed PWA): installed users get exactly ONE notification per
   event — the client-poll detailed one — because the SW push is suppressed when the
   app is open. D2 (immediate delivery): the push signal triggers an immediate poll
   instead of waiting up to POLL_MS (5s) or until next app-open. */
self.addEventListener('push', function (event) {
  event.waitUntil((async function () {
    var clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.length > 0) {
      /* App is open: wake the client for an immediate detailed poll. No generic notification. */
      for (var i = 0; i < clients.length; i++) {
        try { clients[i].postMessage({ type: 'wrsvp-push-signal' }); } catch (e) {}
      }
      return; /* [D1 2026-07-07] suppress generic SW notification when app is running */
    }
    /* App is fully closed: show generic fallback — poll loop is dead so this is the only alert. */
    return self.registration.showNotification('אורח חדש אישר הגעה! 🎉', {
      body: 'היכנסו ללוח הבקרה לצפייה בפרטים.',
      tag: 'wrsvp-push',
      dir: 'rtl',
      lang: 'he',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { page: 'page-dash' }
    });
  })());
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
