# Basım ve destek sistemi sonuç raporu

27 Ekim 2026. Çalışma dalı: `feature/book-funding-system`. Commit, push, merge, deploy, üretim migration'ı veya gerçek ödeme yapılmadı. Başlangıçtaki kaydedilmemiş kullanıcı değişiklikleri korundu.

## Sonuç ve sınır

Kitap destek akışı artık ayrı dijital yayın/yazım durumları, değişmez basım sürümü, yönetici onayı, versiyonlu maliyet, kampanya, kuruş cinsinden ödeme rezervasyonu, ön sipariş, muhasebe, iade ve üretim/teslimat kayıtları üzerinden çalışır. Yazar, okuyucu ve yönetici ekranları GraphQL servislerine bağlandı. Canlı tahsilat varsayılan kapalıdır ve mevcut kodda LIVE adaptörü yoktur.

Bu sonuç **sandbox üzerinde test edilmiş teknik temel** anlamına gelir. Gerçek sağlayıcı, hukuki/mali model, matbaa doğrulaması, kargo bağlantısı ve üretim operasyonlarının tamamlandığı anlamına gelmez. Genel mimari, tüm durum geçişleri, API, kurulum, migration ve operasyon kuralları [teknik kılavuzdadır](print-funding.md).

## Değişen mevcut davranışlar

- `Yayınla` dijital yayın olarak korundu; başvuru ve fon açma ayrıldı. `Yazımı Tamamla` metin kontrolü yapar. Eski PUBLISHED API çağrısındaki tekil yayın puanı korunur.
- Eski istemcinin `updateBookStatus` ile FUNDING/hedef ataması engellendi. Sabit örnek fiyatla doğrudan kampanya açan modal kaldırıldı; uyumluluk bileşeni başvuru ekranına yönlendirir.
- Kontrolsüz eski iyzico başlatma ve callback yazma kodu kapatıldı. `/api/payment/callback` 410 döner. Bu dağıtılmadan önce geçmiş gerçek PENDING ödemeler için sağlayıcı uzlaştırması yapılmalıdır.
- Başarı dönüş URL'si ödeme kanıtı sayılmaz; kullanıcıya özel sunucu kaydı gösterilir.
- Eski Transaction ve Book finans alanları tutuldu; yeni SANDBOX finansıyla birleştirilmedi. Public ham finans/destekçi kimliği gösterimi sınırlandı. Kitap detayında yeni kampanya ve ayrı ücretsiz basım ilgisi gösterilir; eski karttaki doğrulanmamış fon ilerlemesi kaldırıldı.
- Finans/üretim sürerken kitabı yayından kaldırma, silme ve genel yönetim panelinden arşivleme kontrollü iptal sürecine bağlandı.

## Başvuru ve yönetici onayı

Yazar dijital yayımlanmış, tamamlanmış kitabı için boyut/kağıt/kapak/renk/baskı adedi, kapak PDF'i ve teknik beyanlar ile başvuru kaydeder. Sunucu son kayıtlı bölümleri snapshot olarak saklar, kelime/sayfa tahmini ve SHA-256 üretir. Dijital içerik sonradan değişse de başvuru metni değişmez. Revizyonda yeni sürüm üretilir; önceki sürüm ve gerekçeler korunur.

Yönetici son metni ve özel dosyaları inceler, gerekçeli ret/revizyon/onay verir. Onay için mizanpaj/teklif PDF'leri, doğrulanmış sayfa, maliyet bileşenleri ve satış fiyatı bileşenleri zorunludur. Tahmin, doğrulanmış teklif ve onaylı hedef ayrı tutulur. Aynı anda verilen kararlar revision ve transaction kontrolüyle tekilleştirilir. Güncel aktif ADMIN rolü DB'den okunur; yazar kendini onaylayamaz.

