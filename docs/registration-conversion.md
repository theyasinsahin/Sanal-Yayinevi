# Misafir okuma ve ücretsiz kayıt

Her kitabın ilk açık bölümü misafirlere sunulur. Sonraki açık bölümler için kayıt veya giriş gerekir. Gizli bölümlerin yazar/yönetici izinleri ayrıca korunur. Katalog, arama, kitap açıklamaları ve herkese açık alıntılar açık kalır.

## Etkinleştirme ve geri alma

Sunucuda `REGISTRATION_GATE_ENABLED=true` olduğunda okuma sınırı uygulanır. Değişken belirtilmezse veya `false` ise açık bölümler önceki gibi okunabilir. Önce yeni sunucu, ardından yeni istemci yayımlanmalı; bayrak bundan sonra açılmalıdır. Ortam değişkeni değiştirildiğinde sunucu yeniden başlatılmalıdır. Bayrağın kapatılması hesap veya ilerleme verisi silmez. Bu çalışma canlı ortama dağıtım yapmaz.

Migration, harici analiz servisi, olay koleksiyonu ve zamanlanmış görev gerekmez. İlk açık bölüm istek kapsamında kitap başına DataLoader ile hesaplanır; bölüm başına sorgu üretilmez. Mevcut bölüm indeksi kullanılır.

Yerel kullanımda ayarı sunucunun gerçekten okuduğu `Server/.env` dosyasına `REGISTRATION_GATE_ENABLED=true` olarak ekleyip çalışan API'yi yeniden başlatın. Yalnız `Server/.env.example` dosyasını değiştirmek mevcut yerel sunucuyu etkinleştirmez. İstemcinin de yerel API'ye bağlandığını kontrol edin.

## API

- `Chapter.accessStatus`: `READABLE`, `REGISTRATION_REQUIRED`, `HIDDEN`, `UNAVAILABLE`. Mevcut `canReadContent` alanı korunur. Okunamayan metin `content: ""` döner.
- `registerAndLogin`: mevcut kayıt girdilerini alır; `code`, `message`, nullable `token` ve `user` döner. Eski `register` korunur. İki işlem aynı kayıt hız sınırını paylaşır.
- Başarılı doğrulamadan sonra oturum açılır. Hesap oluşturulup token üretilemezse hesap korunur ve giriş bağlantısı gösterilir.

## Dönüş ve taslaklar

Kayıt daveti kullanıcı eylemiyle açılır. Dönüş bilgisi sekmeye özel `sessionStorage` içinde 30 dakika tutulur. Yorum/al­ıntı taslakları korunur; parola, kod ve token bu bağlamda saklanmaz. Giriş/kayıt bağlantılarında güvenli uygulama içi `returnTo` parametresi yedek olarak taşınır. Google dönüşü mevcut nonce doğrulamasını korur.

Bölüm otomatik açılır. Kaydetme, takip, beğeni, yorum, alıntı ve ayraç için kullanıcı tekrar onay verir. Yalnızca yeni hesaba bu kitaba ait misafir ilerlemesi aktarılır; mevcut hesapla birleştirme veya geriye dönük puanlandırma yapılmaz.

Tarayıcı depolaması engellendiğinde taslak kurtarma garanti edilmez. Yerel depolama engelliyse giriş sayfa ömrü boyunca bellekte çalışır; sayfa yenilendiğinde yeniden giriş gerekebilir. Google'ın mevcut nonce/cookie gereksinimleri devam eder.

## Doğrulama

Sunucuda `registrationGate.test.js`, tüm bölüm sorgularını, ilk açık bölüm sırasını, gizli içerik izinlerini, bayrağı, otomatik oturumu ve ortak hız sınırını kapsar. İstemcide dönüş bağlamı, pencere erişilebilirliği, okuyucu geçişleri ve kayıt akışı test edilir. Playwright testleri masaüstü ve mobilde misafirden kayıtlı okumaya geçişi doğrular.

Kayıt sayıları mevcut kullanıcı kayıtlarından karşılaştırılabilir; bu sürüm davet kaynaklarına göre dönüşüm oranı hesaplamaz.

Son doğrulamada sunucu 53 grup / 816 test, istemci 81 grup / 668 test ve masaüstü/mobil 10 Playwright senaryosu geçti. İstemcinin tam paketi, eşzamanlı yük altında mevcut mesajlaşma testinde görülen 5 saniyelik zaman aşımından sonra tek başına `--testTimeout=15000` ile doğrulandı; test mantığı değiştirilmedi.

```powershell
npm.cmd --prefix Server run test:ci -- --silent
npm.cmd --prefix Client run test:ci -- --silent --testTimeout=15000
npm.cmd --prefix Client run test:e2e -- book-reader.spec.cjs --grep "guest chapter|direct locked|reader fits|chapter reading remains|paragraph mention"
npm.cmd --prefix Client run build
```
