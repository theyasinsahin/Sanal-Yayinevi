# Betik performans çalışması

## Bulgular ve uygulama planı

Çalışma branch'i: `feature/performance-optimization`. Önceki oturum kapağı çalışmasının commitlenmemiş dosyaları korunmuştur. Canlı veritabanına bağlanılmamış, hosting veya gizli yapılandırma değiştirilmemiştir.

Başlangıçta React bütün sayfaları, yönetim ekranlarını ve Quill düzenleyicisini tek açılış paketine katıyordu. Ana sayfa dört kitap göstermek için tüm dijital kataloğu ve yorumları indiriyordu. Keşfet, aynı katalog yanında bütün kullanıcıları da indirip yazarı tarayıcıda eşleştiriyordu. GraphQL her kitap için yazar, tür ve yorum sayısını ayrı sorguluyordu. Kitap detayında tüm bölümlerin metni, okuyucuda ise henüz açılmayan bölümlerin metinleri yükleniyordu.

Bu nedenle uygulanan sıra:

1. Aynı geçici veri kümesiyle gerçek istemci GraphQL belgelerini ve production JavaScript paketini ölçmek.
2. Katalogda sunucu tarafında filtreleme, sıralama ve cursor sayfalaması; ekrana göre kart, detay, okuyucu metadata ve tek bölüm sorguları.
3. GraphQL ilişkilerinde istek başına toplu okuma; liste işlemlerinde projection ve uygun yerlerde `lean()`; sıralama indeksleri.
4. Route bazında kod bölme, paylaşım pencerelerini açılınca yükleme, gereksiz arka plan sorgularını azaltma ve HTTP sıkıştırma.
5. Davranış testleri, sorgu/veri boyutu bütçeleri, aynı fixture ile tekrar ölçüm ve production derlemesi.

## Kodda değişen davranışlar

- React `lazy` ve `Suspense` ile sayfalar ayrı yüklenir. Ana sayfa kodu başlangıçta hazırdır; düzenleyici ve admin kodları kendi sayfalarında gelir. Yükleme hatasında kullanıcı yeniden yükleme seçeneği görür. Editörün CSS'i de kendi route'unda yüklenir.
- `getBookFeed` varsayılan 24, en fazla 48 kitap getirir. Ana sayfa yalnızca 4 ister. Keşfet'te “Daha fazla göster” devam sayfasını ekler. Arama 250 ms bekler; kitap adı, kullanıcı adı ve ad soyad ile arar. Tür ve dört sıralama sunucuda uygulanır. Tarih/puan eşitliklerinde `_id` ikinci sıralama alanıdır. Arama metni regex olarak çalıştırılmaz; cursor, arama uzunluğu ve limit doğrulanır. Aynı anda değişen puan/tarih değerleri sıralamayı değiştirebilir; bu bir snapshot değildir. İstemci tekrar gelen kimlikleri tekilleştirir.
- Keşfet bütün kullanıcıları veya yorumları indirmez. Öneriler yalnızca ilgili sekme ve tamamlanmış tercihler için istenir. Öneri skorunda tür ve takip kümeleri aday başına yeniden oluşturulmaz.
- Kart için `GET_BOOK_CARD`, detay için `GET_BOOK_DETAIL` kullanılır. Detay kendi yorum sorgusunu kullanmaya devam eder; kitap sorgusunda aynı yorumlar tekrar gelmez. Düzenleyicinin tam içerik sorgusu korunur.
- Okuyucu önce bölüm kimlikleri/başlıklarını alır. Ayraç/okuma geçmişi çözüldükten sonra yalnızca açılacak bölüm `getReadingChapter` ile gelir. Bölüm sorgusu kitabı, taslak erişimini, silinme durumunu ve bölümün doğru kitaba ait olmasını kontrol eder. Kitap görünümü seçilirse bütün metin ayrıca getirilir ve yalnızca bu görünümde sayfalara ayrılır. Bu büyük yanıt ortak Apollo önbelleğini doldurmaz. Gövde yüklenmeden puan sayacı başlamaz; hata ve tekrar deneme durumları görünürdür.
- Bölüm başlıkları, ayraç ve ilerleme doğrulamasında `content` veritabanından çıkarılır. İstek gerçekten metni seçiyorsa bölüm resolver'ı metni korur; fragment'lar da desteklenir.
- DataLoader, aynı GraphQL isteğindeki yazarları ve türleri toplu okur; yorum sayılarını tek aggregation ile hesaplar. Silinmiş/pasif kullanıcı filtreleri korunur. Önbellek her HTTP isteğinde yeniden oluşur; kullanıcılar arasında paylaşılmaz. Kimlik sanal alanına ihtiyaç duyan Mongoose belgeleri gelişi güzel `lean()` yapılmaz.
- Katalog tarih/popülerlik/tür sıralamaları ve kitap içindeki bölüm sırası için birleşik indeks tanımları eklendi. Yorumların `bookId/isDeleted` indeksi zaten vardı. Bunlar canlıda elle oluşturulmadı; dağıtım sırasında mevcut indeks yönetimi politikasına göre değerlendirilmelidir.
- API, 1 KB üstündeki uygun HTTP yanıtlarında gzip kullanır. CORS preflight sonucu 10 dakika saklanabilir. `Server-Timing: graphql;dur=...` GraphQL işleme süresini gösterir; DNS/TLS, kimlik doğrulama context hazırlığı, dosya indirme ve toplam sayfa süresi değildir. Kullanıcıya özel GraphQL yanıtları için ortak CDN yanıt önbelleği eklenmedi.
- Mesaj sayacı giriş yapılmadan sorgulanmaz. Mesaj ve puan yoklamaları gizli sekmede atlanır; görünür sekmede mevcut anlık güncellemeler/yedek yoklama korunur.
- Kitap kapağı yoksa yerel küçük SVG kullanılır. Harici placeholder isteği ve hatalı görselin sonsuz tekrar denemesi kaldırılır; boyut ve async decode tanımlıdır.

