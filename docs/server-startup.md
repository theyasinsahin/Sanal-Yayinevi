# Sunucuyu başlatma ve bağlantı kontrolü

Proje en az Node.js 22.15.0 ister. `node --version` ile kullanılan sürümü
kontrol edin. Node.js güncellendikten sonra terminali yeniden açın.

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
  mongos gerektirir; standalone yeterli değildir.
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
| `NODE_VERSION` | Node.js sürümünü proje gereksinimine yükseltin. |
| `STARTUP_CONFIG_INVALID` | Mesajdaki eksik/değersiz ortam değişkenlerini düzeltin. |
| `PORT_IN_USE` | İlgili servisi durdurun veya portu değiştirin; değişirse istemci API/WS adreslerini de güncelleyin. |
| `MONGO_URI_INVALID` | Bağlantı adresinin biçimini ve seçeneklerini kontrol edin. |
| `MONGO_AUTH_FAILED` | Atlas Database Access kullanıcısını, parolayı ve `authSource` ayarını kontrol edin. URI parolasındaki özel karakterleri URL kodlayın. Atlas hesap parolası ile veritabanı parolası farklı olabilir. |
| `MONGO_UNREACHABLE` | MongoDB servisi, DNS, ağ erişimi ve Atlas IP erişim listesini kontrol edin. |
| `MONGO_TLS_FAILED` | Sistem saati ve sertifika zincirini kontrol edin. |
| `MONGO_REPLICA_SET_REQUIRED` | Replica set/mongos kullanın. Basım kullanılmayacaksa `PRINT_SYSTEM_ENABLED=false` ve `PRINT_PAYMENTS_MODE=DISABLED` ayarlayın. |
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
