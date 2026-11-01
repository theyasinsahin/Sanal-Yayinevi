# Yayınevi sahibi rolü ve portalı

## Tasarım ve kapsam

`PUBLISHER`, üye özelliklerini koruyan ve `/publisher` portalına erişebilen ek bir roldür. Adminler de portalı kullanabilir. Kitap keşfi ve destek takibi salt okunurdur; yayınevi hesaplarına moderasyon, rol atama, basım onayı, kampanya açma/kapatma, özel başvuru belgesi veya ödeme/sipariş bilgisi yetkisi verilmez.

İlk sürüm bütün herkese açık dijital eserleri kapsar. Henüz yayınevi kuruluşu/kitap sahipliği ilişkisi bulunmadığından kitaplara yayınevi mülkiyeti veya münhasır erişim atamaz. Kitap/yazar araması ve destek filtreleri ilgili içerikleri bulmayı sağlar.

## Rol atama ve erişim

1. Admin hesabıyla **Yönetim → Kullanıcılar** ekranını açın.
2. Mevcut hesabın **Rol** alanını **Yayınevi sahibi (`PUBLISHER`)** seçin ve gerekçeyle kaydedin.
3. Rol değişikliği mevcut admin altyapısıyla işlem geçmişine yazılır ve `authVersion` artırılarak önceki oturumlar geçersiz kılınır. Kullanıcı tekrar giriş yapmalıdır.
4. Masaüstü ve mobil menüdeki **Yayınevi Portalı** bağlantısını kullanın.

Kayıt ve profil düzenleme API'leri rol seçimine izin vermez. Rolün kaldırılması, hesabın pasifleştirilmesi veya silinmesi sonraki sunucu isteğinde erişimi keser. Arayüz rolü oturum doğrulamasındaki `me.role` değerinden alır. Portal yanıtları Apollo önbelleğine kaydedilmez; istek hatasında önceki portal içeriği gizlenir.

## Liste ve tutarlar

- Yayımlanmış dijital kitaplar listelenir; taslaklar, silinen kitaplar, basılı kitaplar ve silinen/pasif/eksik yazarlara ait eserler dahil edilmez. Eski kitapların eksik `digitalStatus` alanı mevcut dijital yayın kurallarıyla yorumlanır.
- Kitap/yazar/kullanıcı adı araması en fazla 100 karakterdir, düzenli ifade karakterleri düz metin kabul edilir. Sayfalama varsayılan 20, en fazla 48 kayıttır. Sıralama yayın tarihi ve kimlikle kararlıdır.
- Her kitabın oluşturulma tarihi ve kimliğe göre en son `FundingCampaign` kaydı gösterilir. Filtreler: tüm kitaplar, kampanya açılmış kitaplar, halen desteğe açık kitaplar ve son kampanyası başarılı olan kitaplar. Süresi bitmiş `ACTIVE` kayıtlar desteğe açık filtresinde gösterilmez.
- Destek tutarı `acceptedMinor`, hedef `targetMinor` alanından kuruş cinsinden okunur. Rezervasyonlar ve eski `Book.currentFunding`/`fundingTarget` alanları bu hesaba katılmaz. İade edilen destekler mevcut finansal sistemdeki net kabul edilmiş tutara göre görünür. Sandbox kayıtları açıkça test kampanyası olarak etiketlenir.
- Sayfa açıkken 30 saniyelik aralıklarla sunucudan yenilenir; gizli sekmede otomatik sorgu durur. **Yenile** anında yeni sorgu yapar. Bu mekanizma anlık sunucu yayını değildir; ekranda son yenileme zamanı gösterilir.

## Uygulama

`publisherCatalog` GraphQL sorgusu her istekte aktif `PUBLISHER`/`ADMIN` rolünü veritabanından doğrular. Ayrı özet tipleri kullanır; mevcut `Book`, `User` veya yönetim alanları üzerinden özel verilere geçiş sunmaz. Tek aggregate sorgusu kitap, aktif yazar ve son kampanyayı birleştirir. Tüm kitaplar filtresinde kampanyalar yalnızca istenen sayfa için yüklenir. Kampanya filtreleri sayfalama ve sayımdan önce uygulanır.

