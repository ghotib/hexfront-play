// Offline cache for Hexfront. Network first for the shell so deploys show up; cache first for hashed assets.
const VERSION = 'hexfront-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('push', (e) => {
  let data = { title: 'Hexfront', body: 'Your turn.', url: './' };
  try { data = { ...data, ...e.data.json() }; } catch { /* plain text */ }
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: './icon-192.png', badge: './icon-192.png', tag: 'hexfront-turn', renotify: true, data: { url: data.url } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) return c.focus();
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.cgi')) return;   // saves always go to the network
  if (url.origin !== location.origin) {
    // Google Fonts: serve from cache when offline, refresh when online
    e.respondWith(caches.open(VERSION).then(async (c) => {
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { const hit = await c.match(req); return hit ?? Response.error(); }
    }));
    return;
  }
  const hashed = /\/assets\//.test(url.pathname);
  if (hashed) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r;
    }));
    return;
  }
  e.respondWith(caches.open(VERSION).then(async (c) => {
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; } catch { const hit = await c.match(req); return hit ?? (await c.match('./index.html')) ?? Response.error(); }
  }));
});