Onay kampanyayı kendiliğinden açmaz. Yönetici ayrıca kampanya açar; hedef/fiyat/sürüm sabitlenir. Yazar/kitap için aktif kampanya partial unique index ile, başvuru/sürüm tekrarı unique index ile engellenir. Aynı kitabın bitmemiş üretim/iade süreci de yeni kampanyayı engeller.

## Ödeme, sipariş ve yarış koşulları

Karşılıksız destek ve aynı sepette kitap ön siparişi + ilave destek uygulanmıştır. Fiyat/adet/toplam backend'de hesaplanır. Karşılıksız destek kitap hakkı oluşturmaz. Ön siparişin adresi ayrı onayla alınır, AES-256-GCM ile şifrelenir; yazar ve diğer okurlar göremez.

Kampanya belgesindeki atomik koşullu rezervasyon `accepted + reserved + yeni <= target` ve adet/stok kontrolünü transaction içinde uygular. Ödeme, rezervasyon ve sipariş birlikte oluşur. Kullanıcı kapsamlı idempotency key ve istek hash'i çift tıklamayı/tekrarı korur. İmzalı webhook ardından sağlayıcı kaydı sunucudan sorgulanır. Olay, capture/allocation muhasebesi, kampanya ve sipariş hakkı birlikte commit edilir. Yeni canlı para ağına çağrı yapılmaz; SandboxCharge aynı test MongoDB'sinde uygulama transaction'ına katılmadan ayrı sağlayıcı sınırı olarak çalışır.

Kalan hedefe sığmayan tam ön sipariş/destek reddedilir; gizli kısmi tahsilat veya hedef aşımı yoktur. Rezervasyon veya kampanya süresi geçmiş tahsilat ALLOCATION almadan tam iade edilir. Hedefte CLOSING, doğrulanmış net muhasebe sonrasında SUCCEEDED ve PREPARATION gelir. Hedefsiz/iptal kampanyalar gerçek iade kaydı ve kalıcı sağlayıcı refund referansıyla kapanır. Kaybolan init/iade cevabı aynı referansla toparlanır; başarısız iadeler görünür ve tekrar denenebilir.

Bildirimler transaction outbox'ına yazılır. Gönderim hatası finansı bozmaz; unique bildirim anahtarı aynı webhookun bildirim çoğaltmasını önler. Üretim ve sipariş teslimatları ayrı durumlarla, kargo firması/takip numarasıyla izlenir.

## Dosya envanteri

Bu görevde eklenen backend dosyaları:

- `Server/src/models/printFunding.js`
- `Server/src/services/print/common.js`, `applicationService.js`, `assetService.js`, `addressCrypto.js`, `paymentProvider.js`, `paymentService.js`, `campaignService.js`, `worker.js`, `migration.js`
- `Server/src/graphql/typedefs/printFunding.graphql`
- `Server/src/graphql/resolvers/printFunding.js`
- `Server/src/routes/printRoutes.js`
- `Server/src/scripts/migratePrintFunding.js`
- `Server/tests/printFunding.test.js`
- `Server/.env.print.example`

Bu görevde eklenen frontend dosyaları:

- `Client/src/graphql/printFunding.js`
- `Client/src/components/PrintFunding/shared.jsx`, `printFunding.css`, `ApplicationDetails.jsx`, `BookFundingPanel.jsx`, `PaymentCard.jsx`, `PrintFunding.test.jsx`, `PrintReview.test.jsx`
- `Client/src/pages/PrintApplication/index.jsx`
- `Client/src/pages/PrintCheckout/index.jsx`
- `Client/src/pages/FundingHistory/index.jsx`
- `Client/src/pages/Admin/PrintFunding/index.jsx`

Mevcut dosyalardaki ilgili değişiklikler:

