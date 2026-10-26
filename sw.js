/* Service worker Portal LMS SMK CALM
 * - Cangkang aplikasi (index.html, config.js, ikon) disimpan di perangkat agar cepat dibuka dan tetap tampil saat sinyal lemah.
 * - Permintaan ke layanan data (Google Apps Script) TIDAK pernah dicegat atau disimpan: data selalu diambil langsung dari server.
 * Naikkan VERSI setiap kali index.html atau berkas statis lain diperbarui di hosting. */
const VERSI = 'lms-v4';
const CANGKANG = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-152.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const BATAS_HALAMAN = 3000; /* ms menunggu jaringan sebelum memakai salinan tersimpan */

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

/* Simpan salinan; ikut dalam waitUntil agar tidak terputus saat worker dihentikan. Respons 206/gagal dilewati. */
function simpan(e, c, key, r) {
  if (!r || !(r.ok || r.type === 'opaque') || r.status === 206) return;
  e.waitUntil(c.put(key, r.clone()).catch(function () {}));
}
/* Halaman: ambil dari jaringan; bila lebih dari 3 detik atau gagal, pakai salinan tersimpan. */
async function halaman(e, req) {
  const c = await caches.open(VERSI);
  const net = fetch(req).then(function (r) { simpan(e, c, 'index.html', r); return r; });
  net.catch(function () {});
  const lama = (await c.match('index.html')) || (await c.match('./'));
  if (!lama) return net;
  return Promise.race([net, new Promise(function (ok) { setTimeout(function () { ok(lama); }, BATAS_HALAMAN); })]).catch(function () { return lama; });
}
/* Berkas yang harus selalu segar (mis. config.js berisi alamat layanan): jaringan dahulu, salinan sebagai cadangan. */
async function jaringanDulu(e, req) {
  const c = await caches.open(VERSI);
  try { const r = await fetch(req); simpan(e, c, req, r); return r; }
  catch (x) { const y = await c.match(req); if (y) return y; throw x; }
}
/* Berkas statis lain: tampilkan salinan tersimpan lalu perbarui di latar belakang. */
async function sambilPerbarui(e, req) {
  const c = await caches.open(VERSI), x = await c.match(req);
  const net = fetch(req).then(function (r) { simpan(e, c, req, r); return r; }).catch(function () { return x || Response.error(); });
  if (x) { e.waitUntil(net); return x; }
  return net;
}
/* Gambar logo & font: salinan tersimpan dipakai langsung (jarang berubah), diunduh sekali saja. */
async function cacheDulu(e, req) {
  const c = await caches.open(VERSI), x = await c.match(req);
  if (x) return x;
  const r = await fetch(req); simpan(e, c, req, r); return r;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(halaman(e, req)); return; }
    if (/\/(config\.js|manifest\.webmanifest|sw\.js)$/.test(u.pathname)) { e.respondWith(jaringanDulu(e, req)); return; }
    e.respondWith(sambilPerbarui(e, req));
    return;
  }
  if (u.hostname === 'fonts.gstatic.com' || u.hostname === 'blogger.googleusercontent.com') { e.respondWith(cacheDulu(e, req)); return; }
  if (u.hostname === 'fonts.googleapis.com') { e.respondWith(sambilPerbarui(e, req)); return; }
  /* Selain itu (termasuk script.google.com) dibiarkan langsung ke jaringan. */
});
