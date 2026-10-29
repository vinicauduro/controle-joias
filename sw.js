// Busca sempre a versão nova quando há internet e usa a cópia guardada quando não há.
const CACHE = 'joias-v3';
const FILES = ['./', './index.html', './manifest.json', './config.js', './supabase.js', './nuvem.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(resp => {
      if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return resp;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
