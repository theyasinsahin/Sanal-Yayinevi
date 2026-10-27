# Betik basım, destek ve ön sipariş sistemi

Bu sürüm güvenli bir **sandbox temelidir**. Canlı para kabul etmez, gerçek kitap teslimatı taahhüt etmez. Eski iyzico checkout ve callback yazma yolları kapalıdır. Gerçek sağlayıcı entegrasyonu ve hukuki model tamamlanmış değildir. Mimari kararların başlangıç analizi [uygulama planındadır](print-funding-plan.md).

## Mevcut projeyle bütünleşme

React/CRA, Apollo GraphQL, Express, MongoDB/Mongoose ve JWT korunmuştur. Yeni bağımlılık yoktur. Normal dijital yayımlama `updateBookStatus` üzerinden devam eder. `FUNDING`/`FUNDED` gibi fiziksel durumlar ve istemciden fon hedefi bu mutation ile artık yazılamaz. Eski `Book.status`, finans alanları ve `Transaction` geçmişi silinmez. Yeni sandbox kayıtları bu alanlara veya eski yönetim finans toplamlarına eklenmez.

`Book.digitalStatus`: DRAFT / PUBLISHED. `Book.writingStatus`: WRITING / COMPLETED. Eksik eski alanlarda status üzerinden uyumluluk okuması yapılır: DRAFT taslak, diğer durumlar dijital yayında; COMPLETED/FUNDING/FUNDED/PUBLISHED yazım tamamlanmış kabul edilir. Eski PUBLISHED kayıtlarının anlamı yayına geçişten önce gözden geçirilmelidir. Bu eşleme hiçbir kampanya açmaz ve geçmiş ödemeyi doğrulamaz.

Yazım tamamlanması için sunucuda metin içeren bölüm aranır. Tamamlanan eserde dijital düzenleme devam edebilir; önceden sabitlenmiş basım sürümü değişmez. Aktif kampanya veya bitmemiş üretim sırasında kitabı taslağa çekmek/silmek ve genel admin panelinden arşivlemek engellenir. İçeriğe acil moderasyon gerekiyorsa önce kontrollü kampanya/üretim iptali ve finansal operasyon yürütülmelidir.

## Veri yapısı

Yeni modeller `Server/src/models/printFunding.js` içinde tanımlıdır. Mongoose koleksiyon adlarını çoğullaştırır.

| Model | Sorumluluk / önemli kurallar |
| --- | --- |
| BookPrintVersion | Sunucudaki sıralı bölüm metinleri, kitap/yazar künyesi, kelime sayısı, baskı özellikleri, beyan sürümü ve SHA-256; uygulama seviyesinde değişmez |
| PrintAsset | PDF bytes, sunucu SHA-256, sahibi, boyut; `(ownerId, sha256)` unique; bytes varsayılan sorgudan gizli |
| PrintTariff | Değişmez tarife sürümü, açık SANDBOX etiketi, fiyatlar, oranlar ve destek politikası; version unique |
| PrintApplication | Güncel ve önceki sürüm kimlikleri, optimistic revision, tahmin, doğrulanmış teklif, onaylı hedef/satış fiyatı, gerekçe; kitap başına bir açık başvuru partial unique |
| FundingCampaign | Sabit hedef/fiyat/sürüm; accepted/reserved kuruş, sold/reserved adet, tekil destekçi sayısı, tarih, sonuç ve ayrı üretim durumu |
| FundingPayment | Kullanıcı kapsamlı idempotency key + istek hash'i; toplam, ön sipariş ve ilave destek ayrımı; provider=SANDBOX |
| PaymentReservation | Ödeme başına unique süreli tutar/adet rezervasyonu; TTL silme YOK, serbest bırakma muhasebeli worker işlemi |
| FundingPaymentEvent | Sağlayıcı işlem/sürüm olayının unique kimliği ve hash'i; uygulama seviyesinde değişmez |
| FundingLedger | CAPTURE, ALLOCATION, REFUND, DEALLOCATION; `(kind:paymentId)` unique key; finansal hareketler değiştirilmez |
| FundingRefund | Ödeme başına tek TAM iade; bağımsız durum, kalıcı idempotent sağlayıcı referansı, deneme/lease/backoff/hata |
| PrintPreOrder | Bir kampanyanın bir kitap satırı: adet × sabit fiyat; bağımsız ödeme/teslimat durumu; şifreli adres ve onay sürümü |
| CampaignSupporter | `(campaignId,userId)` unique; aktif ödeme sayısıyla tekil net destekçi sayısı |
| PrintInterest | `(bookId,userId)` unique; ücretsiz basım ilgisi, beğeni ve ödemeden ayrı |
| PrintAudit | Aktör, kayıt, eylem, önceki/sonraki durum, gerekçe; uygulama seviyesinde değişmez |
| CampaignUpdate | Basım/kampanya kilometre taşları; uygulama seviyesinde değişmez |
| PrintOutbox | Unique olay anahtarı, kullanıcı/broadcast, kalıcı ilerleme imleci ve gönderim hatası |
| SandboxCharge | Ayrı kalıcı mock sağlayıcı sınırı; merchantReference unique; para, capture/refund durumu ve sağlayıcı sürümü |

