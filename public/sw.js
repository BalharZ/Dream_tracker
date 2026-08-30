// Dream Tracker service worker — RETIRED (S33).
//
// Web push was removed: reminders now come only from the native Android app.
// This stub replaces the old push worker. Browsers re-fetch /sw.js on navigation
// and byte-compare it, so shipping this self-unregistering version makes any
// device that still has the old worker drop it on the next visit. It also
// ignores push events, so even a stale controlling worker shows nothing.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove any leftover web-push subscription, then unregister self.
      try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription) await subscription.unsubscribe();
      } catch (err) {
        // ignore
      }
      await self.registration.unregister();
      await self.clients.claim();
    })()
  );
});

// Swallow any push that still arrives before the worker is gone.
self.addEventListener("push", () => {});
