// Offline support. The app shell is precached as one versioned unit and served
// cache-first, so the app opens instantly on bad networks. Change VERSION on
// every release: the browser notices the changed sw.js and installs the new
// shell in the background. It takes over once every window of the app has been
// closed, so a running app never mixes files from two releases.
const VERSION = 'minutes-v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'minutes.js', 'store.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/anthropic-sdk.mjs',
];
const scopeUrl = new URL('./', self.location.href);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' skips the HTTP cache so a release never precaches stale files.
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Other apps on the same address (e.g. other GitHub Pages projects) share
    // this storage, so only remove this app's own old caches.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('minutes-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The app page itself; other pages and files in the folder are fetched normally.
const isAppPage = (url) => url.pathname === scopeUrl.pathname || url.pathname === `${scopeUrl.pathname}index.html`;
// Only store real, complete answers from this site: never errors, redirects
// or a captive-portal login page.
const cacheable = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const isNav = request.mode === 'navigate';
    const hit = isNav
      ? (isAppPage(url) ? await cache.match('index.html') : undefined)
      : await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (!isNav && cacheable(res)) e.waitUntil(cache.put(request, res.clone()));
      return res;
    } catch (err) {
      // Offline: fall back to a cached copy, and to the app for its own pages.
      const fallback = await cache.match(request, { ignoreSearch: true })
        || (isNav && isAppPage(url) ? await cache.match('index.html') : undefined);
      if (fallback) return fallback;
      throw err;
    }
  })());
});
