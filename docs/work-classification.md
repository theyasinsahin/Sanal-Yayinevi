# Eser sınıflandırması

## Mimari ve kapsam

Önceki yapı: MongoDB `Book.genreId → Genre`, serbest `Book.tags`, GraphQL tek tür alanı; oluşturma, keşfet, okur tercihleri, öneriler, profil sorguları ve yönetici paneli bu yapıya bağlıydı. Yaş/içerik uyarısı sistemi bulunmuyordu. Basılı katalog ile dijital eserler aynı Book koleksiyonunu kullanıyor; fiziksel basım başvuruları ayrı ve değişmez sürüm kayıtları üzerinden ilerliyor.

Yeni yapı mevcut Mongoose, Apollo GraphQL ve React altyapısını kullanır. Ek bağımlılık yoktur.

| Alan | Depolama | Kural |
| --- | --- | --- |
| Eser biçimi | `Book.formatId → ClassificationTerm(FORMAT)` | Yeni eserlerde tam bir seçim |
| Tür/konu | `Book.genreIds → Genre[]` | 1–3 farklı, aktif kayıt |
| Etiket | `Book.tagIds → ClassificationTerm(TAG)[]` | İsteğe bağlı, en fazla 8 |
| Anlatım özelliği | `Book.narrativeFeatureIds → ClassificationTerm(FEATURE)[]` | İsteğe bağlı, çoklu |
| Hedef kitle | `Book.targetAudienceId → ClassificationTerm(AUDIENCE)` | İsteğe bağlı, tek seçim |
| İçerik uyarısı | `Book.contentWarningIds → ClassificationTerm(WARNING)[]` | İsteğe bağlı, çoklu |

Başlangıç verileri yalnızca `Server/src/data/classification.js` içindedir: 22 biçim, iki grupta 45 tür/konu, 8 anlatım özelliği, 4 hedef kitle ve 8 içerik uyarısı. Frontend seçenekleri veritabanından `getClassificationOptions` sorgusuyla alır. Türlerin `slug`, diğer kayıtların `(kind, slug)` kodları sabittir; ad değişikliği ilişkileri değiştirmez. Tür grupları `FICTION` ve `KNOWLEDGE` seçimlerin düzenlenmesi içindir.

Etiket gösteriminde NFC ve gereksiz boşluk düzeltmesi yapılır; harf büyüklüğü korunur. Benzersizlik anahtarı Türkçe küçük harf ve tek boşlukla hesaplanır. Kod, normalleştirilmiş metnin SHA-256 değeridir; Türkçe harfleri ASCII'ye indirgerken oluşabilecek çakışmalar önlenir. Aynı etiketi aynı anda oluşturan normal istekler benzersiz indeksle birleştirilir. Etiketler 2–50 karakterdir; arama önekli ve en fazla 20 sonuçludur. Bir kullanıcı 24 saatte en fazla 50 yeni etiket oluşturabilir. Yönetici pasifleştirmesi yeni seçimleri engeller; mevcut eser ilişkilerini silmez.

## API ve arayüz

