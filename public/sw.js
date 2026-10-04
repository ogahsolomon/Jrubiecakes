const CACHE_NAME = "jrubiecakes-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = ["/", OFFLINE_URL, "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses or auth: they must always be fresh.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Never cache Next.js router internals. These carry per-session React state
  // and navigation intent; serving a stale copy breaks client-side routing.
  if (url.searchParams.has("_rsc")) return;
  if (request.headers.get("RSC")) return;
  if (request.headers.get("Next-Router-Prefetch")) return;
  if (request.headers.get("Next-Router-State-Tree")) return;

  // Only cache real assets and page navigations, never opaque responses.
  const isAsset = /\.(?:js|css|png|jpe?g|svg|webp|avif|ico|woff2?|ttf|map)$/i.test(
    url.pathname
  );
  const isNavigation = request.mode === "navigate";

  if (!isAsset && !isNavigation) return;

  // Network-first: fresh content when online, cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || (isNavigation ? caches.match(OFFLINE_URL) : undefined))
      )
  );
});