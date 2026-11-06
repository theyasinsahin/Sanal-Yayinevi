# Doğrulanmış Türkçe basılı katalog

Kapsam, Türkçe yayımlanan bütün türleri ve çevirileri içerir. Açık web taraması Türkiye'de yayımlanmış bütün kitapların eksiksiz envanteri değildir. İlk paket, İş Bankası Kültür Yayınları ve Yapı Kredi Yayınları'nın açık sayfalarındaki adaylardan hazırlanır; aynı ISBN'nin Kitapyurdu kaydı ikinci kaynak olarak kullanılır. İnceleme listesi `docs/printed-catalog-review.md`, kalıcı kanıt paketi `Server/src/data/printed-catalog/tr-2026-11-06.json` içindedir.

Bu ilk 254 kitaplık paket 6 Kasım 2026'da kullanıcının açık izniyle canlı kataloğa uygulandı. Mevcut 107 kitap kaydı değişmedi; basılı katalog toplamı 261 oldu. Paketin tamamı canlı API'nin 22 sayfasında doğrulandı. Sonuç: `docs/printed-catalog-live-result-2026-11-06.json`. Aşağıdaki komutlar yeni veya yeniden denetlenecek paketler için genel yönergedir.

ISBN, kitap adı, yazar, yayınevi ve sayfa sayısı iki kaynakla karşılaştırılır. Yazım/kısaltma farkları, tam kaynak değeriyle ve gerekçesiyle kaydedilir. ISBN veya sayfa sayısı uyuşmazlığı otomatik kabul edilmez. Kullanıcının “Yayınevi sözü daha geçerlidir” talimatı doğrultusunda yıl uyuşmazlığında yayınevi esas alınır; farklı kitapçı yılı silinmez. YKY'de tekrar basım tarihi varsa o yıl, yoksa YKY'deki ilk basım yılı; İş Bankası'nda görünür `Yılı` alanı kullanılır. Web sayfasının oluşturulma/güncellenme tarihi basım tarihi sayılmaz.

Her seçilen ISBN'nin iki kaynaktaki kapakları yan yana incelenir. Kaynak görsel URL'leri, indirilen dosyaların SHA-256 özetleri ve inceleme zamanı saklanır. Farklı kapak tasarımları karıştırılmaz. Aynı eserin doğrulanabilen birden fazla baskısı varsa kitapçı yorum sayısı, baskının okur görünürlüğüne ilişkin sınırlı bir gösterge olarak kullanılır. Bu sayı, kapağın tanınırlığının doğrudan ölçümü veya bütün piyasadaki en popüler baskının kanıtı değildir. Tek doğrulanabilen baskı bulunan kayıtlarda bu sınır açıkça yazılır.

Tanıtımlar, doğrulanmış künye bilgilerinden oluşturulan kısa bibliyografik açıklamalardır. Kaynakların uzun tanıtım yazıları kopyalanmaz. Katalog eklemek dijital metin, bölüm veya yazarlık hakkı vermez. Tür/biçim ataması bu paketin incelemesinde doğrulanmadığından `NEEDS_REVIEW` bırakılır; rastgele Roman/Diğer atanmaz.

## Çevrimdışı kontrol

```powershell
npm.cmd --prefix Server run catalog:printed
```

Varsayılan komut veritabanına bağlanmaz ve `.env` okumaz. Kaynak gözlemleri, inceleme kararları, zorunlu alanlar, ISBN kontrol basamağı, kapak incelemesi ve tekrarlar denetlenir. Çıktıda paket SHA-256 özeti ve yerel JSON raporu bulunur. Bu doğrulama, kaynak sitelerin bugün değişmediğini yeniden kontrol etmez; kayıtlı gözlemleri denetler. Yayına alma gecikirse kaynaklar yeniden incelenmelidir.

## Veritabanında kuru çalıştırma

Bağlantıyı güvenli oturum ortamında `PRINTED_CATALOG_MONGO_URI` olarak sağlayın; komut satırına veya sürüm kontrolüne yazmayın. Hedef veritabanının adı ayrıca belirtilir:

```powershell
npm.cmd --prefix Server run catalog:printed -- --check-db --database betik_local
```

Bu işlem veri, koleksiyon veya indeks oluşturmaz. Uzak bağlantılar için ayrıca `--allow-remote` gerekir. `.env` içindeki mevcut `MONGO_URI` otomatik kullanılmaz. Mevcut ISBN kayıtları karşılaştırılır; silinmiş, bekleyen, farklı künyeli veya farklı ISBN'li aynı eser kayıtları çakışma olarak raporlanır ve korunur.

## İncelenen paketi uygulama

Üretim veritabanında işlem için proje talimatındaki açık kullanıcı izni gerekir. Bu hazırlık kendi başına canlıya veri eklemez. Önce hedefte kuru çalıştırma raporunu inceleyin. Uygulama, etkin bir yöneticinin kimliği ve çevrimdışı kontrolden alınan tam paket özetiyle yapılır:

```powershell
npm.cmd --prefix Server run catalog:printed -- --apply --database betik_local --admin-id <aktif-yonetici-id> --expected-sha256 <paket-ozeti>
```

Mevcut benzersiz kısmi ISBN indeksi doğrulanmadan uygulama yapılmaz. Eksik indeks otomatik yeniden kurulmaz. Uygulama sırasında kaynak kayıtları için `PrintedCatalogRecord.bookId` benzersiz indeksi oluşturulur. Her yeni kitap, kaynak/inceleme kaydı ve yönetim denetim kaydı aynı transaction içindedir; MongoDB replica set gerekir. Yeni kayıt `PRINTED / APPROVED / PUBLISHED` olur. `authorId` atanmaz; dijital içerik eklenmez. Mevcut kitapların hiçbir alanı, yorumları, etkileşimleri veya hak ilişkileri güncellenmez. Tekrar çalıştırma kayıtları çoğaltmaz. Kesinti sonrasında aynı paket yeniden çalıştırılabilir; eklenen kayıtların kanıtı `PrintedCatalogRecord` içinde kalır.

Başka paket için `--manifest <dosya>`, rapor konumu için `--report <dosya>` kullanılabilir. Yeni paketlerin de aynı çift kaynak ve kapak incelemesinden geçmesi gerekir; otomatik keşif sonucu doğrudan onaylanmış kitap sayılmaz.

## Doğrulama

```powershell
npm.cmd --prefix Server run test:ci -- tests/printedCatalogImport.test.js tests/printedCatalogData.test.js tests/printedBooks.test.js tests/printedReadings.test.js
```

6 Kasım 2026 hazırlığında dört test dosyası ve 53 test geçti. Gerçek 254 kayıtlık paket geçici MongoDB replica set üzerinde içe aktarıldı ve tekrar çalıştırıldı; kayıt, kaynak kanıtı ve yönetim denetimi sayıları doğrulandı. CLI'nin varsayılan kontrolünün ortamda MongoDB değişkenleri olsa da çevrimdışı kaldığı, uzak erişim bayrağını zorunlu tuttuğu ve kimlik bilgilerini çıktıya yazmadığı da sınandı. Canlı veritabanına bağlanılmadı.
