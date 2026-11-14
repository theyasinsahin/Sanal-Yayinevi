# Sunucuyu başlatma ve bağlantı kontrolü

Proje Node.js **26.x** ve npm **11.x** kullanır. Yerel hedef sürümler
**Node.js 26.13.0 / npm 11.13.0** olarak ayarlanmıştır. `node --version` ve
`npm.cmd --version` ile kullanılan sürümleri kontrol edin. Node.js
güncellendikten sonra terminali yeniden açın.

Proje ana klasöründe (`Betik`) komutlar:

```powershell
npm.cmd --prefix Server ci
npm.cmd --prefix Server run doctor
npm.cmd --prefix Server start
```

Zaten `Server` klasöründeyseniz `--prefix Server` eklemeyin:

```powershell
npm.cmd ci
npm.cmd run doctor
npm.cmd start
```

`Server/Server/package.json` için ENOENT hatası, `Server` klasöründeyken
tekrar `--prefix Server` kullanılmasından kaynaklanır.

## Yapılandırma

Mevcut `Server/.env` dosyasını koruyun. İlk kurulumda dosya yoksa
`Server/.env.example` şablonunu kopyalayın ve kendi değerlerinizi girin.
Şablondaki yerel MongoDB adresi çalışan bir veritabanı oluşturmaz.

- `MONGO_URI`: çalışan MongoDB bağlantısı. Basım işlemleri replica set veya
  mongos gerektirir; bölüm puanları ve takip de transaction kullandığı için standalone yeterli değildir.
- `JWT_SECRET`: en az 32 bayt uzunluğunda, uygulamaya özel rastgele anahtar.
- `CLIENT_URL`: istemcinin origin adresi; örneğin `http://localhost:3000`.
  Yol eklemeyin; üretimde HTTPS kullanın.
- `PORT`: 1–65535 arasında boş bir port; varsayılan 5000.

Geliştirmede `Server/.env`, ardından eksik değerler için
`Server/.env.print.local` okunur. İşletim sistemi ortam değişkenleri dosyalara,
`.env` değerleri de `.env.print.local` değerlerine önceliklidir.
Üretimde yalnız `Server/.env.prod` yüklenir. `NODE_ENV=test` olduğunda yerel
secret dosyaları yüklenmez; izole sandbox da kendi geçici ayarlarını kullanır.
`Client/.env`, sunucu yapılandırmasının yerine geçmez.

Mevcut JWT veya adres şifreleme anahtarlarını sırf başlangıç hatasını gidermek
için yenilemeyin. Gerçek bağlantı adreslerini ve API anahtarlarını örnek
dosyalara yazmayın; `.env` dosyaları Git tarafından yok sayılır.

## Doctor sonuçları

`doctor`, yapılandırmayı, Node.js sürümünü, portu ve MongoDB bağlantısını
kontrol eder. Ayrı bir bağlantıyla yalnız okuma yapar; seed, indeks oluşturma,
ödeme veya e-posta gönderimi yapmaz. Portu kısa süreli dinleyerek boş olduğunu
kontrol ettiği için normal sunucu kapalıyken çalıştırın. Hata durumunda çıkış
kodu 1 olur; bütün kritik kontroller başarılıysa 0 olur.

| Sonuç | Yapılacak işlem |
| --- | --- |
| `NODE_VERSION` | `.node-version` dosyasındaki Node.js 26.13.0 sürümünü kullanın. |
| `STARTUP_CONFIG_INVALID` | Mesajdaki eksik/değersiz ortam değişkenlerini düzeltin. |
| `PORT_IN_USE` | İlgili servisi durdurun veya portu değiştirin; değişirse istemci API/WS adreslerini de güncelleyin. |
| `MONGO_URI_INVALID` | Bağlantı adresinin biçimini ve seçeneklerini kontrol edin. |
| `MONGO_AUTH_FAILED` | Atlas Database Access kullanıcısını, parolayı ve `authSource` ayarını kontrol edin. URI parolasındaki özel karakterleri URL kodlayın. Atlas hesap parolası ile veritabanı parolası farklı olabilir. |
| `MONGO_UNREACHABLE` | MongoDB servisi, DNS, ağ erişimi ve Atlas IP erişim listesini kontrol edin. |
| `MONGO_TLS_FAILED` | Sistem saati ve sertifika zincirini kontrol edin. |
| `MONGO_REPLICA_SET_REQUIRED` | Replica set/mongos kullanın. Bölüm puanları ve takip işlemleri de transaction kullanır; basımı kapatmak bu gereksinimi kaldırmaz. |
| `MONGO_INDEX_CONFLICT` | Mevcut veri ve indeksleri inceleyin; veritabanını veya indeksleri otomatik silmeyin. |