- `Server/index.js`: raw route sırası, index yetenek kontrolü ve worker.
- `Server/src/models/book.js`, `notification.js`: eklemeli dijital/yazım alanları ve tekil bildirim anahtarı.
- `Server/src/graphql/resolvers/index.js`, `book.js`, `transaction.js`: yeni resolver kaydı, kontrollü yayınlama ve eski ödeme erişim sınırları.
- `Server/src/routes/paymentRoutes.js`, `Server/src/services/transactionService.js`: eski tahsilat yollarının kapatılması, geçmişin korunması.
- `Server/src/services/bookService.js`, `adminVisibility.js`: aktif finans/üretim sırasında kaldırma koruması.
- `Server/tests/db.js`: yalnız geçici replica set URI'sini gerçek migration CLI testine açan yardımcı.
- `Client/src/App.js`, `components/Admin/AdminLayout.jsx`, `components/Navigation/NavigationBar/index.jsx`, `components/Navigation/MobileMenu/index.jsx`: özel/admin rotaları ve menüler.
- `Client/src/graphql/queries/book.js`: ayrı dijital/yazım alanları.
- `Client/src/pages/BookDashboard/index.jsx`, `BookDashboard.test.jsx`: basım ekranından önce metin flush, dijital yayın/başvuru ayrımı.
- `Client/src/pages/BookDetail/index.jsx`, `components/Books/BookCard/index.jsx`: güncel kampanya/ücretsiz ilgi ve eski fon görsellerinin düzeltilmesi.
- `Client/src/components/Books/CostCalculatorModal/index.jsx`, `pages/DonationPage/index.jsx`, `pages/PaymentResult/PaymentSuccess.jsx`: yeni akışa uyumluluk yönlendirmeleri.
- `README.md`, `docs/print-funding-plan.md`, `docs/print-funding.md`, bu sonuç raporu.

Çalışma ağacındaki diğer mevcut değişiklikler bu görevin ürünü olarak raporlanmamıştır. Yeni finans modelleri genel serbest admin editörüne açılmamıştır.

## Veritabanı ve migration

Yeni koleksiyonlar ve unique/partial unique indexler eklenmiştir; var olan kullanıcı, kitap, bölüm, Transaction ve eski fon tutarları silinmez. `digitalStatus`, `writingStatus`, `completedAt`, `printRevision` eklemelidir; eksik alanlar uyumluluk okumasıyla çalışır. Varsayılanı salt okunur olan migration yalnız eksik durum alanlarını doldurabilir; eski finansı kuruşa dönüştürmez. Dry-run, model autoCreate/autoIndex özelliğini de kapatır. Üretim DB'sinde uygulanmamıştır. Index oluşturmak için `syncIndexes`, drop veya reset kullanılmaz.

## Doğrulama sonuçları

| Kontrol | Sonuç |
| --- | --- |
| Tam backend paketi | 22 paket / 265 test başarılı; exit 0; gerçek migration CLI dry-run testi dahil |
| Tam frontend paketi | 40 paket / 240 test başarılı; exit 0 |
| Son frontend hedefli koşu | Yeni ödeme/başvuru arayüzleri + editör: 3 paket / 19 test başarılı; exit 0 |
| Production build | Başarılı, exit 0; mevcut lint/dependency uyarıları var |
| Değişen frontend dosyalarının lint'i | Başarılı, sıfır hata/uyarı; son genel lint çıktısında yeni dosyalar da temiz |
| Proje genelindeki ESLint | Exit 1: görev dışı mevcut dosyalarda 29 hata / 16 uyarı; yeni sistemde hata/uyarı yok |
| Backend sözdizimi | 131 JS dosyası başarılı; migration scripti son düzenlemeden sonra ayrıca node --check ile doğrulandı |
| git diff --check | Başarılı; yalnız mevcut CRLF/LF dönüşüm uyarıları |