Mevcut kullanıcılar için migration gerekmez; varsayılan rol `USER` kalır. `FundingCampaign` için `{ bookId: 1, createdAt: -1, _id: -1 }` indeksi son kampanya okumasını destekler. İndekslerin otomatik oluşturulmadığı ortamlarda bu ek indeks normal dağıtım prosedürüyle oluşturulmalıdır. Portal ödeme sağlayıcısını, worker'ı veya canlı tahsilatı etkinleştirmez. Bu geliştirmede üretim veritabanında işlem yapılmamıştır.

Dağıtım sırası: sunucu şeması ve yeni rol desteği, ek okuma indeksi, ardından istemci. Yayınevi rollerini iki uygulama da güncellendikten sonra atayın.

Çalışma branch'i `feature/publisher-portal` olarak oluşturuldu. Uzak `develop` güncellendikten sonra da başlangıç sürümünün 37 commit gerisinde kaldığından, güncel basım ve yetki altyapısını korumak için `develop` geçmişini içeren mevcut `fix/profile-funding-history` sürümü taban alındı. Commit, push veya merge yapılmadı.

## Doğrulama

```powershell
npm.cmd --prefix Server run test:ci -- tests/publisherPortal.test.js tests/authentication.test.js tests/adminManagement.test.js tests/clientGraphqlDocuments.test.js
npm.cmd --prefix Client run test:ci -- --runTestsByPath src/pages/PublisherPortal/PublisherPortal.test.jsx src/components/Route/PublisherRoute.test.jsx src/components/Route/AdminRoute.test.jsx src/context/AuthContext/AuthContext.test.jsx src/components/Navigation/NavigationBar/NavigationBar.test.jsx
npm.cmd --prefix Client run test:e2e -- publisher-portal.spec.cjs
npm.cmd --prefix Client run build
```

Sunucu testleri geçici MongoDB replica set kullanır; tarayıcı testleri sentetik oturum ve yakalanmış API yanıtlarıyla masaüstü/mobil yerleşimi kontrol eder. Tarayıcı testleri gerçek ödeme sağlayıcısını veya üretim verilerini kullanmaz.

### 01.11.2026 sonucu

- Sunucu genel regresyon paketi: 39 dosyada **623 test geçti**.
- İstemci genel regresyon paketi: 72 dosyada **476 test geçti**.
- Yeni portalın masaüstü/mobil tarayıcı kontrolleri: **4 test geçti**; ekran görüntüleri ayrıca incelendi.
- Son kaynaklarla üretim derlemesi başarılı. Mevcut mesajlaşma/giriş/alıntı dosyalarının lint uyarıları ve mevcut bağımlılık uyarıları devam ediyor; değiştirilen dosyalar için yeni derleme uyarısı yok.
- `git diff --check` başarılı.

Genel regresyon paketleri `npm.cmd --prefix Server run test:ci -- --silent` ve `npm.cmd --prefix Client run test:ci -- --silent` komutlarıyla çalıştırıldı.

### Oturum doğrulamasından sonra portal erişiminin kaybolması

Giriş yanıtı admin rolünü taşıdığı halde `ME_QUERY` yalnızca `id` ve `email` alanlarını seçiyordu. Oturum yeniden doğrulandığında eksik `role` alanı istemcide `USER` olarak yorumlanıyor ve portal erişimi kayboluyordu. Sorguya `role` eklendi.

Önceki mock yanıtlar, sorgu istemese de `role` döndürdüğünden bu sorun testlerden kaçmıştı. Yeni sunucu regresyon testleri gerçek istemci `ME_QUERY` belgesini gerçek GraphQL şemasında çalıştırarak `ADMIN`, `PUBLISHER` ve `USER` rollerini doğrular. Tarayıcı oturum testleri de gerçek GraphQL alan seçimini uygular; adminin sayfaya dönüş/focus doğrulaması ve doğrudan `/publisher` erişimi masaüstü ve mobilde kontrol edilir.

Düzeltme sonrası ilgili 205 sunucu testi, 39 arayüz testi ve 6 tarayıcı testi geçti. Üretim derlemesi başarılı; mevcut bağımlılık/lint uyarıları devam ediyor. Bu düzeltme için veritabanı veya kullanıcı rolü değişikliği gerekmez; sayfa yenilendiğinde rol sunucudan tekrar alınır.
