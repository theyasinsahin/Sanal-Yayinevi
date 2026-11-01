# Kitap kartlarında destek ve Keşfet listeleri

## Kullanım

Güncel destek kampanyası açık olan dijital kitap kartları kabul edilmiş tutarı, hedefi ve tamamlanma yüzdesini gösterir: `123,45 TL / 1.000,00 TL hedef`, `Tamamlanma: %12,3`. Test kampanyaları ayrıca etiketlenir. Hedefini tamamlayan kartlarda dolu bar ve **Hedef tamamlandı** bilgisi görünür. Sonuç henüz uzlaştırılmamışsa **Kampanya sonucu doğrulanıyor** açıklaması eklenir.

Keşfet'in **Destek durumu** bölümünde:

- **Tüm kitaplar:** Mevcut genel katalog.
- **Desteği açık kitaplar:** Güncel kampanyası açık, başlamış, süresi dolmamış ve hedefine henüz ulaşmamış kitaplar.
- **Hedefini tamamlayan kitaplar:** Güncel kampanyasının net kabul edilmiş tutarı pozitif hedefine ulaşmış kitaplar. Başarılı kampanyalar ve hedefe ulaşıp kapanış/uzlaştırma bekleyen kampanyalar dahil edilir. İptal/iade/finansal inceleme kayıtları dahil edilmez.

**Hedefe en yakın** sıralaması desteği açık kitapları **kalan TL tutarı en az olandan** başlayarak listeler. Örneğin 50 TL kalan kitap, 100 TL kalan kitaptan önce gelir; hedef yüzdesi farklı olabilir. Bu sıralama seçilince destek filtresi otomatik olarak açık kampanyalara geçer. Tamamlananlar veya tüm kitaplar seçilince uyumsuz yakınlık sıralaması yeniler sıralamasına döner. Başlık/yazar/alıntı araması ve eser sınıflandırması bu listelerde de birlikte çalışır.

## Veri ve erişim

Finansal veri kaynağı `FundingCampaign.acceptedMinor` ve `targetMinor` alanlarıdır; kuruş cinsinden tam sayıdır. Rezervasyonlar kabul edilmiş desteğe eklenmez. Eski `Book.currentFunding`, `fundingTarget` ve `status=FUNDED` alanları yeni destek listelerine veya barlarına kaynak oluşturmaz.

Her kitabın oluşturulma tarihi ve kimliğe göre **en son kampanyası** kullanılır. Önceki başarılı kampanya, sonraki başarısız/iadeli kampanyayı gizleyemez. Açık kampanyalarda `startsAt`, `endsAt`, hedef, kabul edilmiş tutar ve finansal inceleme durumu kontrol edilir. Silinmiş/taslak/basılı kitaplar ve pasif/silinmiş/eksik yazarlara ait kampanyalar destek listelerinde yer almaz. Kart alanı da yayımlanmamış dijital eserlere veya pasif yazarlara destek özeti döndürmez.

`Book.fundingSummary` herkese açık, salt okunur bir özet tipidir. Başvuru belgeleri, ödeme/sipariş bilgileri ve özel operasyon alanları içermez. Bu özellik kullanıcı rolü veya ödeme yetkisi eklemez; canlı tahsilatı etkinleştirmez.

## Sorgu ve performans

`getBookFeed` yeni `funding: BookFundingFilter` (`ALL`, `ACTIVE`, `FUNDED`) parametresini ve `sort: CLOSEST_TO_TARGET` seçeneğini destekler. Tamamlananlar filtresi ile yakınlık sıralaması birlikte sunucuda reddedilir. Yakınlık sıralaması `ALL` ile istendiğinde açık kampanyalara uygulanır.

Destek filtreleri, son kampanya seçimi ve arama/sınıflandırma **sayfalamadan önce** uygulanır. Yakınlık tutarı eşitse kitap kimliğiyle kararlı sıralama yapılır. Cursor, destek filtresine, sıralamaya, aramaya ve sınıflandırmaya bağlıdır; farklı listelere taşınamaz. Sayfa boyutu sınırı 48 olarak korunur. Kampanya tutarları sayfalar arasında değişebildiğinden canlı liste sabit bir finansal snapshot değildir; istemci tekrar gelen kitapları kimlikle tekilleştirir.

Normal kart sorguları son kampanyaları istek başına DataLoader ile toplu okur; kart başına ayrı HTTP/DB sorgusu açılmaz. Destek filtresiyle gelen katalog, aynı aggregate sorgusunda zaten okuduğu kampanyayı alan resolver'ında tekrar yüklemez. Mevcut `{ bookId: 1, createdAt: -1, _id: -1 }` kampanya indeksi kullanılır. Anasayfa, Keşfet, öneriler, profil/kaydedilen/takip edilen kitaplar ve kimlikle yüklenen kartların sorgularına aynı özet fragment'i eklenmiştir.

Destek listesine girildiğinde sunucudan yeni veri alınır. Genel katalogdaki mevcut önbellek ve geri dönüş/sayfalama davranışı korunur. Kartlar için sürekli polling veya kart başına istek eklenmemiştir.

## Testler

Sunucu testleri gerçek GraphQL kart/katalog belgeleri ve geçici MongoDB replica set kullanır. Kuruş hesabı, rezervasyon/eski tutar ayrımı, son kampanya, açık/tamamlanmış/iptal/iadeli/süresi dolmuş/henüz başlamamış/incelemedeki kampanyalar, içerik görünürlüğü, arama+sınıflandırma birleşimi, sıralama, cursor sınırları ve sorgu sayısı kontrol edilir.

Arayüz testleri TL/yüzde metinlerini, erişilebilir barları, sıfır desteği, tamamlanma/uzlaştırma durumunu, geçersiz/kapalı kampanyalarda barın gizlenmesini, kimlikle kart yüklemeyi, filtre geçişlerini, aramayı ve daha fazla yükleme davranışını kapsar. Tarayıcı testleri masaüstü ve mobilde kartları, sıralama/filtre değişimini ve boş arama sonucunu sentetik API yanıtlarıyla kontrol eder.

```powershell
npm.cmd --prefix Server run test:ci -- tests/bookFundingCatalog.test.js tests/performance.test.js tests/classification.test.js tests/loaders.test.js tests/publisherPortal.test.js tests/bookFollow.test.js tests/clientGraphqlDocuments.test.js
npm.cmd --prefix Client run test:ci
npm.cmd --prefix Client run test:e2e -- funding-discovery.spec.cjs
npm.cmd --prefix Client run build
```

### 01.11.2026 doğrulaması

- İlgili 7 sunucu paketinde **267 test geçti**; yeni destek/katalog paketi 26 senaryo içeriyor.
- Genel arayüz taraması 73 dosyada 493 testi çalıştırdı. Yeni alanlarla uyumsuz iki test örneği güncellendi (`funding: ALL` beklentisi ve kimlikle kart yüklemedeki GraphQL `__typename` bilgisi). Düzeltilen iki paket sonrasında **23/23 test geçti**; diğer 71 paket genel taramada geçti.
- Masaüstü/mobil tarayıcı kontrolleri **4/4 geçti**. Ekran görüntülerinde dar kartların TL ve yüzde metinleri de incelendi.
- Üretim derlemesi başarılı; mevcut bağımlılık/lint uyarıları devam ediyor. Yeni üretim dosyalarından kaynaklanan derleme uyarısı yok.
- `git diff --check` başarılı. Üretim veritabanında işlem, migration, commit, push veya merge yapılmadı.
