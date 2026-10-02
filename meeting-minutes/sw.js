// Caches the app shell so it opens without a connection.
const CACHE = 'minutes-v2';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'minutes.js', 'store.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    // Network first so updates arrive, cache when offline.
    e.respondWith(fetch(request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    // The pinned Claude SDK never changes, so cache it once fetched.
    e.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res;
    })));
  }
});