## Ölçüm ve tekrar çalıştırma

`Server/src/scripts/performanceBenchmark.js` **yalnızca MongoMemoryReplSet'in geçici bağlantısını** kullanır; uygulamanın `MONGO_URI` değerini okumaz. 48 kitap, 6 yazar, kitap başına 12 bölüm ve 5 yorum oluşturur. Her bölüm 13.007 bayttır. Gerçek istemci belgelerini Apollo şemasında üç kez çalıştırır ve ortanca süreyi, JSON/gzip boyutunu, Mongoose işlem sayısını kaydeder. Güncel production build'in ilk JavaScript girişlerini de ölçer.

Ham ölçümler: [önce](performance/baseline.json), [sonra](performance/optimized.json). Bu sentetik, tek istemcili, yerel ölçümdür. Ağ gecikmesi, hosting uykusu, gerçek cihazdaki render ve eşzamanlı trafik ölçülmez. Tekrarlanan metinler çok iyi sıkışır; fixture gzip oranını gerçek kitaplara genellememek gerekir. Kitap detayı ölçümü yalnızca ana kitap sorgusudur; ayrı yorum/alıntı isteklerinin toplamı değildir. Eski katalog tüm 48 kitabı, yeni ilk sayfa 24 kitabı getirir; ayrıca aynı 48 kartla kıyas için `catalogAllCards` ölçülür. Okuyucunun ilk içerik maliyeti `reader + readingChapter` toplamıdır; yalnızca metadata ile kıyas yapmak yanıltır.

### Sonuçlar

26 Ekim 2026 tarihinde güncel production derlemesiyle ölçüm tamamlandı. Aşağıdaki veri boyutları, JavaScript satırı dışındaki satırlarda sıkıştırılmamış JSON boyutlarıdır.

| Ölçüm | Önce | Sonra | Azalma |
| --- | ---: | ---: | ---: |
| İlk JavaScript, gzip | 312.482 bayt | 186.359 bayt | %40,4 |
| Aynı 48 kitap için veritabanı işlemi | 530 | 6 | %98,9 |
| Aynı 48 kartın katalog yanıtı | 146.675 bayt | 31.152 bayt | %78,8 |
| Kitap detayının ana sorgusu | 160.733 bayt | 2.147 bayt | %98,7 |
| Okuyucu başlangıcı: metadata + bir bölüm | 157.212 bayt | 14.153 bayt | %91,0 |