Kampanyada `applicationId` ve `versionId` unique; `activeLock:true` için `authorId` ve `bookId` partial unique indexleri vardır. Yazarın aynı anda tek aktif destek kampanyası olabilir. İlk kampanya kapanışında ACTIVE/CLOSING/REFUNDING boyunca kilit tutulur; başarı veya bütün iadelerin bitmesiyle bırakılır. Üretimi devam eden eski başarılı kampanya yazarın başka kitabı için yeni fon açmasını engellemez. Başarı sonrası üretim iptal edilirse yazar kilidi yeniden alınmaz (başka kitabın kampanyası açılmış olabilir); aynı kitapta yeni kampanya, üretim/iade tamamlanana kadar ayrıca engellenir.

Ödeme, rezervasyon, iade, başvuru, kampanya ve siparişlerde erişim/sıralama/durum indexleri vardır. `Notification.dedupKey` yalnızca string alanı olan yeni bildirimler için partial unique; eski bildirimler etkilenmez. Yeni finans/adres modelleri genel serbest kayıt düzenleyicisine eklenmez; yalnızca yetkili servis API'leri kullanılır.

## Durum geçişleri ve aktörler

| Süreç | İzin verilen akış |
| --- | --- |
| Dijital yayın | Yazar veya güncel ADMIN: DRAFT ↔ PUBLISHED; yazım tamamlanması ayrı |
| Başvuru | Yazar: PREPARING → SUBMITTED; yönetici: SUBMITTED → APPROVED / REJECTED / REVISION_REQUESTED |
| Revizyon | Yazar yeni snapshot oluşturarak REVISION_REQUESTED → PREPARING → SUBMITTED; eski sürüm korunur |
| Başvuru iptali | Yazar: PREPARING/SUBMITTED/REVISION_REQUESTED/APPROVED → CANCELLED; kampanya varsa bu yol kapalı |
| Kampanya | Yönetici onaylı başvurudan ACTIVE; hedef → CLOSING/TARGET; süre → CLOSING/DEADLINE; yönetici iptali → CLOSING/CANCELLED |
| Kampanya sonucu | Uzlaştırılmış tam hedef → SUCCEEDED; diğer kapanış → REFUNDING; tüm iadeler bitince REFUNDED veya tahsilat yoksa FAILED/CANCELLED |
| Ödeme | CREATED → PENDING → CAPTURED / FAILED / CANCELLED; kabul edilmeyen geç CAPTURED → REFUND_PENDING → REFUNDED |
| İade | PENDING → PROCESSING → SUCCEEDED / FAILED; başarısız işlem backoff ile veya yöneticiyle yeniden denenir |
| Üretim | SUCCEEDED sonrası PREPARATION → PRINTER_APPROVED → STARTED → PRINTING → PRINTED → PACKAGING → SHIPPING → DELIVERED → COMPLETED |
| Üretim sorunu | Terminal olmayan adımdan ISSUE; yalnızca kayıtlı önceki adıma dönüş; CANCELLED → kampanya REFUNDING |
| Sipariş | AWAITING_PAYMENT → CONFIRMED; başarısız/iptal ödeme → CANCELLED; iade → REFUND_PENDING → REFUNDED; CONFIRMED → PACKAGING → SHIPPED → DELIVERED |
| Teslimat sorunu | CONFIRMED/PACKAGING/SHIPPED → ISSUE; kayıtlı önceki adıma dönüş |

Yönetici kendi başvurusunu onaylayamaz. Başvuru ve üretim/sipariş kararlarında revision zorunludur; eski ekrandan karar verme CONFLICT döndürür. Geçiş, karar, iptal ve onaylar transaction içinde audit'e yazılır. Kargoya çıkış için firma ve takip numarası gerekir. Kitap basılmadan paketlemeye, siparişler teslim edilmeden toplu teslim/tamamlanma durumuna geçilemez.

