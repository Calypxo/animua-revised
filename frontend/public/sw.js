const CACHE_VERSION = "animua-public-v30";
const BUILD_ASSET_MANIFEST = "/pwa-assets.json";
const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.png",
  "/pwa-192.png",
  "/pwa-512.png",
  "/pwa-512-maskable.png",
  "/pages/public/home.html",
  "/pages/public/find-furbabies.html",
  "/pages/public/announcements.html",
  "/pages/public/petCompatibility.html",
  "/pages/public/compatibilityResults.html",
  "/pages/public/quizLanding.html",
  "/pages/public/contact.html",
  "/pages/public/surrender.html",
  "/pages/public/my-submissions.html",
  "/pages/public/verify-email-action.html",
  "/pages/public/verify-success.html"
];

const LIVE_DATA_HOSTS = new Set([
  "animua-backend.onrender.com",
  "localhost",
  "127.0.0.1"
]);

const isLiveDataRequest = (requestUrl) => (
  requestUrl.pathname.startsWith("/api/") ||
  (LIVE_DATA_HOSTS.has(requestUrl.hostname) && requestUrl.pathname.startsWith("/api/"))
);

const isFreshAssetRequest = (request) => (
  request.destination === "style" ||
  request.destination === "script" ||
  request.destination === "worker" ||
  request.destination === "document"
);

const cacheFreshResponse = (request, response) => {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
};

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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);

  if (isLiveDataRequest(requestUrl)) {
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
        .then((response) => cacheFreshResponse(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html")))
    );
    return;
  }

  if (isFreshAssetRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => cacheFreshResponse(request, response))
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      return cacheFreshResponse(request, response);
    }))
  );
});