Yeni ana sayfa sorgusu yalnızca dört kitap için 2.757 bayt, Keşfet'in 24 kitaplık ilk sayfası 15.677 bayt üretti. Bunlar aynı 48 kartı karşılaştıran satırdan ayrı kullanım senaryolarıdır. JSON ölçümleri GraphQL transport zarfını ve HTTP başlıklarını içermez.

Okuyucuda metadata ile seçili bölüm ayrı isteklerdir; bu iki sorgunun toplamı fixture'da 10 veritabanı işlemi yapar. Önceki metadata/tam içerik sorgusu 5 işlem yapıyordu; yeni düzende yazarı öğrenmek için ayrıca tam kullanıcı profili sorgusu gerekmez. Büyük metin transferi ve gereksiz ayrıştırma azaltılırken bir ek ağ isteği oluşur. Bu nedenle her ekranda daha az istek veya aynı yüzdeyle daha kısa açılış süresi iddia edilmiyor. Yerel süreler ham JSON kaydında bulunur; cihaz yükü ve ağ farklılıkları nedeniyle bir canlı hızlanma yüzdesine dönüştürülmemiştir.

### Doğrulama

- Server: 17 test dosyası, **160 test geçti**.
- Client: 26 test dosyası, **155 test geçti**; başlangıçtaki örnek `App.test.js`, ana sayfanın admin ve editör modüllerini yüklemediğini denetleyen teste dönüştürüldü.
- Son production derlemesi başarılı. Başlangıç JavaScript'i 186.359 gzip baytı ile 225.280 baytlık bütçenin altında.
- `git diff --check` temiz. Commit, push ve production dağıtımı yapılmadı.
- Mevcut CRA/Babel bağımlılık, eski Browserslist verisi ve mevcut lint uyarıları sürüyor; derleme hatası yok. Testlerde mevcut React test aracı kullanım dışı kalma uyarıları da bulunuyor.

Testleri kararlı hale getirmek için puan testlerinde global `Date.now` taklidi kaldırıldı; yalnızca geçici veritabanındaki okuma oturumu tarihleri ilerletiliyor. Böylece MongoDB/Mongoose bağlantı heartbeat saati etkilenmiyor. Takip hata testinin asenkron düğme durumunu beklemesi düzeltildi. İstemci testleri ağır listelerde en fazla üç saniye DOM bekliyor; performans bütçeleri bu bekleme süresinden bağımsız. Yeni sayfalama testleri çift tıklama, gecikmiş eski sayfa yanıtı, filtre değişimi ve yazarken aramayı doğruluyor. `MockedProvider` fragment ve normalizasyon davranışında production ile aynı `__typename` ayarını kullanıyor.

```powershell
cd Client
npm.cmd run build
npm.cmd run perf:bundle
$env:CI = 'true'
npm.cmd test -- --watch=false --runInBand
cd ../Server
npm.cmd run test:performance
npm.cmd test -- --runInBand --testTimeout=30000
npm.cmd run perf:benchmark
```

Build sonrasında başlangıç JavaScript gzip bütçesi 220 KiB'dir. Katalog entegrasyon testi 4 ve 48 kart için eşit sayıda ve en fazla 8 veritabanı işlemi bekler; yorum listesi veya bölüm okumasına izin vermez. Detay/okuyucu metadata yanıtı fixture'da 6 KB altında kalmalı ve MongoDB projection'ında `content: 0` bulunmalıdır. Testler ayrıca cursor sıralamasını, filtreleri, erişim izinlerini, önbelleğin istekler arasında taşınmamasını ve gzip/identity eşdeğerliğini doğrular. Bunlar değişken CI donanımında kırılgan milisaniye eşiklerinden daha güvenilir regresyon sınırlarıdır.

