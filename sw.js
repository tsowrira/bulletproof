// Offline shell for Bulletproof. The page holds the whole program, so caching it
// means the gym's dead spots and a dropped signal never cost you a session.
// Training history lives in localStorage and is never touched here.
const CACHE = 'bulletproof-v2';
const ASSETS = ['./', './index.html', './icon-180.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  // one asset failing on a weak signal must not stop the page itself being cached
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so a freshly pushed program wins, but a weak gym signal gets 1.5s before the saved copy opens instead.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const net = fetch(e.request).then(res => {
    if (res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  const saved = () => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'));
  e.respondWith(new Promise(done => {
    let settled = false;
    const give = r => { if (!settled && r){ settled = true; done(r); } };
    const t = setTimeout(() => saved().then(hit => { if (hit) give(hit); }), 1500);
    net.then(r => { clearTimeout(t); give(r); })
       .catch(() => { clearTimeout(t); saved().then(hit => give(hit || Response.error())); });
  }));
});