## Başvuru, dosya ve maliyet

1. Yazar dijital yayımlar, yazımı tamamlar, editörün otomatik kaydının bitmesini bekler.
2. Ayrı basım ekranında boyut, kağıt, kapak, renk, baskı adedi, kapak DPI/taşma payı, ek tercihler ve özel kapak PDF'i girer. Eser sahipliği, içerik izinleri ve sürümlü test koşullarını onaylar.
3. Sunucu bölümleri tutarlı transaction snapshot'ından alır. SHA-256 hesaplar, yeni BookPrintVersion üretir. İstemci kelime/sayfa/fon hedefi belirleyemez. Sürüm sonradan güncellenemez.
4. Tahmini sayfa, metnin HTML etiketlerinden arındırılmış kelime sayısı ve boyuta bağlı 250/350 kelime/sayfa yaklaşımıdır. Bu yalnızca planlama tahminidir, matbaa sayfa sayısı değildir. Kapaktaki DPI/taşma bilgileri de başlangıçta yazar beyanıdır.
5. Yönetici son metin, kapak ve izinleri inceleyip revizyon/ret gerekçesi yazabilir. Onay için son mizanpaj PDF'i, teklif PDF'i, teklif referansı, matbaa tarafından doğrulanmış sayfa sayısı ve teknik ön kontrol beyanı zorunludur. Dosyaların SHA-256 değerleri onaylı teklife sabitlenir.
6. Tahmini maliyet tarife sürümüyle saklanır. Doğrulanmış baskı/kargo/paketleme/vergi/ödeme/hizmet/diğer maliyetleri ayrı tutulur; sunucu bileşenleri toplayarak onaylı hedefi üretir. Satış fiyatı ayrı birim bileşenlerin toplamıdır; hedefi baskı adedine bölmek satış fiyatı sayılmaz. Birim üretim ve operasyon maliyetlerinin onaylı toplam/baskı adedi altına inmesi engellenir.
7. Kampanya yönetici tarafından ayrıca açılır. Hedef, fiyat ve sürüm sonradan değiştirilemez. Değişiklik gerekiyorsa kampanya açılmadan başvuru iptal edilip yeni başvuru hazırlanır; açıldıktan sonra kontrollü kampanya iptali ve tam iade, ardından yeni sürüm/başvuru gerekir.

Tarifeler admin ekranından yönetilir, güncellemek yerine yeni sürüm oluşturulur. Bu sürümde bütün tarifeler SANDBOX'tır. Gerçek matbaa fiyatı uydurulmamıştır. 30 gün varsayılan; tarife ve kampanya açılışında 1–90 gün. Hızlı destek tutarları varsayılan 50/100/250/500 TL; tarife politikası sunucuda sınırları belirler.

PDF'ler 10 MB ile sınırlı MongoDB belgelerinde özel saklanır. İstekler JWT'den sonra okunur. Basit PDF başlık/EOF kontrolü, byte hash'i ve sahiplik kontrolü uygulanır; indirme attachment, no-store ve nosniff döner. **Gerçek PDF parser/preflight, zararlı içerik taraması, font gömme/renk profili kontrolü, PDF sayfalarının otomatik sayılması ve mizanpajın kaynak metinle otomatik karşılaştırılması uygulanmamıştır.** Kesin sayfa doğrulaması yetkili insan/matbaa işlemidir. Canlı yayından önce bu operasyon ve dosya güvenliği tamamlanmalıdır. Büyük dosyalı üretim için özel nesne depolama/GridFS ayrıca değerlendirilmeli; şimdiki sınır 10 MB/dosyadır.

## Ödeme ve eşzamanlılık

Para kuruş cinsinden safe integer'dır. `MinorAmount` GraphQL scalar'ı kesir, negatif ve güvenli sınır dışı sayıyı reddeder. Maliyet oranlarında BigInt ile yukarı yuvarlama kullanılır. UI ondalık metni iki basamakla kuruşa çevirir; toplamın otoritesi backend'dir.

`startPrintCheckout` yalnızca campaignId, kullanıcı kapsamlı idempotencyKey, adet, ilave destek ve gerekiyorsa adres/onay kabul eder. Kullanıcı kimliği JWT'den, kitap fiyatı kampanyadan gelir. Aynı anahtar + aynı içerik mevcut ödemeyi verir; farklı içerik CONFLICT. Kart alanı yoktur. Buton tekrarları hem UI kilidiyle hem sunucudaki unique index ile korunur. Yanıt kaybolunca aynı anahtar yeniden kullanılabilir; sepet kilitlenir. Tarayıcı dönüş URL'si başarı kanıtı değildir; ödeme kullanıcıya özel API'den okunur.