İstemcide `REACT_APP_PERFORMANCE_DEBUG=true` ile build alınırsa mevcut `web-vitals` ölçümleri (LCP, CLS, FCP, TTFB ve eski FID) konsola yazılır; dış servise veri gönderilmez. Bu eski kütüphane INP ölçmez. Chrome DevTools Network'te Disable cache ve Fast/Slow 4G ile ana sayfa, Keşfet, kitap detayı ve kaldığı yerden okuma akışlarını en az beş kez ölçüp ortancayı karşılaştırın. İlk ziyaret ile sıcak önbellekli ziyareti ayrı değerlendirin. `Server-Timing` sunucunun payını ayırmaya yardımcı olur. Gerçek production LCP/INP için ayrıca tarayıcı/saha ölçümü gereklidir.

## Kalan mimari maliyetler

- Uygulama hâlâ istemci tarafında render edilen CRA/React SPA'dır. İlk HTML içerik göstermez; JavaScript ve API yanıtını bekler. Route bölme bu maliyeti azaltır. SSR/SSG veya framework/build sistemi geçişi ayrı, geniş bir çalışma gerektirir. React StrictMode geliştirme kontrolleri korunmuştur; `npm start` süresi production performans ölçümü sayılmaz.
- Okunabilir URL'yi kimliğe çözen `PublicContentRoute`, sayfa sorgusundan önce ayrı API isteği yapar. Gelecekte referans çözümü ile ekran verisini tek resolver'da birleştirmek bu gidiş gelişi kaldırabilir. Yetki ve eski URL yönlendirmeleri nedeniyle burada kalıcı ortak önbellek uygulanmamıştır. Eski kayıtlarda eksik slug'ın ilk erişimde üretilmesi de ek okuma/yazma yapabilir.
- Öneri algoritması hâlâ aday kataloğunu bellekte puanlar. Gereksiz çağrılar ve iç içe tekrarlar azaltıldı; çok büyük katalog için çevrim dışı aday üretimi, önceden hesaplanan öneriler veya arama servisi gerekir. Anlamı değiştirecek rastgele aday sınırı eklenmedi.
- Profil kütüphanesi/takip listeleri ve bazı yönetim/yazar listeleri hâlâ sınırsızdır. Çok büyük hesaplarda ayrı sayfalama gerekir. Mevcut API belgeleri diğer ekranların davranışını korumak için kaldırılmadı; yeni sorgulara geçmeyen tüketiciler geniş veri istemeye devam edebilir.
- Alt metin araması (`/kelime/i`) normal B-tree indeksinden sınırlı yararlanır. Büyük katalogda Türkçe analizörü olan MongoDB Search veya ayrı arama servisi değerlendirilmelidir; sağlayıcı/indeks/ücret kararını gerektirir.
- Pasif kullanıcıların kimlik listesi istek içinde tekrar kullanılabilir, ancak katalog ve mevcut servis yollarında hâlâ ayrı alınır. Büyük pasif hesap kümelerinde görünürlük bilgisini içerikte denormalize etmek ve bunu hesap durumuyla tutarlı güncellemek ayrı bir veri modeli çalışmasıdır.
- PubSub süreç belleğindedir. Sadece süreç/instance sayısını artırmak canlı bildirimlerin farklı instance'lara ulaşmamasına neden olabilir. Birden fazla instance öncesinde ortak PubSub altyapısı gerekir.
- Kitap görünümü bütün kitabı ayrıştırdığı için çok uzun kitaplarda CPU/bellek maliyeti sürer. Varsayılan bölüm görünümü bu maliyeti ödemez. İleri aşamada worker ve parça bazlı sayfalama değerlendirilebilir.
- Okuma puanının 15 saniyelik doğrulama istekleri ve transaction maliyeti korunur. Bunları kaldırmak çoklu sekme, tekrar gönderim ve doğrulanmamış süreye puan verme kontrollerini zayıflatır; daha ileri optimizasyon bu tutarlılık koşullarını korumalıdır.

## Dağıtım sırası

Önce yeni GraphQL sorgularını ve bağımlılıkları içeren Server sürümünü, ardından Client production build'ini yayınlayın. Eski Client belgeleri kaldırılmadığı için bu sıra geriye uyumludur; yeni Client, eski Server'da bulunmayan `getBookFeed/getReadingChapter` alanlarını kullanır. İndeks tanımları uygulamanın mevcut Mongoose indeks ayarlarına tabidir; veritabanı yetkileri ve indeks oluşturma politikası hosting panelinden kontrol edilmelidir.

