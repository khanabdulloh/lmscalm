/* Service worker Portal LMS SMK CALM
 * - Cangkang aplikasi (index.html, config.js, ikon) disimpan di perangkat agar cepat dibuka dan tetap tampil saat sinyal lemah.
 * - Permintaan ke layanan data (Google Apps Script) TIDAK pernah dicegat atau disimpan: data selalu diambil langsung dari server.
 * - Ketukan pada notifikasi perangkat (pushShow di index.html) membuka atau memfokuskan kembali aplikasi.
 * Naikkan VERSI setiap kali index.html atau berkas statis lain diperbarui di hosting. */
const VERSI = 'lms-v20';
/* './' sengaja tidak disertakan: halaman utama disimpan sekali dengan kunci 'index.html' (hemat satu unduhan ±500 KB saat pemasangan). */
const CANGKANG = ['index.html', 'config.js', 'manifest.webmanifest', 'icon-152.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const BATAS_HALAMAN = 3000; /* ms menunggu jaringan sebelum memakai salinan tersimpan (halaman utama) */
const BATAS_KONFIG = 2500;  /* ms yang sama untuk config.js; berkas ini dimuat sebagai <script> yang memblokir sehingga tidak boleh menggantung */

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSI).then(function (c) {
    /* Satu berkas yang belum ada tidak boleh menggagalkan seluruh pemasangan. */
    return Promise.all(CANGKANG.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(Promise.all([
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('lms-') === 0 && k !== VERSI; }).map(function (k) { return caches.delete(k); }));
    }),
    /* Navigation preload: permintaan halaman berjalan paralel dengan proses menyalakan worker (terasa pada ponsel lambat). */
    self.registration.navigationPreload ? self.registration.navigationPreload.enable().catch(function () {}) : 0
  ]).then(function () { return self.clients.claim(); }));
});

/* Ketuk notifikasi: fokuskan jendela LMS yang sudah terbuka, atau buka yang baru. Tanpa ini ketukan tidak berbuat apa-apa. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (let i = 0; i < ws.length; i++) { if ('focus' in ws[i]) return ws[i].focus(); }
    return self.clients.openWindow('./');
  }));
});

function tunggu(ms, nilai) { return new Promise(function (ok) { setTimeout(function () { ok(nilai); }, ms); }); }
/* Respons layak dipakai: sukses, atau pengalihan yang harus diteruskan ke peramban apa adanya. */
function layak(r) { return !!r && (r.ok || r.type === 'opaqueredirect'); }

/* Simpan salinan; ikut dalam waitUntil agar tidak terputus saat worker dihentikan. Respons 206/gagal dilewati. */
function simpan(e, c, key, r) {
  if (!r || !(r.ok || r.type === 'opaque') || r.status === 206) return;
  e.waitUntil(c.put(key, r.clone()).catch(function () {}));
}
/* Halaman: ambil dari jaringan; bila lebih dari 3 detik, gagal, atau server membalas galat, pakai salinan tersimpan. */
async function halaman(e, req) {
  const c = await caches.open(VERSI);
  /* waitUntil didaftarkan sekarang (sinkron), bukan setelah respons tiba, agar penyimpanan tidak gagal bila worker sudah berhenti. */
  let putP = Promise.resolve();
  const net = Promise.resolve(e.preloadResponse).then(function (p) { return p || fetch(req); }).then(function (r) {
    if (r && r.ok && r.status !== 206) putP = c.put('index.html', r.clone()).catch(function () {});
    return r;
  });
  e.waitUntil(net.then(function () { return putP; }, function () {}));
  const lama = (await c.match('index.html')) || (await c.match('./'));
  if (!lama) return net;
  const baik = net.then(function (r) { return layak(r) ? r : lama; });
  return Promise.race([baik, tunggu(BATAS_HALAMAN, lama)]).catch(function () { return lama; });
}
/* Berkas yang harus selalu segar (config.js berisi alamat layanan): jaringan dahulu, tetapi dengan batas waktu.
   Tanpa batas, config.js yang menggantung di sinyal lemah menahan seluruh aplikasi karena dimuat sebelum skrip utama. */
async function jaringanDulu(e, req) {
  const c = await caches.open(VERSI), x = await c.match(req);
  const net = fetch(req).then(function (r) { simpan(e, c, req, r); return r; });
  if (!x) return net;
  e.waitUntil(net.catch(function () {}));
  return Promise.race([net.then(function (r) { return layak(r) ? r : x; }), tunggu(BATAS_KONFIG, x)]).catch(function () { return x; });
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