MongoDB transaction'ında kampanya belgesine koşullu `$expr` güncellemesi yapılır:

```text
acceptedMinor + reservedMinor + yeniToplam <= targetMinor
soldQuantity + reservedQuantity + yeniAdet <= printRun
state = ACTIVE ve startsAt <= şimdi < endsAt
```

Bu koşulla ödeme + rezervasyon + ön sipariş aynı transaction'da oluşturulur. Kampanya belgesindeki yazma çatışmaları MongoDB driver transaction retry mekanizmasıyla yeniden değerlendirilir; process içi mutex kullanılmaz. Çoklu uygulama instance'ında da DB kısıtları geçerlidir. Bir transaction/session içinde paralel MongoDB işlemi çalıştırılmaz. Bağımsız kullanıcı istekleri ise gerçekten paraleldir.

Sağlayıcı `initialize(reference)` transaction commit'inden sonra çağrılır. Kalıcı merchantReference ile idempotenttir. Cevap kaybında CREATED kayıt worker tarafından aynı referansla tamamlanır. SandboxCharge aynı test MongoDB'sinde ancak uygulama transaction'ına katılmadan çalışır; ayrı bir gerçek banka/HTTP sağlayıcısı değildir. Sağlayıcı ve uygulama DB'si tek atomik transaction sayılmaz.

Webhook, raw bytes üzerinde HMAC-SHA256 + zaman penceresi + timing-safe karşılaştırmayla doğrulanır. Bu algoritma **Betik sandbox protokolüdür; iyzico imzası değildir**. Ardından sunucu sağlayıcıdan gerçek kayıt durumunu sorgular; reference, providerId, kuruş ve TRY eşleşmesi aranır. Otorite webhook veya istemcinin başarı alanı değildir. Doğrulanmış sağlayıcı sürümü unique PaymentEvent olarak, CAPTURE/ALLOCATION ve kampanya/sipariş değişiklikleriyle aynı transaction'da kaydedilir. Tekrarlanan/farklı sıradaki olaylar yeniden fon yazmaz; CAPTURED/REFUNDED durumu eski başarısız olayla geriye alınmaz.

## Hedef aşımı ve geç ödeme politikası

- Karşılıksız destek dahil sessiz hedef aşımı YOK. Ön sipariş tam satış bedeliyle kabul edilir. Kalan hedefe sığmayan kitap siparişi reddedilir; kitap bölünmez, kullanıcıdan habersiz kısmi ödeme/tutar değişimi yapılmaz.
- Aynı sepette `adet × unitPriceMinor + donationMinor` bir kere tahsil/rezervasyon/ALLOCATION olur. Karşılıksız kısım kitap hakkı vermez. Hedefe katkı sepetin toplamıdır; sipariş ve destek iki kere eklenmez.
- Süreli rezervasyon tarifedeki dakika ve kampanya bitişinin erkencisinde biter. Süre bitince worker kapasiteyi transaction ile serbest bırakır, bekleyen sağlayıcı işlemini iptal etmeyi dener.
- Kabul kuralı katıdır: capture **uygulama tarafından işlendiğinde** rezervasyon HELD ve süresi geçmemiş, kampanya ACTIVE ve bitişten önce olmalıdır. Sağlayıcının daha eski capture saati bu kuralı aşmaz. Böylece webhook çok geç gelirse sağlayıcıda daha önce tahsil edilmiş olsa bile tam iade edilir. Bu tercih belirsiz kapasiteyi yeniden kullanırken fazla fon/teslimat hakkı yaratmayı engeller; kullanıcıya koşul açıkça gösterilir.
- FAILED/CANCELLED sonrası geç başarı yeni teslimat hakkı yaratmaz: CAPTURE muhasebeleşir, ALLOCATION yapılmaz, tam iade kuyruğuna girer.
- Hedefin birebir dolması CLOSING yapar. Net ALLOCATION–DEALLOCATION toplamı, kampanya toplamı ve hedef karşılaştırılır; bekleyen iadeler ve finansal uyuşmazlık varken basım başlatılmaz. Başarıdan sonra PREPARATION başlar; doğrudan PRINTED olmaz.
- Kalan hedef minimum destekten veya kitap fiyatından küçükse otomatik istisna yoktur. Hedefe ulaşılamama ve kapanışta tam iade mümkündür. Kampanya tasarlanırken hedef/fiyat/baskı adedi uyumu operasyon tarafından değerlendirilmelidir.

