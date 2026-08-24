const CACHE_VERSION = "animua-admin-v7";
const BUILD_ASSET_MANIFEST = "/pwa-assets.json";
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

const getBuildAssets = async () => {
  try {
    const response = await fetch(BUILD_ASSET_MANIFEST, { cache: "no-store" });
    if (!response.ok) return [];
    const assets = await response.json();
    return Array.isArray(assets)
      ? assets.filter((asset) => typeof asset === "string" && asset.startsWith("/"))
      : [];
  } catch (error) {
    return [];
  }
};

const cacheUrls = async (cache, urls) => {
  const uniqueUrls = [...new Set(urls)];
  await Promise.allSettled(uniqueUrls.map((url) => cache.add(url)));
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(async (cache) => {
        const buildAssets = await getBuildAssets();
        await cacheUrls(cache, [...APP_SHELL, BUILD_ASSET_MANIFEST, ...buildAssets]);
      })
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
    // Let the browser load CDN styles, fonts, and scripts normally. Re-fetching
    // them inside the worker changes their CSP classification to connect-src.
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

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { notification: { body: event.data?.text() || "" } };
  }

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "ANIMUA management update";
  const body = notification.body || data.body || "Open Management to review this update.";
  const target = data.link || payload.fcmOptions?.link || "/pages/dashboard.html";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: notification.icon || "/pwa-192.png",
    badge: notification.badge || "/favicon.png",
    tag: notification.tag || `${data.type || "animua"}-${data.referenceId || "management"}`,
    renotify: notification.renotify !== false,
    data: { url: target },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = new URL("/pages/dashboard.html", self.location.origin);
  try {
    const requested = new URL(event.notification.data?.url || target.href, self.location.origin);
    if (requested.origin === self.location.origin) target = requested;
  } catch {
    // Keep the safe dashboard destination.
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
          await existing.navigate(target.href);
          return existing.focus();
        }
        return self.clients.openWindow(target.href);
      })
  );
});
