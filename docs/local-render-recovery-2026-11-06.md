# Yerel sunucu ve Render kontrolü — 6 Kasım 2026

Yerel sunucu `fix/render-server-deploy` dalına geri alındı. Katalog dosyaları ve hazırlanan 254 kitaplık paket korundu. Yerel onarım sırasında commit, push, merge veya kitap aktarımı yapılmadı.

Katalog çalışması için eski `develop` tabanına geçilince Apollo 4 kullanan kaynak kod, kurulu Apollo 5.5.1 paketleriyle uyumsuz hale gelmişti. Eski dal ayrıca `Server/.env` dosyasını Git'te takip ediyordu ve eski bağlantı değeri çalışma kopyasına geri gelmişti. Güncel dal Apollo 5 için `@as-integrations/express4` kullanıyor ve yerel `.env` dosyasını takip etmiyor.

`Server/.env.example.backup-20261106` içindeki MongoDB bağlantısı ayrı, modelsiz bir bağlantıyla salt okunur doğrulandı. İki bilinen kitap kimliği/başlığı hedef veritabanıyla eşleşti. Bu doğrulanan bağlantı yalnız yerel `Server/.env` içindeki `MONGO_URI` alanına geri kondu. Diğer mevcut yerel anahtarlar değiştirilmedi. Gerçek bağlantı değerleri bu raporda, örnek dosyalarda veya Git değişikliklerinde bulunmaz.

`http://localhost:5000` ve `http://127.0.0.1:5000` üzerinde GraphQL `{ healthCheck }` sorgusu HTTP 200 döndürdü. 5000 portunda bu projeye ait, nodemon tarafından çalıştırılan sunucu var. Sunucu açıkken `doctor` komutunun `PORT_IN_USE` vermesi ikinci bir sunucunun aynı porta bağlanamayacağını belirtir; çalışan API'nin başarısız olduğu anlamına gelmez.

Canlı frontend'in güncel `main.fb3b9662.js` paketinde API adresi `https://sanal-yayinevi.onrender.com` olarak bulundu. API'ye önbelleksiz yeni sağlık ve katalog sorguları gönderildi: ikisi de HTTP 200 döndürdü ve katalog sorgusunda mevcut 7 basılı kitap geldi. Bu kontrol tarayıcıdaki eski görünümden bağımsızdır.

Render'da başarısız bir yeni dağıtım varken önceki başarılı örnek çalışmaya devam edebilir; [Render dağıtım belgeleri](https://render.com/docs/deploys) bu davranışı açıklar. Bu, mevcut gözlemle uyumlu bir açıklamadır; başarısız dağıtımın gerçek nedeni günlükleri görülmeden kesinleşmez. Render günlükleri ve servis ayarları için kullanıcı bağlantısı bekleniyor.

Başlangıç doğrulaması ve gerçek sunucu giriş noktasını geçici MongoDB ile başlatan iki test dosyasında 21 test geçti:

```powershell
npm.cmd --prefix Server run test:ci -- tests/startupConfiguration.test.js tests/securityStartup.test.js
```

Makinedeki Node 22.14.0, projenin `>=22.15.0` gereksiniminin altındaydı. Resmî Node 22.23.4 kurulum dosyası [yayın özeti](https://nodejs.org/download/release/latest-v22.x/SHASUMS256.txt) ve OpenJS Foundation dijital imzasıyla doğrulandı. Standart Windows yönetici onayıyla güncelleme başarıyla tamamlandı (kurulum çıkış kodu 0); yeniden başlatma gerekmedi. Yeni `node --version` çıktısı `v22.23.4`.

Güncellemeden sonra varsayılan portla `npm.cmd --prefix Server run doctor` tamamen başarılı oldu: Node sürümü, zorunlu yapılandırma, port ve MongoDB replica set bağlantısı geçti. Yerel nodemon sunucusu yeni Node ile arka planda yeniden başlatıldı; `localhost:5000` sağlık ve katalog sorgusu HTTP 200 / mevcut 7 basılı kitap sonucuyla doğrulandı. Süreç bilgileri ve stdout/stderr günlükleri Git dışında `.catalog-research/local-server-*` dosyalarında tutulur.

Yeni Node sürümünde başlangıç ve korunan katalog paketi için dört test dosyasında 39 test geçti:

```powershell
npm.cmd --prefix Server run test:ci -- tests/startupConfiguration.test.js tests/securityStartup.test.js tests/printedCatalogImport.test.js tests/printedCatalogData.test.js
```

Render'ın son başarısız dağıtımına ait günlükler henüz alınamadı; kullanıcı Render bağlantısını kuracağını belirtti. Daha sonraki açık talimatıyla 254 kitaplık paket 6 Kasım 2026'da canlı kataloğa aktarıldı ve canlı API'de doğrulandı; [aktarım sonucu](printed-catalog-live-result-2026-11-06.json) ayrı raporlandı.

Eski dallara geçmeden önce yerel yapılandırma korunmalı. `.gitignore` içinde bir dosyanın yazması, eski commit'te zaten takip edilen dosyanın checkout sırasında geri gelmesini engellemez. Eski dalda `git ls-files Server/.env` çıktı veriyorsa bu dala geçiş yerel `.env` dosyasını değiştirebilir. Gelecek katalog çalışmaları güncel sunucu değişikliklerini kaybetmeden sürdürülmeli.