## İade ve kurtarma

Model anında sandbox capture + başarısız kampanyada TAM iadedir; hedefe kadar parayı sağlayıcıda tutma/escrow/ön provizyon özelliği varsayılmaz. Kısmi iade, yazar ödemesi, matbaaya para aktarma, komisyon dağıtımı ve chargeback adaptörü uygulanmamıştır.

Refund kaydı ayrı bir saga'dır. Worker atomik lease alır, kalıcı refund ID ile sağlayıcıya gider, sonucu doğrular, ardından REFUND/DEALLOCATION, kampanya toplamı, destekçi sayısı, sipariş ve bildirim outbox'ını birlikte yazar. Sağlayıcı iadeyi yapıp cevap kaybolursa aynı refund ID ile yeniden sorgulama/çağrı çift iade üretmez. Yerel muhasebe ancak doğrulanmış sonuçtan sonra değişir. FAILED iade görünür kalır, üstel beklemeyle tekrar denenir, admin panelinden de denenebilir. Başarısız iade kampanya kilidini serbest bırakmaz.

Worker 15 saniyede bir sınırlı gruplarla çalışır; önce süresi dolan rezervasyonlar, sonra CREATED/PENDING (100), geç FAILED/CANCELLED kontrolü (25), kapanan kampanyalar (50), zamanı gelen iadeler (100), ikinci kampanya uzlaştırması ve bildirimler. Geç/iptal kayıtlar en az bir dakika arayla taranır. Geçmiş CAPTURED kayıtlar yeni ödemelerin taramasını engellemez. Bu sayılar gerçek yük testiyle ayarlanmalıdır; 120 paralel istek testi üretim kapasitesi garantisi değildir.

Sunucu tekrar başladığında kalıcı işler devam eder. Çoklu worker aynı ödemeyi/iadeyi/olayı tekrar ele alabilir; DB unique ve işlem durumları tekrar etkisini engeller. Lease süresi 60 saniye. Uyuşmayan sağlayıcı tutarı `FundingPayment.issue` ve `campaign.financeIssue` ile görünür olur ve başarıyı engeller; bunları elle toplam değiştirerek temizlemeyin. Kanıtlı sağlayıcı uzlaştırması ve denetlenen düzeltme prosedürü gerekir; bu sürüm finansal uyuşmazlıklar için otomatik düzeltme/flag temizleme API'si sunmaz.

Eski `/api/payment/callback` 410 döndürür. Önceden oluşturulmuş gerçek PENDING işlemler otomatik olarak yeni mock'a aktarılmaz. Bu değişikliği dağıtmadan önce sağlayıcı raporlarıyla ayrı, açıkça onaylanmış bir geçiş/uzlaştırma yapılmalıdır. Bu görevde üretim DB'sine veya sağlayıcıya bağlantı yapılmamıştır.

## Güvenlik, adres ve bildirim

Her yazma işleminde aktif hesap ve güncel rol DB'den okunur. Rol/kullanıcı/ödeme sonucu/bedel istemciden kabul edilmez. Yazar yalnız kendi başvurusunu görür; destekçi yalnız kendi ödeme ve siparişlerini görür. Yazar destekçilerin kimliğini/adresini listeleyemez. Public kampanya yalnız toplamları ve kilometre taşlarını sunar. Eski public finans hareketi listesi yöneticiyle sınırlandırılmıştır; eski destekçi kimlikleri halka gösterilmez.

Adres AES-256-GCM ile şifrelenir. Rastgele IV, authentication tag ve ödeme kimliğine bağlı AAD kullanılır; başka siparişe taşınan veya değiştirilen şifreli adres açılamaz. Alan varsayılan sorgudan gizlidir; yalnız sipariş sahibi veya güncel ADMIN açıkça isteyince çözülür. Kart/kimlik numarası saklanmaz. Adresler audit/provider/log/bildirim metnine yazılmaz. Şifreleme anahtarı repoya girmez; kaybında adresler açılamaz. Anahtar rotasyonu için eski anahtarla çözüp yeni sürümle şifreleyen denetlenen migration gerekir; şu anda yalnız envelope v1 vardır.

