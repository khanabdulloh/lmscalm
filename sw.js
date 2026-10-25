/* CALM LMS Service Worker
 * Versi cache dapat dinaikkan setiap kali aset inti berubah.
 * Request API eksternal tidak pernah disimpan dalam cache.
 */
const CACHE_VERSION = 'calm-lms-shell-v1';
const CORE_ASSETS = ['./manifest.webmanifest', './icons/icon-192.svg', './icons/icon-512.svg'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('calm-lms-shell-') && key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Jangan cache API, login, kiriman jawaban, atau sumber lintas-origin.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/config.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Coba dokumen terakhir yang tersimpan pada origin ini.
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          const pages = await cache.keys();
          const page = pages.find(item => item.mode === 'navigate' || /\.html?($|\?)/i.test(new URL(item.url).pathname));
          if (page) {
            const response = await cache.match(page);
            if (response) return response;
          }
        }
        return new Response('CALM LMS sedang offline. Hubungkan perangkat ke internet lalu muat ulang halaman.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Aset satu-origin: network-first agar perubahan kode cepat terambil,
  // cache dipakai sebagai fallback jika koneksi terputus.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