SMTP ve Google ayarı uyarıları sunucunun başlamasını engellemez; ilgili
özelliklerin çalışması için `EMAIL_USER`/`EMAIL_PASS` ve `GOOGLE_CLIENT_ID`
değerleri gerekir. Sandbox ödemesi ayrıca kendi sağlayıcı ayarlarını ister.

Doctor bağlantısının başarılı olması bütün uygulamanın başlatıldığını göstermez.
`npm.cmd start` sonrası `Server hazır` mesajını ve HTTP isteğini kontrol edin.
Proje ana klasöründen örnek sağlık sorgusu:

```powershell
Invoke-RestMethod -Uri http://localhost:5000 -Method Post -ContentType application/json -Body '{"query":"{ healthCheck }"}'
```

Gerçek hesap ve veritabanı bilgisi olmadan ayrı örnek ortamı denemek için
proje ana klasöründe `npm.cmd --prefix Server run sandbox:print` kullanılabilir.
Bu ortamın verileri geçicidir. Yalnız HTTP akışını doğrulamak için
`npm.cmd --prefix Server run sandbox:print:verify` çalıştırın; normal `.env`
ve üretim veritabanı kullanılmaz.

## Render dağıtımı

Render servisi için **Root Directory** `Server`, **Build Command** `npm ci`,
**Start Command** `npm start` olmalı. `.node-version` dosyaları hem depo kökünde
hem `Server` klasöründe Node.js **26.13.0** sürümünü seçer. Render Environment
içinde ayrıca `NODE_VERSION` tanımlıysa bu değer dosyalardan önceliklidir;
onu da `26.13.0` yapın veya dosyadaki seçimin kullanılması için kaldırın.
`package.json` içindeki `engines.node: "26.x"`, sonraki ana sürümlere
kendiliğinden geçilmesini önler. npm hedefi `packageManager: "npm@11.13.0"`,
uyumlu npm ana sürümü `engines.npm: "11.x"` olarak belirtilmiştir.

İstemcide de aynı Node.js/npm hedefleri kullanılır. Vercel, istemcinin
`engines.node: "26.x"` değerine göre Node.js 26 serisini seçebilir;
Vercel'de alt/yama sürümleri platform tarafından yönetildiğinden yereldeki
26.13.0 ile birebir aynı yama sürümü garanti edilmez.
Bkz. [Vercel Node.js sürümleri](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

`MONGO_AUTH_FAILED` ile kapanıyorsa şu sırayı izleyin:

1. Render servisinin **Environment** bölümünde `MONGO_URI` değerini güncelleyin.
   Yerelde bağlantısı doğrulanmış `Server/.env` içindeki bağlantı adresini,
   değişken adı ve dış tırnaklar olmadan Value alanına koyun. Yerel `.env`
   dosyasını değiştirmek veya Git'e push yapmak Render Environment değerini
   değiştirmez. Render değişkeni varsa `.env.prod` dosyasından da önceliklidir.
2. Atlas kullanıyorsanız bağlantının doğru cluster'a ve **Database Access**
   kullanıcısına ait olduğunu doğrulayın. Atlas web hesabı parolasını kullanmayın.
   URI parolasındaki özel karakterler bir kez URL kodlanmış olmalı;
   `authSource` kullanıcının tanımlı olduğu veritabanıyla eşleşmeli. Atlas SCRAM
   veritabanı kullanıcılarında bu genellikle `admin` olur.
3. Diğer zorunlu Render değişkenlerini koruyun: `NODE_ENV=production`, mevcut
   `JWT_SECRET` ve HTTPS frontend origin'ini içeren `CLIENT_URL`. Ortam dosyalarını
   veya gerçek bağlantı adreslerini Git'e eklemeyin.
4. Yalnız ortam değişkenlerini değiştirdiyseniz **Save and deploy** kullanın.
   Node sürüm dosyaları gibi kaynak değişiklikleri için commit'i push ettikten
   sonra yeni build/deploy başlatın. **Save only** değişikliği çalışan servise
   uygulamaz.
5. Logda önce `MongoDB bağlantısı başarılı.`, sonra `Server hazır` mesajını
   kontrol edin. HTTP sağlık sorgusunu Render servis adresinde çalıştırın.

Veritabanı doğrulaması tamamlanmadan uygulama HTTP portunu açmaz. Bu nedenle
kimlik doğrulama hatasının ardından görülen `No open ports detected` mesajı
ikincil sonuçtur. Uygulama zaten Render'ın `PORT` değişkenini kullanır; bu hatayı
gidermek için rastgele bir port tanımlamak gerekmez.

Kaynaklar: [Render Node sürümü](https://render.com/docs/node-version),
[Render ortam değişkenleri](https://render.com/docs/configure-environment-variables),
[Atlas bağlantı sorunları](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).
