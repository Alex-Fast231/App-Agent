// Reiner Durchreich-Service-Worker, nur damit der Viewer als installierbare
// PWA erkannt wird ("Zum Desktop hinzufügen" auf Laptop/PC). Es findet
// bewusst KEIN Caching statt (kein caches.open/cache.put) - jede Anfrage
// geht immer direkt ans Netz. Die Haupt-App hatte ihren Service Worker
// wegen Problemen mit veralteten zwischengespeicherten Ständen entfernt;
// da hier nichts zwischengespeichert wird, kann dasselbe Problem hier nicht
// auftreten.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
