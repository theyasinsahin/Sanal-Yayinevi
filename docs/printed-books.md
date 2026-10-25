# Basılı kitap kataloğu ve yazar hak talepleri

Basılı kitaplar `/published-books`, yönetim kuyruğu `/admin/printed-books` adresindedir. Normal dijital kitap oluşturma ve fonlama akışı ayrı kalır. Mevcut `Book` kayıtları `kind` alanı yokken de dijital kitap kabul edilir.

## Başvuru ve yayın

Giriş yapan kullanıcılar ISBN ile künye bilgisi arayabilir veya bilgileri elle doldurabilir. ISBN-10 kontrol basamağı doğrulanarak ISBN-13'e dönüştürülür; ISBN-13 için 978/979 öneki ve kontrol basamağı doğrulanır. `Book.isbn` üzerinde benzersiz kısmi indeks, boş ISBN alanlarını dışarıda tutar. Silinmiş veya reddedilmiş kayıtların ISBN'leri de ikinci bir kitap için kullanılamaz. Aynı başvuran, reddedilen ISBN kaydını düzeltilmiş bilgilerle yeniden incelemeye gönderebilir. ISBN bulunmayan başvuruların olası tekrarlarını yönetici incelemelidir.

Open Library'nin sabit `https://openlibrary.org/isbn/{ISBN}.json` adresi künye desteği için kullanılır; yalnızca tanınan `/authors/OL…A` yolları üzerinden en fazla üç yazar adı alınır. İstekler zaman aşımına tabidir. Sağlayıcıda kayıt yoksa veya hizmete erişilemiyorsa elle giriş kullanılabilir. Bu sonuç, kitabın basıldığının veya başvuranın yazarlığının otomatik doğrulaması değildir. [Open Library API](https://openlibrary.org/dev/docs/api/books).

Başvuru sahibi, tanıtım ve basılı baskı bilgileriyle birlikte yayınevi/katalog bağlantısını gönderir. Kapak ve satın alma bağlantıları isteğe bağlıdır. Kullanıcı kaynaklı bağlantılar sunucuda getirilmez; HTTPS adresleri kabul edilir. Başvuru `publicationStatus=PENDING`, `status=DRAFT` olarak kaydedilir ve içerik/yazarlık yetkisi verilmez. Yönetici onayında `APPROVED/PUBLISHED` olur; ret gerekçesi zorunludur. Bekleyen/reddedilen kayıtlara yalnızca başvuran ve yönetici erişebilir. İnceleme belgeleri ve başvuran bilgileri herkese açık kitap alanlarından gizlenir.

ISBN belirli bir baskı/formatın kimliğidir; telif veya dijital yayın hakkı kanıtı değildir. Bandrol ise fiziksel nüshaya uygulanan güvenlik etiketidir. Bu sürümde ISBN ve insan incelemesi kullanılır; Bakanlığın bandrol sorgulama hizmetine özel bir API entegrasyonu yapılmaz. Kaynaklar: [Uluslararası ISBN Ajansı](https://www.isbn-international.org/content/what-isbn/10), [Kültür ve Turizm Bakanlığı](https://telifhaklari.ktb.gov.tr/TR-332476/bandrol-yeni.html).

## Yorumlar, alıntılar ve içerik yetkisi

Onaylanmış bir basılı kitapta kullanıcılar yorum yazabilir; bölüm olmadan 10–1000 karakterlik alıntı ve geçerli basılı sayfa numarası paylaşabilir. Alıntı notu en fazla 1000 karakterdir. Sonradan yazarın eklediği dijital bölümlerden mevcut okuyucu aracıyla alıntı yapmak da mümkündür. `Quote.chapterId` bu nedenle isteğe bağlıdır; dijital kitapların alıntılarında bölüm ilişkisinin geçerliliği sunucuda kontrol edilir.

Katalogdaki kitabın yazarı olduğunu belirten kullanıcı, yazarlık ve dijital yayın yetkisini destekleyen açıklama/bağlantıyla ayrı bir hak talebi gönderir. Açıklama yalnızca talep sahibi ve yönetime açıktır. Aynı kullanıcının aynı kitapta yalnızca bir bekleyen talebi olabilir. Yönetici onayı, kitabın `authorId` alanını atar ve kullanıcının kitap listesine ekler; diğer bekleyen talepler gerekçesiyle kapatılır. Reddedilen kişi yeni bilgilerle yeniden talep gönderebilir.

Başvuru, inceleme ve hak onayı işlemleri bildirimlerle birlikte MongoDB transaction'ında yürütülür. Kitap üzerinde koşullu yazma, iki talebin eşzamanlı onaylanarak iki farklı kişiye yetki vermesini engeller. Bölüm ekleme/düzenleme/silme API'leri de onaylanmış yazar yetkisini denetler. Kitabı ekleyen veya yalnızca ISBN bilen kişi içerik ekleyemez. Yazar yetkisi onaylanınca mevcut bölüm editörü ve otomatik kayıt kullanılır; basılı sayfa sayısı, dijital bölüm sayfalamasıyla değiştirilmez. Basılı kayıtlar genel kitap düzenleme, fonlama veya yazar tarafından katalogdan silme akışına alınamaz.

## API ve doğrulama

Sorgular: `getPrintedBooks`, `lookupPrintedBook`, `getMyPrintedSubmissions`, `getPrintedBookReviews`, `getBookClaimReviews`. Mutasyonlar: `submitPrintedBook`, `reviewPrintedBook`, `requestBookClaim`, `reviewBookClaim`. Yönetim sorguları ve inceleme mutasyonları sunucuda `ADMIN` rolü gerektirir. Katalog 12 kayıtlık sayfalarla, inceleme kuyrukları ilk 100 bekleyen kayıtla döner; incelendikçe sıradaki kayıtlar görünür.

MongoDB replica set gerekir; mevcut takip onayı sistemi de aynı gereksinime sahiptir. Yeni `Book` ve `BookClaim` indeksleri dağıtımda oluşturulmalıdır; üretimde `autoIndex` kapalıysa kontrollü indeks oluşturma dağıtım sürecine eklenmelidir. Bu çalışma üretim veritabanında işlem veya veri taşıması yapmaz.

`Server/tests/printedBooks.test.js` ISBN, görünürlük, özel kanıt alanları, yorum/alıntı, eşzamanlı başvurular, hak talepleri ve içerik yetkilerini gerçek geçici replica set üzerinde doğrular. `Client/src/pages/PrintedBooks/PrintedBooks.test.jsx` katalog, başvuru, elle giriş, hak talebi, alıntı ve yönetim incelemesini doğrular.
