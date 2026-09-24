const CACHE = 'photosorter-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'share-inbox').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Web Share Target: stash shared images in a cache, then open the app.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll('photos');
      const inbox = await caches.open('share-inbox');
      let i = 0;
      for (const f of files) {
        if (!f || !f.size) continue;
        const key = new Request(`./share-inbox/${Date.now()}-${i++}-${f.name || 'shared.jpg'}`);
        await inbox.put(key, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg' } }));
      }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  // Network first for the page itself so updates land; cache first for everything else.
  if (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
    e.respondWith(fetch(e.request).then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; })));
});