Bildirim outbox'ı finansal transaction'a yazılır; gönderim ayrı worker'dadır. Hata ödeme kaydını geri almaz. Bildirimlerde unique dedupKey ve broadcast ilerleme imleci bulunur. Başvuru, karar, kampanya, capture/başarısız ödeme, hedef, sonuç, iade, üretim ve teslimat olayları bildirilir. `offerUpdate:false` tercihi gözetilir. SMTP/e-posta entegrasyonu eklenmemiştir; mevcut uygulama içi bildirimler kullanılır. Takipçilere her ödeme için bildirim yağdırılmaz.

Değişmezlik uygulama seviyesinde Mongoose save/query middleware'i ve salt işlem API'leriyle sağlanır; DB yöneticisinin/raw driver'ın kayıt değiştirmesine karşı WORM garantisi değildir. Canlıda DB hesabı için en az yetki, ledger/event/audit üzerinde güncelleme/silme engeli, yedekleme ve harici denetim politikası gerekir. Test temizliği yalnız geçici DB'de native collection delete kullanır.

## API ve ekranlar

GraphQL mevcut kök endpointte; tam input/output sözleşmesi `Server/src/graphql/typedefs/printFunding.graphql`, gerçek istemci dokümanları `Client/src/graphql/printFunding.js`.

| Yetki | İşlemler |
| --- | --- |
| Herkes | printPaymentMode, printOverview, printTariffs; public kampanya tutar/durum/güncellemeleri |
| Yazar | myPrintApplications, myPrintApplicationForBook, printApplication, printApplicationVersions, printApplicationHistory, myFundingCampaigns, kendi printCampaignAudit; save/submit/cancelPrintApplication |
| Giriş yapan okur | setPrintInterest, startPrintCheckout, simulatePrintPayment (yalnız sandbox kendi işlemi), cancelPrintPayment, myFundingPayment(s), myPrintOrders |
| Güncel ADMIN | adminPrintApplications, reviewPrintApplication, createPrintTariff, open/closeFundingCampaign, adminFundingCampaigns, adminFundingPayments/Refunds, adminPrintOrders, request/retryPrintRefund, updatePrintProduction/Order, printCampaignAudit, runPrintMaintenance |

Listeler 20'li sayfalıdır; tarih + _id ile kararlı sıralanır. Uygulama sürümleri/geçmişi ve kampanya güncellemeleri özel detay sorgularındadır. İstekler GraphQL inputları, uzunluk/adet/para kontrolleri ve sunucuya ait kimliklerle doğrulanır. Sorgu derinliği/bütçesi ve çoklu instance API hız sınırı mevcut GraphQL sunucusuna ayrıca eklenmelidir; canlı ön koşuludur.

| HTTP | Davranış |
| --- | --- |
| POST /api/print/assets | JWT; Content-Type application/pdf; raw PDF ≤10 MB; X-Filename isteğe bağlı; sunucu id/hash/bytes döner |
| GET /api/print/assets/:id | JWT; sahip/yetkili yönetici veya başvurusuna bağlı onaylı teknik dosyaya erişen yazar; özel attachment |
| POST /api/print/webhooks/sandbox | Raw application/json ≤32 KB; x-betik-timestamp (ms), x-betik-signature (hex HMAC); 5 dakika pencere; provider retrieve sonrası işleme |
| POST /api/payment/callback | Eski callback kapalı, 410; veri/tutar güncellemez |

Ekranlar: `/dashboard/:bookId` → **Basım İçin Başvur / Başvurumu Gör** (önce otomatik kaydı flush eder); `/print/:bookId` yazar çalışma alanı; kitap detayında ayrı ücretsiz ilgi/kampanya paneli; `/donate/:bookId` birleşik test sepeti; `/funding-history` özel ödeme/iade/sipariş geçmişi; `/admin/print-funding` başvuru, maliyet, kampanya, üretim ve teslimat yönetimi. Eski `/payment/success` adresi de sunucudaki özel geçmişi gösterir; query string ile sahte başarı göstermez.

## Test ortamı kurulumu ve migration