- `createBook(classification: ClassificationInput!, ...)`, `PrintedBookInput.classification` ve `updateBookClassification` aynı backend doğrulamasını kullanır.
- `updateBookClassification` yalnızca eser sahibi, bekleyen/ret edilmiş basılı kaydın başvurucusu veya yönetici tarafından kullanılabilir. Basılı eserin onaylanması içerik düzenleme hakkı vermez.
- `Book.format`, `genres`, `classificationTags`, `narrativeFeatures`, `targetAudience`, `contentWarnings`, `classificationStatus` alanları toplu DataLoader sorgularıyla çözülür. `Book.tags` artık ortak etiketlerin gösterim adlarından üretilir.
- Eski `Book.genre`, `genreId` ve `getBooksByGenre` GraphQL alanları kaldırıldı. Sunucu ve istemci birlikte yayımlanmalıdır. Yalnızca eski alanları kullanan harici istemciler güncellenmelidir.
- `getAllGenres` artık yalnızca yeni sistemdeki konu kayıtlarını döndürür. Öneriler ve okur tercihleri aynı kayıtları kullanır.
- Oluşturma ve basılı kitap başvurusu ortak formu kullanır. Detay sayfası ile yazar çalışma alanında sınıflandırma düzenlenebilir. Form verisi sorgu yenilemeleriyle sıfırlanmaz.
- Kartta biçim ve ilk iki tür; detayda bütün alanlar gösterilir. Hedef kitle ve uyarılar birbirinin yerine geçmez. Eksik uyarı her yaşa uygunluk anlamına gelmez.
- Keşfet ve basılı katalog biçim, tür, etiket, anlatım özelliği ve hedef kitle filtrelerini birlikte uygular. Boyutlar arasında **AND**, aynı boyuttaki birden fazla kod arasında **OR** vardır. Mevcut sıralama ve sayfalama korunur. Basılı katalog filtreleri URL'dedir; geri dönüldüğünde kaybolmaz.
- Her filtre boyutu için tek dizi alanı ve tarih/sayfalama birleşik indeksi vardır; paralel dizi alanlarını tek indekste birleştirmez. Çoklu filtre sorgularının gerçek veri dağılımındaki `explain` sonuçları izlenmelidir.

## Yönetim

Mevcut Yönetim → Veri ekranında `Genre` tür/konu kayıtlarını, `ClassificationTerm` ise diğer alanları yönetir. Alan türleri `FORMAT`, `FEATURE`, `AUDIENCE`, `WARNING`, `TAG` değerleridir. Tür oluştururken grup zorunludur. Kodlar oluşturulduktan sonra değiştirilemez; ad, açıklama, sıra ve aktiflik yönetilebilir. Etiket adları yönetimden güncellendiğinde normalleştirme ve benzersizlik kontrolü uygulanır.

Book'un ilişkileri genel veri düzenleyicisinde doğrudan yazılabilir bırakılmadı; sınıflandırma mutasyonu aynı doğrulama ve yetki kurallarını uygular. Eski kaynak alanları yalnızca okunabilir durumdadır. Yönetim işlemleri mevcut yetki ve denetim kaydı mekanizmasını kullanır.

## Güvenli veri geçişi — manuel uygulama

Bu görev sırasında uygulama veya üretim veritabanına migration çalıştırılmadı. Önce veritabanı yedeği alın ve bir kopya üzerinde doğrulayın. İşlemler replica set/transaction destekleyen MongoDB gerektirir; uygulamanın mevcut basım/yönetim sistemi de bunu kullanır.

`Server` dizininde, hedef veritabanı bağlantısını mevcut `.env` içindeki `MONGO_URI` veya `MONGODB_URI` ile ayarlayın:

```powershell
cd Server
npm.cmd run migrate:classification
```

Bu komut **kuru çalıştırmadır**. Veritabanına yazmaz; `classification-report-<timestamp>.json` raporunu oluşturur. Rapor eser kimliği, eski tür, açık eşleştirme, eksik bilgiler ve eşleştirilemeyen değerleri içerir. `seedConflicts` aynı adı farklı kodla kullanan eski kayıtları gösterir; bu çakışmalar uygulanmadan önce kod/eşleştirme planında çözülmelidir. Başlangıç kaydı mevcut bir kodu otomatik değiştirmez. Format ve konu eksikliği otomatik olarak tahmin edilmez.

Raporu inceleyip staging doğrulamasından sonra:

```powershell
npm.cmd run migrate:classification -- --apply
```

Bu işlem gerekli sınıflandırma/kitap indekslerini oluşturur, başlangıç kayıtlarını tekrar çalıştırılabilir biçimde ekler ve her kaydın önceki/yeni alanlarını `classificationmigrations` koleksiyonunda saklar. İndeks kurulum süresini staging üzerinde ölçüp bakım penceresine dahil edin. Eser metni, bölüm, yazar, yorum, etkileşim, puan, yayın tarihi ve mali kayıtlar değişmez. `Book.updatedAt` da migration nedeniyle ilerletilmez. Başvuru/sürüm ve destek tutarları yeniden hesaplanmaz. Kuru çalıştırmada otomatik indeks/koleksiyon oluşturma da kapalıdır.

