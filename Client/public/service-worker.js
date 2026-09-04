/*
  Minimal service worker.

  Amaç: Bir gerçek offline önbellekleme stratejisi kurmak DEĞİL — sadece
  Chrome/Android'in "yüklenebilir" (installable) sayması için gereken
  "kayıtlı bir service worker + fetch event handler" şartını sağlamak.

  Bu yüzden fetch olayını dinliyoruz ama event.respondWith() ÇAĞIRMIYORUZ;
  bu da tarayıcının isteği normal ağ davranışıyla (her zamanki gibi)
  yönetmesi anlamına gelir. Yani canlıdaki siteye hiçbir davranışsal risk
  eklemiyor — sadece "kur" (install) davranışını mümkün kılıyor.

  İleride gerçek offline destek / önbellekleme eklemek isterseniz, bu
  dosyayı Workbox ile genişletmek en kolay yol olur.
*/

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Kasıtlı olarak boş — bkz. yukarıdaki açıklama.
});