1. Node 22 ve MongoDB replica set (testler kendi geçici replica set'ini açar). Standalone yerine özel replica-set test DB'si kullanın. `.env` içindeki mevcut MONGO_URI'nin üretim olmadığını siz doğrulayın; bu görevde okunmadı/değiştirilmedi.
2. `npm.cmd --prefix Server ci` ve `npm.cmd --prefix Client ci` (kuruluysa gerekmez).
3. `Server/.env.print.example` içindeki ayarları yalnız ayrı test ortamına ekleyin. JWT_SECRET, CLIENT_URL ve mevcut uygulama ayarlarını koruyun. Rastgele iki AYRI anahtar üretin; bunları `.env`/secret manager'a yazın, repoya/loga eklemeyin.

```powershell
# Anahtar üretimi sizin yerel terminalinizde yapılır; örnekler gerçek anahtar içermez.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

| Değişken | Davranış |
| --- | --- |
| PRINT_SYSTEM_ENABLED | `true` değilse başvuru/kampanya/ödeme yazmaları ve PDF yükleme kapalı; startup index/worker başlatmaz. Güncel ADMIN tarafından tarife oluşturulması bu anahtardan bağımsızdır. |
| PRINT_PAYMENTS_MODE | Varsayılan kapalı; yalnız `SANDBOX` desteklenir |
| NODE_ENV | Ödeme için açıkça `development` veya `test` gerekir; production'da sandbox dahi kapalı |
| PRINT_SANDBOX_WEBHOOK_SECRET | En az 32 karakter; yalnız mock HMAC protokolüne ait, gerçek sağlayıcı anahtarı değildir |
| PRINT_ADDRESS_ENCRYPTION_KEY | 32 byte / 64 hex karakter; ön sipariş adresi için zorunlu |
| MONGO_URI | Ayrı replica-set test DB'si; mevcut yapılandırma kullanılır |
| JWT_SECRET / CLIENT_URL | Mevcut uygulamanın oturum/origin ayarları |

4. Etkin startup `initializePrintFunding()` ile replica set yeteneğini denetler ve eklemeli createIndexes yapar; hata durumunda sunucu bu modülle açılmaz. syncIndexes/drop/reset yoktur. Önceden veri varsa index doğrulamasını bakım planına alın. Eski alanların backfill'i zorunlu değildir, uyumluluk okuması vardır.
5. İsteğe bağlı migration aşağıdadır. Varsayılan **salt okunur dry-run**; apply yalnız eksik dijital/yazım alanlarını ekler, tekrar çalışabilir. Eski finansı kuruşa çevirmez, para toplamlarını/statüyü değiştirmez. Üretimde apply veya index yazımı için ayrıca açık onay ve yedekleme gerekir. Bu görevde script üretim/yerel gerçek DB üzerinde çalıştırılmadı; yalnız geçici test DB'sinde test edildi.

```powershell
cd Server
node src/scripts/migratePrintFunding.js
# Yalnız doğru test DB'sini ve dry-run sonucunu doğruladıktan sonra:
node src/scripts/migratePrintFunding.js --apply --indexes
```

6. `npm.cmd --prefix Server start`, `npm.cmd --prefix Client start`. Admin kullanıcı mevcut rol sistemiyle yetkili olmalı; bu görev otomatik yönetici hesabı oluşturmaz. `/admin/print-funding` → Fiyat tarifeleri ekranında açıkça örnek test değerleriyle yeni tarife girin. Sonra metinli bir dijital kitapta tamamla → başvuru → yönetici teknik/teklif onayı → kampanya → test desteği/ön sipariş akışını çalıştırın.

### Canlı sitede yalnız tarife hazırlama

Yönetici olarak `/admin/print-funding` → **Fiyat tarifeleri** ekranından yeni, benzersiz bir sürüm adıyla tarife kaydedebilirsiniz. Bunun için `PRINT_SYSTEM_ENABLED`, sandbox sırrı veya ödeme anahtarı eklemek gerekmez; `NODE_ENV=production` korunur. Kayıt anında yalnız tarife ve denetim geçmişi indexleri hazırlanır; tarife ile audit birlikte transaction içinde yazılır. MongoDB replica set/mongos desteği gereklidir. Aynı sürüm adı tekrar kullanılamaz; mevcut tarife değişmeden yeni sürüm oluşturulur.

Bu yönetim işlemi başvuru/kampanya/ödeme özelliklerini etkinleştirmez. Mevcut tarifeler SANDBOX etiketini taşımaya devam eder; gerçek ödeme veya canlı fiyatlandırma adaptörü eklenmiş sayılmaz.

## Testler ve doğrulama sınırları

```powershell
npm.cmd --prefix Server run test:ci
npm.cmd --prefix Client run test:ci
npm.cmd --prefix Client run build
# Mevcut ESLint kurulumu; ağdan paket indirmez:
cd Client
.\node_modules\.bin\eslint.cmd src --ext .js,.jsx
```

`Server/tests/printFunding.test.js`: gerçek MongoDB transaction/index, 120 ayrı hesapla gerçekten paralel rezervasyon + paralel capture, tam hedef, duplicate istek/webhook, kayıp init/iade cevabı, manipüle fiyat/para, geç/iptal/başarısız ödeme, süre sonu yarışı, tam iadeler ve retry, ön sipariş/adres yetkileri, şifreli adres, immutable sürüm/ledger, rol kaybı, onaysız fon engeli, üretim/teslimat, bildirim hata/tekilleştirme, bütün gerçek frontend GraphQL dokümanlarının şema doğrulaması/özel sorguları ve raw HTTP JWT/webhook/PDF/legacy callback, güvenli migration.

`Client/src/components/PrintFunding/*.test.jsx`: birleşik sepet, yalnız niyet verisinin gönderilmesi, çift tıklama/yanıt kaybında aynı işlem, kuruş dönüşümü, kapalı kampanya, ücretsiz ilgi, iade/kargo görünümü, yazar gönderimi ve gerekçeli yönetici ret akışı. Mevcut otomatik kayıt testinde basım ekranına geçmeden metnin flush edilmesi de doğrulanır.

Son koşu sayıları ve mevcut lint uyarıları [sonuç raporunda](print-funding-report.md) tutulur. JSDOM testleri gerçek mobil/tarayıcı görsel denemesi değildir. Sandbox mock başarısı iyzico/banka, gerçek kargo, SMTP veya matbaa entegrasyonu başarısı olarak yorumlanamaz. Replica-set failover, çoklu process üretim yükü, disk arızası ve gerçek banka mutabakatı test edilmemiştir.

## Canlıya geçişte tamamlanması gerekenler

- Yayıncılık/ön sipariş/karşılıksız destek için hukuki ve mali model, yetkilendirmeler, telif ve matbaa sözleşmeleri, fatura/vergi/iade/teslimat koşulları ve KVKK süreçleri yetkili ekipçe netleştirilmeli. Mevcut beyanlar yalnız test sürümüdür.
- Gerçek matbaa teklifi ve doğrulanmış mizanpaj, PDF güvenlik/preflight süreci; gerçek maliyet/satış tarifesi. Gerçek üretim ve kargo bağlantısı şu anda yönetici kilometre taşı/takip kaydı düzeyindedir.
- Mevcut iyzico SDK'sı sebebiyle ilk aday iyzico'dur; adapter henüz yazılmadı. Resmi belgelerde V3 webhook imzası, hesap aktivasyonu, checkout retrieve ve refund desteği vardır; bu bilgiler escrow garantisi değildir. Gerçek adapter sağlayıcının KENDİ imza algoritmasını, server response doğrulamasını, idempotency/arama imkânlarını, chargeback/iptal/iadeyi ve sözleşmeye uygun para akışını ayrı test etmelidir. Belge kaynakları: [iyzico webhook](https://docs.iyzico.com/en/advanced/webhook), [iyzico iade/iptal](https://docs.iyzico.com/en/getting-started/preliminaries/api-reference-beta/refund-and-cancel). İkinci sağlayıcı karşılaştırması/üye işyeri seçimi yapılmış sayılmaz; mevcut altyapı yeni sağlayıcı arayüzüyle genişletilir.
- Eski PENDING/SUCCESS işlemler sağlayıcı raporlarıyla uzlaştırılmalı; otomatik kör aktarım yok. Eski callback kapatılmasının dağıtım etkisi bu planın parçasıdır.
- Üretim DB yetkileri, append-only mali kayıt politikası, yedekleme/geri dönüş/failover, anahtar saklama/rotasyon, şifreli kişisel veri saklama ve silme takvimi.
- API/GraphQL kaynak ve hız sınırları, dosya kota/tarama, operasyon alarmları, worker gecikme ölçümü ve gerçek çoklu instance yük/failure testleri. Bloke olan finansal uyuşmazlıkların kanıtlı düzeltme runbook'u.
- Gerçek tarayıcı/mobil uçtan uca kabul testi ve gerçek sağlayıcının sandbox sözleşme testleri. Canlı ödeme modu için yeni, açıkça gözden geçirilmiş bir geliştirme ve yayın onayı gerekir; mevcut kodda `LIVE` modu seçerek tahsilat açma yolu yoktur.

Transaction seçiminin dayanağı: [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/), [Mongoose transaction ve session paralellik kısıtları](https://mongoosejs.com/docs/8.x/docs/transactions.html).