Eşleştirme kuralları `Server/src/services/classificationMigration.js` içindeki `mapLegacyGenre` fonksiyonundadır. İlk listeler ad ve kodlarla eşleşir; açık ek eşleştirmeler:

| Eski değer | Hedef |
| --- | --- |
| Roman, Öykü, Şiir vb. | İlgili biçim |
| Aşk, Romantik | `ask-romantik` türü |
| Mizahi, Mizah | `mizah-komedi` türü |
| Toplum | `toplum-sosyoloji` türü |
| Doğa | `doga-cevre` türü |
| Yemek | `yemek-gastronomi` türü |
| Ekonomi | `ekonomi-finans` türü |
| Gençlik | `genclik-kurgusu` türü; hedef kitle tahmin edilmez |
| Fan Kurgu, Fanfiction | `hayran-kurgusu` anlatım özelliği |
| Alternatif Evren, Seri Kurgu vb. | İlgili anlatım özelliği |

Tek eski tür, iki zorunlu boyutu birden kanıtlamaz. Bu nedenle taşınan eserler `NEEDS_REVIEW` durumunda kalır; bilinmeyen biçime Roman/Diğer atanmaz. Eksik alanlar yazar veya yönetici tarafından tamamlanınca `COMPLETE` olur. Mevcut eserlerin okunması veya bölüm düzenlemesi engellenmez.

Eski `genreId` ve ham `tags` alanları fiziksel olarak korunur; çalışma zamanı bunlardan sınıflandırma okumaz. Geçersiz veya sekizi aşan etiketler raporlanır, orijinal metinler kaynak alanda kalır. Eski okur tercihlerindeki biçim/anlatım özelliği seçimleri yeni tür listesine rastgele çevrilmez; kaynakları geçiş günlüğünde korunur ve raporlanır. Yeni türlerle eşleşen tercihler korunur; tamamen eşleşmeyen tercihler için seçim ekranı tekrar açılır.

İşlemden sonra rapor sayısını/veritabanı kayıtlarını, eksik sınıflandırmaları, kullanıcı tercihlerini ve örnek eserleri kontrol edin. İlk çalıştırmada eklenen yeni indeksleri dağıtım sırasında oluşturun/doğrulayın. Eski alanların temizlenmesi ayrı, doğrulanmış bir bakım adımıdır; bu kod otomatik fiziksel silme yapmaz.

Gerekirse, uygulamanın eski sürümüne kontrollü dönüş planıyla birlikte:

```powershell
npm.cmd run migrate:classification -- --rollback
```

Geri alma yalnızca geçişin yazdığı alanlar hâlâ aynıysa uygulanır. Sonradan değiştirilmiş kayıtlar rapordaki `conflicts` listesine alınır; üzerine yazılmaz. Başlangıç terimleri, yeni etiketler ve yeni oluşturulan eserler silinmez. Her kayıt ayrı transaction ile ele alınır; kesinti sonrası yeniden çalıştırılabilir. Geçiş günlüklerini ve veritabanı yedeğini doğrulama bitmeden silmeyin.

## Fiziksel basım

Anlatım özelliği seçmek basıma uygunluk veya hak izni değildir. Yeni basım sürümü, ilgili özellikleri `classificationReview` alanında değişmez bir özet olarak saklar. Etkileşimli/sohbet/görsel/oyunlaştırılmış/hayran/oyun evreni kurgusunda inceleme ekranı sabit baskı metni, görsel hakları ve üçüncü taraf izinlerini ayrıca hatırlatır. Dijital yayın engellenmez; mevcut editoryal inceleme, PDF doğrulamaları, hak beyanları, yönetici onayı ve destek akışı devam eder. Önceden sabitlenmiş sürümler değiştirilmez.

## Doğrulama

Yeni testler: gerçek GraphQL oluşturma/düzenleme, yetkisiz erişim, 1–3 tür, sekiz etiket, tekrarlar, pasif/yanlış alan seçimleri, Türkçe normalizasyon, AND/OR filtreler, kuru çalışma, veri korunması, tekrar uygulama, geri alma ve yazar değişiklikleriyle çakışma. Frontend testleri seçim sınırları, chip kaldırma, Türkçe etiketler, oluşturma mutasyonu, detay gösterimi ve kaydedilmemiş düzenlemenin korunmasını kapsar. İlgili istemci GraphQL belgeleri gerçek sunucu şemasına karşı doğrulanır.