Backend testleri mock DB fonksiyonlarıyla sınırlı değildir: geçici gerçek MongoDB replica set, transaction/indexler ve **120 ayrı hesapla paralel checkout + paralel capture** kullanılır. Hedefin tam sınırı, duplicate checkout/webhook, init/iade cevap kaybı, geç capture, başarısız/iptal ödeme, deadline yarışı, stok/tutar manipülasyonu, şifreli adres/bütünlük/erişim, başvuru karar yarışı, üretim/teslimat, bildirim hata/retry, güvenli migration ve bütün gerçek frontend GraphQL dokümanları doğrulanır. HTTP testleri JWT, raw imza doğrulaması, özel PDF indirme/yükleme ve eski callback'in yazamamasını çalıştırır.

Genel lint hataları mevcut testlerdeki `testing-library/no-node-access`, `render-result-naming-convention`, `prefer-presence-queries`; uyarılar görev dışı mesajlaşma/yorum/oturum/profil dosyalarındaki kullanılmayan değişkenler ve hook bağımlılıklarıdır. Bunları düzeltmek için ilgisiz refactor yapılmadı. Build/test ortamı eski CRA/Babel/Browserslist ve React test yardımcıları hakkında da uyarı verir. Normal build başarılıdır; CI'nin uyarıları hata sayan politikasında bu eski uyarılar ayrıca ele alınmalıdır.

## Test edilemeyen veya canlıya hazır olmayan bölümler

- Gerçek iyzico/banka ödeme, imza, iade, ön provizyon, chargeback ve mutabakat; gerçek ödeme anahtarı kullanılmadı. Sandbox imzası iyzico imzası değildir.
- Gerçek matbaa fiyatı, sözleşmesi, kaynak metin–mizanpaj karşılaştırması ve teknik PDF preflight. Sayfa kesinleştirme yetkili insan/matbaa doğrulamasıyla kaydedilir; otomatik PDF sayfa sayımı/zararlı dosya taraması yoktur.
- Gerçek kargo/teslimat API'si ve taşıyıcıdan otomatik doğrulama; mevcut çözüm yetkili kilometre taşı/takip kaydıdır.
- Gerçek tarayıcı/mobil görsel ve uçtan uca kabul testi; JSDOM bunun yerini tutmaz.
- Üretim replica set failover/disk arızası, çoklu process performans/kaos testleri, profesyonel sızma testi, GraphQL kaynak bütçesi ve dağıtık hız sınırı.
- Gerçek e-posta/SMTP teslimatı (mevcut uygulama içi bildirim kullanılır), kişisel veri saklama/silme/anahtar rotasyonu işletimi.
- Tamper-proof harici muhasebe arşivi, canlı finansal uyuşmazlıkların kanıtlı düzeltme runbook'u, sağlayıcı settlement/payout ve gerçek işletme muhasebesi.

## Sizin yapmanız gerekenler

1. Ayrı MongoDB replica-set test veritabanı seçin. Mevcut `.env` dosyanızı/üretim verilerinizi bu çalışma değiştirmedi.
2. `Server/.env.print.example` doğrultusunda PRINT_SYSTEM_ENABLED=true, NODE_ENV=development, PRINT_PAYMENTS_MODE=SANDBOX ve iki ayrı güçlü test anahtarını yapılandırın. Adres için 64 hex karakterli anahtar gerekir.
3. Mevcut yetkili ADMIN hesabıyla `/admin/print-funding` ekranında örnek tarife sürümü oluşturun. Gerçek matbaa fiyatı olarak sunmayın.
4. Metinli dijital kitap → tamamla → basım başvurusu → mizanpaj/teklif/karar → kampanya → test ödeme/ön sipariş → uzlaştırma → üretim/kargo akışını test ortamında deneyin.
5. Migration gerekiyorsa önce dry-run ve yedekleme planını inceleyin. Üretimde apply/index yazımı ve eski ödemelerin uzlaştırması ayrıca açık onay gerektirir.
6. Canlıya geçmeden [teknik kılavuzdaki dış bağımlılıkları](print-funding.md#canlıya-geçişte-tamamlanması-gerekenler) tamamlayın. Mevcut kodda yalnız bir environment değişikliğiyle gerçek tahsilat açılmaz.
