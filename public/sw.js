const C = 'app-v1', SH = 'share-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/manifest.json'])));
  self.skipWaiting();
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.pathname === '/share-target') {
    e.respondWith((async () => {
      const fd = await e.request.formData();
      const c = await caches.open(SH);
      for (const k of await c.keys()) await c.delete(k);
      let i = 0;
      for (const f of fd.getAll('images')) {
        if (f && f.size) await c.put('/shared/img' + i++, new Response(f, { headers: { 'Content-Type': f.type } }));
      }
      const t = ['title', 'text', 'url'].map(k => fd.get(k)).filter(Boolean).join('\n');
      if (t) await c.put('/shared/text', new Response(t));
      return Response.redirect('/?shared=1', 303);
    })());
    return;
  }
  if (e.request.method === 'GET' && u.origin === location.origin && !u.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