Komutlar:

```powershell
cd Server
npm.cmd run test:ci
cd ../Client
npm.cmd run test:ci
npm.cmd run build
```

Proje JavaScript kullanır; ayrı TypeScript type-check komutu yoktur. Üretim derlemesi mevcut ESLint entegrasyonunu da çalıştırır. Kesin çalıştırma sonuçları görev raporunda belirtilir. Canlı veri üzerinde migration, gerçek ödeme, mobil cihaz ve tarayıcı görsel doğrulaması bu otomatik testlerin yerine geçmez.

### Uygulama sırasında alınan sonuçlar

- Frontend tam çalışma: 44 test grubu, 282 test başarılı.
- Backend tam çalışma: 25 test grubu, 327 test başarılı.
- Tam çalışmadan sonra eklenen/düzeltilen sınır durumları ayrıca tekrar doğrulandı: özel anlatım ve basım incelemesi; kod çakışmaları; gerçek CLI kuru çalıştırmasının koleksiyon/indeks/belge oluşturmaması; sınıflandırma ve yönetim kontrolleri; gruplu okur tercihleri; detay/düzenleme ekranları. Son migration grubu 9 testle başarılıdır.
- Değişen sınıflandırma arayüzleri üzerinde ESLint: hata yok.
- Üretim derlemesi başarılı; değişiklik dışındaki dosyalarda mevcut ESLint uyarıları, eski Browserslist verisi ve `babel-preset-react-app` bağımlılık uyarısı devam eder.
- `git diff --check` başarılı. Yeni bağımlılık, commit veya push yoktur.

### Temel dosya değişiklikleri

| Bölüm | Dosyalar |
| --- | --- |
| Başlangıç kataloğu ve modeller | `Server/src/data/classification.js`, `models/classificationTerm.js`, `models/book.js`, `models/genre.js` |
| Doğrulama, etiketler, filtreler | `Server/src/services/classificationService.js`, `bookCatalogService.js`, `bookService.js`, `printedBookService.js` |
| Geçiş ve geri alma | `Server/src/services/classificationMigration.js`, `Server/src/scripts/migrateClassification.js`, `Server/package.json` |
| API ve toplu ilişkiler | `Server/src/graphql/typedefs/classification.graphql`, `resolvers/classification.js`, `loaders.js`; ilgili kitap/tür/katalog şemaları ve resolver'ları |
| Tercihler ve yönetim | `Server/src/services/recommendationService.js`, `userService.js`, `adminResources.js`, `adminService.js` |
| Ortak arayüz | `Client/src/components/Books/Classification/` altında form, özet, düzenleme, filtre ve gruplu tercih bileşenleri |
| Oluşturma/gösterim | `Client/src/pages/CreateBookPage`, `BookDashboard`, `BookDetail`, `BookReader`, `PrintedBooks`; kitap kartları ve basılı kitap bileşenleri |
| Keşfet ve istemci API | `Client/src/pages/Feed`, `components/Feed/FeedFilters`, `hooks/useBookFeed.js`, `graphql/classification.js` ve ilgili kitap/profil/takip/öneri belgeleri |
| Basım uyumu | `Server/src/services/print/applicationService.js`, `models/printFunding.js`, ilgili GraphQL şeması ve `Client/src/components/PrintFunding/ApplicationDetails.jsx` |
| Regresyon testleri | `Server/tests/classification.test.js`, `clientClassificationDocuments.test.js`, `Client/src/components/Books/Classification/Classification.test.jsx`; ilgili mevcut test ve fixture güncellemeleri |

Kullanılmayan eski `GenreOnboarding` bileşeni ve doğrudan, denetimsiz tür CRUD servisleri kaldırıldı. Okur tercihlerinin gerçek kullandığı ekranlar ortak gruplu seçim arayüzüne geçti. Bu görevden önce çalışma ağacında bulunan diğer kullanıcı değişiklikleri korunmuştur.
