if (import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("animua-admin-"))
          .map((name) => caches.delete(name))
      );
    }

    if (hadController) window.location.reload();
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || !navigator.serviceWorker.controller) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("[ANIMUA Admin PWA] Service worker registration failed.", error);
      });
  });
}
