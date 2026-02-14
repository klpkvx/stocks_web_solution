const VERSION = "v3";
const HTML_CACHE = `stock-pulse-html-${VERSION}`;
const STATIC_CACHE = `stock-pulse-static-${VERSION}`;
const API_CACHE = `stock-pulse-api-${VERSION}`;
const API_TTL_MS = 5 * 60 * 1000;
const STATIC_MAX_ITEMS = 120;
const API_MAX_ITEMS = 80;

const API_PATHS = [
  "/api/dashboard",
  "/api/quotes",
  "/api/news",
  "/api/heatmap",
  "/api/tickers",
  "/api/stock",
  "/api/time-series",
  "/api/quote"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(HTML_CACHE).then((cache) => cache.addAll(["/"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![HTML_CACHE, STATIC_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  return request.mode === "navigate";
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.match(/\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/)
  );
}

function isApiSnapshot(url) {
  return API_PATHS.some((path) => url.pathname.startsWith(path));
}

function withFetchedHeader(response) {
  const headers = new Headers(response.headers);
  headers.set("x-sw-fetched-at", String(Date.now()));
  return response.blob().then((blob) =>
    new Response(blob, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  );
}

function responseAgeMs(response) {
  const fetchedAt = Number(response.headers.get("x-sw-fetched-at") || 0);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return Number.POSITIVE_INFINITY;
  return Date.now() - fetchedAt;
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxItems) return;
  const extra = keys.length - maxItems;
  await Promise.all(keys.slice(0, extra).map((key) => cache.delete(key)));
}

async function networkFirst(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match("/");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
    void trimCache(STATIC_CACHE, STATIC_MAX_ITEMS);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const refreshPromise = fetch(request)
    .then(async (response) => {
      if (!response || !response.ok) return response;
      const wrapped = await withFetchedHeader(response.clone());
      cache.put(request, wrapped);
      void trimCache(API_CACHE, API_MAX_ITEMS);
      return response;
    })
    .catch(() => null);

  if (cached) {
    if (responseAgeMs(cached) <= API_TTL_MS) {
      return cached;
    }
    const fresh = await refreshPromise;
    return fresh || cached;
  }

  const network = await refreshPromise;
  if (network) return network;
  return new Response("Offline", { status: 503 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isApiSnapshot(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
