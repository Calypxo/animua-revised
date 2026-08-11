const CACHE_VERSION = "animua-admin-v4";
const RENDER_API_ORIGIN = "https://animua-backend.onrender.com";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/pwa-512-maskable.png",
  "/pages/admin-login.html",
  "/pages/dashboard.html",
  "/pages/animalProfile.html",
  "/pages/animalProfiling.html",
  "/pages/adoptionApplications.html",
  "/pages/surrenders.html",
  "/pages/inventory.html",
  "/pages/reports.html",
  "/pages/userManagement.html",
  "/pages/intakeList.html",
  "/pages/auditTrail.html",
  "/pages/archivedRecords.html",
  "/pages/announcements.html",
  "/pages/contactMessages.html",
  "/pages/accountSettings.html",
  "/pages/compatibilityQuiz.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (
        key === CACHE_VERSION ? undefined : caches.delete(key)
      ))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const isRenderApiRequest = requestUrl.origin === RENDER_API_ORIGIN
    && (requestUrl.pathname === "/api" || requestUrl.pathname.startsWith("/api/"));
  const isAuthenticationRequest = requestUrl.pathname === "/api/auth"
    || requestUrl.pathname.startsWith("/api/auth/");
  const hasAuthorizationHeader = request.headers.has("Authorization");

  // API and authenticated requests must always reach the backend and must
  // never be read from or written to Cache Storage.
  if (isRenderApiRequest || isAuthenticationRequest || hasAuthorizationHeader) {
    event.respondWith(fetch(request));
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => cached))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  // Management code changes must be visible on a normal reload. Use the
  // cached asset only as an offline fallback instead of serving stale JS/CSS.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
