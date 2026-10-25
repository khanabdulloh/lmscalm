/* Service worker Portal LMS SMK CALM
 * - Cangkang aplikasi (index.html, config.js, ikon) disimpan di perangkat agar cepat dibuka dan tetap tampil saat sinyal lemah.
 * - Permintaan ke layanan data (Google Apps Script) TIDAK pernah dicegat atau disimpan: data selalu diambil langsung dari server.
 * Naikkan VERSI setiap kali index.html atau berkas statis lain diperbarui di hosting. */
const VERSI = 'lms-v3';
const CANGKANG = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-152.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) {
    /* Satu berkas yang belum ada tidak boleh menggagalkan seluruh pemasangan. */
    return Promise.all(CANGKANG.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('lms-') === 0 && k !== VERSI; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Halaman: ambil dari jaringan; bila lebih dari 4 detik atau gagal, pakai salinan tersimpan. */
async function halaman(req) {
  const c = await caches.open(VERSI);
  const net = fetch(req).then(function (r) { if (r && r.ok) c.put('index.html', r.clone()); return r; });
  net.catch(function () {});
  const lama = (await c.match('index.html')) || (await c.match('./'));
  if (!lama) return net;
  return Promise.race([net, new Promise(function (ok) { setTimeout(function () { ok(lama); }, 4000); })]).catch(function () { return lama; });
}
/* Berkas yang harus selalu segar (mis. config.js berisi alamat layanan): jaringan dahulu, salinan sebagai cadangan. */
async function jaringanDulu(req) {
  const c = await caches.open(VERSI);
  try { const r = await fetch(req); if (r && r.ok) c.put(req, r.clone()); return r; }
  catch (e) { const x = await c.match(req); if (x) return x; throw e; }
}
/* Berkas statis lain: tampilkan salinan tersimpan lalu perbarui di latar belakang. */
async function sambilPerbarui(req) {
  const c = await caches.open(VERSI), x = await c.match(req);
  const net = fetch(req).then(function (r) { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(function () { return x; });
  return x || net;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(halaman(req)); return; }
    if (/\/(config\.js|manifest\.webmanifest|sw\.js)$/.test(u.pathname)) { e.respondWith(jaringanDulu(req)); return; }
    e.respondWith(sambilPerbarui(req));
    return;
  }
  if (u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSI).then(function (c) {
      return c.match(req).then(function (x) { return x || fetch(req).then(function (r) { if (r && r.ok) c.put(req, r.clone()); return r; }); });
    }));
  }
  /* Selain itu (termasuk script.google.com) dibiarkan langsung ke jaringan. */
});
