/* OpsLog service worker — offline cache + notification actions. */
const CACHE = 'opslog-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/util.js', './assets/js/categories.js', './assets/js/store.js', './assets/js/parser.js',
  './assets/js/voice.js', './assets/js/reports.js', './assets/js/charts.js', './assets/js/agent.js',
  './assets/js/demo.js', './assets/js/app.js',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network-first for our own files (so updates land quickly), cache fallback when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && (same || font)) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});

self.addEventListener('notificationclick', (e) => {
  const action = e.action || 'answer';
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => c.url.startsWith(self.registration.scope));
    if (client) {
      if (action !== 'snooze') await client.focus().catch(() => {});
      client.postMessage({ type: action === 'snooze' ? 'snooze' : 'answer' });
    } else if (action !== 'snooze') {
      await self.clients.openWindow('./index.html?call=1#/dashboard');
    }
  })());
});
