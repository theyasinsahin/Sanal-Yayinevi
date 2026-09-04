// Bu dosya CRA'nın standart service-worker kayıt yardımcısının
// sadeleştirilmiş bir sürümüdür. Amaç: production build'de
// public/service-worker.js dosyasını tarayıcıya kaydetmek — bu, PWA
// "yüklenebilirlik" (installable) şartlarından biri.
//
// Geliştirme ortamında (npm start) KAYIT YAPMIYORUZ; aksi halde eski
// bir service worker geliştirme sırasında önbelleğe takılıp kafa
// karıştırabilir.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function register() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      // Localhost'ta önce service worker'ın gerçekten var olup
      // olmadığını kontrol ediyoruz (bozuk bir kayıttan kaçınmak için).
      checkValidServiceWorker(swUrl);
    } else {
      registerValidSW(swUrl);
    }
  });
}

function registerValidSW(swUrl) {
  navigator.serviceWorker
    .register(swUrl)
    .catch((error) => {
      console.error('Service worker kaydı başarısız oldu:', error);
    });
}

function checkValidServiceWorker(swUrl) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister();
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log('İnternet bağlantısı yok, uygulama offline modda çalışıyor.');
    });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => registration.unregister())
    .catch((error) => console.error(error.message));
}