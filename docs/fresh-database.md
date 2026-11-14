# Yeni yerel veritabanının hazırlanması

Bu akış yalnız Docker geliştirme veritabanı `betik_dev` içindir. Üretim verisi,
production ayarları ve önceki bölüm müziği çalışması korunur.

## Bulunan ve düzeltilen engeller

- Başlangıç betiği sınıflandırma verilerini çağırmıyordu. Eser biçimi ve tür
  zorunlu olduğu için yeni kitap oluşturulamıyor, tür tercihleri de seçilemiyordu.
  Yerel seed artık 27 biçim, 45 tür, 46 anlatım özelliği, 4 hedef kitle ve 7
  içerik uyarısını kanonik tanımlardan hazırlar.
- Rozet tanımları yalnız ayrı bir CLI betiğinde bulunuyordu. Puan verilse de
  rozet kazanılamıyordu. Ortak başlangıç servisi 10 rozeti ekler.
- Eski örnek taslak kitabın `description` alanı eksikti. GraphQL'deki zorunlu
  alan hatası kitap sorgusunu bozabiliyordu. Yalnız eski yerel örnek kayıtta
  eksik açıklama tamamlanır; yazılmış açıklama veya diğer düzenlemeler değişmez.
- Sınıflandırma yüklenirken, hata alındığında veya seçenekler boşken formlar
  sessizce kullanıma açık kalıyordu. Oluşturma/düzenleme ekranları artık durumu
  açıklar, yeniden deneme sağlar ve kullanılamayan seçimlerle kayıt yapmaz.
- Standalone MongoDB, basım kapalıyken sağlıklı görünebiliyordu; takip ve bölüm
  puanları yine transaction kullandığı için sonradan hata veriyordu. Sunucu ve
  doctor artık tüm uygulama için replica set/mongos gereksinimini kontrol eder.
- Dış servisler kapalıyken zorunlu kapak yüklenemiyordu. Docker geliştirmede
  "Yerel örnek kapağı kullan" düğmesi sunulur; kapak seçimi ve diğer alanların
  doğrulaması korunur. Üretim ekranına geliştirme kapağı eklenmez.
- Dış servisler kapalıyken kayıt doğrulama ve parola sıfırlama çalışmıyordu.
  Docker-only yerel e-posta arşivi, kod/bağlantıyı değiştirmeden özel `.eml`
  dosyalarına kaydeder. Kod doğrulaması ve tek kullanımlık bağlantılar korunur.
- Yönetici ilişki seçimleri için yükleniyor/boş/hata/yeniden dene durumları ve
  zorunlu ilişki alanı doğrulaması tamamlandı. Basım tarifesi hata/yeniden dene
  davranışı da açık hale getirildi.

## Çalıştırma ve kontrol

Proje kökünden:

```bash
./dev up
./dev verify
```

Mevcut çalışan ortamda yalnız eksik başlangıç verilerini tamamlamak için:

```bash
./dev seed
./dev verify
```

Seed tekrar çalıştırılabilir: hesap parolaları, kitap metinleri, bölüm
görünürlüğü, yönetici tarafından değiştirilmiş/pasifleştirilmiş sınıflandırmalar,
rozet koşulları ve mevcut basım tarifeleri korunur. Silinen kanonik tanımlar
yeniden eklenir. Tüm zorunlu seçenekler bilerek pasifleştirilmişse seed bunları
yeniden açmaz; anlaşılır hata verir ve yönetici kararı gerekir.

`./dev verify` salt okunurdur: replica set, seçimler, rozetler, yerel yönetici,
sandbox tarife ve eksik kitap açıklamalarını kontrol eder. Gizli değer yazdırmaz.

## Otomatik regresyon

```bash
./dev test fresh
./dev test server
./dev test client
./dev test lint
```

`fresh` hedefi [kontrol betiğinde](../docker/checks.sh) ayrı olarak bulunur;
geçici replica set üzerinde sıfırdan başlangıç, gerçek kitap oluşturma, bölüm
ekleme, yayınlama, okuma, rozet kazanımı, seed tekrarı ve mevcut düzenlemelerin
korunmasını doğrular. Geliştirme veritabanını veya dış servisleri kullanmaz.

Google girişi, gerçek SMTP ve Cloudinary servislerinin sağlayıcı hesap/izin
kontrolleri veritabanı başlangıcından ayrıdır. Gerçek ödeme bu yerel ortamda
açılmaz; basım tarifesi yalnız örnek SANDBOX verisidir.

## E-postasız yerel kayıt denemesi

`DEV_EXTERNAL_INTEGRATIONS=false` olduğunda doğrulama ve parola sıfırlama
e-postaları `artifacts/development/mail/` altında özel `.eml` dosyalarıdır.
Kayıt formundan kod isteyin, oluşan en yeni dosyayı VS Code'da metin olarak
açıp içindeki kodu forma girin. Hiçbir gerçek alıcıya e-posta gönderilmez;
kod ve bağlantılar loglara veya herkese açık bir HTTP endpoint'ine yazılmaz.
Dosyaları paylaşmayın/Git'e eklemeyin. Dış servisler açıksa mevcut gerçek SMTP
akışı aynı kalır; yerel arşive otomatik düşüş yapılarak hata gizlenmez.

## Doğrulama sonucu

12 Kasım 2026 tarihinde yerel veritabanında `./dev verify` hazır sonucunu verdi;
başlangıç verileri mevcut içerikler silinmeden tamamlandı ve servisler sağlıklı
yeniden başladı. Üretim veritabanına işlem yapılmadı.

Geniş test koşuları backend'de 60, frontend'de 86 grubu taradı. Bu koşularda
bulunan başlangıç temizliği ve yeni form testi sorunları düzeltildi. Sonraki
odaklı çalışmalarda gerçek sunucu başlangıç grubu (3 test), yeni yerel kayıt
doğrulaması (1 test) ve sınıflandırma/yönetici formları (27 test) başarılı oldu.
Diğer gruplar geniş koşuda geçmişti; tüm geniş koşu son düzeltmelerden sonra
baştan tekrarlanmadı. Geçici MongoDB'nin bir başlatma zaman aşımı, ilgili kayıt
testi tek başına yeniden çalıştırılarak doğrulandı.

Backend/frontend lint hata vermedi; önceki 12 frontend uyarısı sürüyor.
Frontend üretim derlemesi başarılı. Gerçek SMTP/Google/Cloudinary sağlayıcı
hesaplarına otomatik deneme gönderilmedi ve fiziksel Android testi yapılmadı.
