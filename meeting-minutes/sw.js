// Offline support. The app shell is precached as one versioned unit and served
// cache-first, so the app opens instantly on bad networks and never mixes files
// from two releases. Change VERSION on every release: the browser notices the
// changed sw.js, installs the new shell, and the next launch uses it.
const VERSION = 'minutes-v5';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'minutes.js', 'store.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'vendor/anthropic-sdk.mjs',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // cache: 'reload' skips the HTTP cache so a release never precaches stale files.
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Only store real, complete answers from this site: never errors, redirects
// or a captive-portal login page.
const cacheable = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true })
      || (request.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (cacheable(res)) e.waitUntil(cache.put(request, res.clone()));
      return res;
    } catch (err) {
      if (request.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