Geri dönüş gerekiyorsa önce Client'ı eski sürüme alın, ardından Server'ı geri alın. Yeni indeksler geri dönüşte elle silinmek zorunda değildir. İstek bazındaki DataLoader önbelleği için Redis veya yeni ortam değişkeni gerekmez. Performance debug çıktısı varsayılan olarak kapalıdır.

## Hosting ve hesap erişimiyle yapılabilecekler

Bu maddeler mevcut sorunun doğrulanmış hosting teşhisi değildir; sağlayıcı paneli ve canlı ölçümler görülmeden hangi maddenin etkili olduğu söylenemez.

1. API hizmeti uykuya geçiyorsa sürekli çalışan instance kullanın. İlk istekle sonraki istek arasında büyük TTFB farkı varsa panel loglarıyla cold start'ı doğrulayın.
2. API ve MongoDB'yi aynı bölgede tutun; kullanıcıların konumuna uygun bölge seçin. Her veritabanı gidiş gelişinin coğrafi gecikmesini kod sıfırlayamaz. Plan değişikliğini gerçek bağlantı gecikmesi/CPU/RAM ile gerekçelendirin.
3. Frontend'i production build olarak CDN'den sunun. Hash içeren `/static/*` dosyalarında uzun `max-age` + `immutable`, HTML ve `service-worker.js` için yeniden doğrulama uygulayın. Eski chunk'ları yayına çıkışta hemen silmeyin; açık sekmeler eski hash'leri isteyebilir. Gzip/Brotli'yi CDN/reverse proxy'de etkinleştirin. API için kullanıcıya özel POST yanıtlarını topluca cache'lemeyin.
4. `NODE_ENV=production` ile çalıştırın. MongoDB profiler/Atlas Query Profiler üzerinden yavaş sorguların `explain('executionStats')` çıktısını kontrol edin. Yeni indekslerin varlığını ve kullanıldığını doğrulayın; büyük koleksiyonda indeks oluşturmayı bakım politikanıza göre planlayın. `syncIndexes()` ile bilinmeyen indeksleri otomatik silmeyin.
5. Bağlantı havuzunu instance kapasitesi ve MongoDB bağlantı sınırlarına göre ölçerek ayarlayın. Her istekte yeniden bağlantı kuran bir uygulama yok; rastgele büyük `maxPoolSize` değeri eklemek çözüm değildir.
6. Gerçek kullanıcı metrikleri/APM için kendi hesabınızdaki sağlayıcıyı ve veri politikasını seçin. Bu çalışma telemetry hesabı açmaz, ücretli hizmet etkinleştirmez veya canlı yük testi başlatmaz. Trafik altında p95/p99 ölçümü staging ortamında planlanmalıdır.

## Teknik kaynaklar

- [React lazy](https://react.dev/reference/react/lazy): bileşen kodunu ilk kullanıma erteleme ve Suspense sınırı.
- [Apollo Server veri getirme](https://www.apollographql.com/docs/apollo-server/data/fetching-data) ve [DataLoader](https://github.com/graphql/dataloader): N+1 azaltma ve istek bazında batch/cache.
- [Mongoose lean](https://mongoosejs.com/docs/tutorials/lean.html): salt okunur liste maliyetleri ve sanal alan/getter kısıtları.
- [MongoDB sorgu optimizasyonu](https://www.mongodb.com/docs/v8.0/core/query-optimization/): indeks, projection ve sınırlandırılmış sorgular.
- [Express production performansı](https://expressjs.com/en/advanced/best-practice-performance/): sıkıştırma, production modu, reverse proxy ve ortam ayarları.
- [Apollo useQuery](https://www.apollographql.com/docs/react/v3/api/react/hooks): `skipPollAttempt` ile görünür olmayan sekmelerde yoklamayı atlama; kurulu 3.13 sürümünün tip tanımı da kontrol edildi.
