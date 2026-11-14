// Minimal service worker so phones can install the app to the home screen. It caches nothing,
// so patient data is never stored by the worker and every screen is always current.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
