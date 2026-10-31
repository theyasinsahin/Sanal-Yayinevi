# Bölüm görünürlüğü ve profil bağlantıları

Çalışma branch'i: `feature/chapter-visibility-and-profile-links`, güncel `develop` üzerinden açıldı. `main` içine birleşmiş `fix/homepage-desktop-book-cards` yerelden ve origin'den kaldırıldı. Birleşmemiş `feature/quote-privacy` korundu. Main'e commit/merge/push yapılmadı.

## Bölüm gizleme

- `Chapter.isHidden` varsayılan olarak `false`; eski bölümler görünür kalır. Toplu veritabanı migration'ı gerekmez.
- `createChapter` ve `updateChapter` isteğe bağlı `isHidden` alır. Yetki, bölümün değil **kitabın sahibine** göre mevcut yazarlık kontrolüyle doğrulanır. Yönetici erişimi korunur. Destek/ödeme yapmak erişim hakkı vermez.
- `Chapter.canReadContent` her istek için sunucuda hesaplanır. Gizli metni yalnızca kitabın sahibi ve yetkili yönetici okuyabilir. Okuyucu başlık, `isHidden`, `wordCount` ve mevcut `pageCount` alanlarını görür; `content` boş metindir. Draft/silinmiş kitap ve pasif yazar erişim kontrolleri de uygulanır.
- Koruma `Chapter.content` alan çözümleyicisindedir: tek bölüm, kitap içi bölümler, bütün bölümler, yazara göre liste, seçili bölüm ve tam kitap sorguları aynı kuralı kullanır. İlişkiler DataLoader ile toplu çözülür.
- Kelime sayısı yeni/değişen metinden sunucuda hesaplanır; istemciden kabul edilmez. Eski bölümlerde kayıtlı sayfa sayısı gösterilir; kelime sayısı ilk düzenleme veya gizleme işleminde kalıcı hesaplanır.
- Yazar ekranındaki gizle/aç düğmesi, bekleyen otomatik kayıt tamamlandıktan sonra çalışır. Seçimler ve taslak metin korunur; hata durumunda erişim değişmiş gibi gösterilmez. Bölüm listesinde gizli kayıtlar işaretlidir; yeni bölüm doğrudan gizli oluşturulabilir.
- Okuyucunun bölüm ve kitap görünümleri kapalı bölüm kartı gösterir. Başlık, uzunluk, durum açıklaması ve destek bağlantısı bulunur. Gizli bölüm tamamlanmış işaretlenemez; okuma puanı ve ayraç üretmez. Eski tamamlanma kayıtları sunucu cevabında gizli bölümler için filtrelenir.
- Paragraf yorumları, yeni alıntılar, alıntı listeleri, alıntı yorumları ve herkese açık paylaşım önizlemeleri gizli bölüm metnini açığa çıkaramaz. İlgili eski alıntılar bölüm yeniden açılınca tekrar görünür olabilir; verileri silinmez. Kitap aramasında gizli bölümlerin alıntıları arama eşleşmesi oluşturmaz.
- Fiziksel basım sürümü kitabın tüm metnini içerir; gizleme yalnızca okuyucu önizlemesini sınırlar. Mevcut basım başvurusu, hak onayları ve ödeme akışı değiştirilmedi.

Sunucu ve istemci birlikte güncellenmelidir. Bölüm içerik sorgusu okuyucuda `no-cache` kullanır. Daha önce görüntülenmiş, kopyalanmış veya indirilmiş içerik geri alınamaz; görünürlük bir DRM sistemi değildir.

## İçerik uyarısı

`istismar` başlangıç seçeneklerinden çıkarıldı. `getClassificationOptions` mevcut veritabanında aktif olsa bile bu uyarıyı döndürmez; yeni eser/sınıflandırma doğrulaması da kabul etmez. Mevcut kitap referansları silinmez. Sınıflandırma başlangıç verisi daha sonra manuel güncellenirse eski uyarı kaydı pasifleştirilir. Bu görevde üretim veritabanında işlem yapılmadı.

## Profil bağlantıları

Ortak `UserProfileLink`, `profilePath` ile kullanıcı adına veya mevcut kimliğe yönlendirir. Kullanıcı bilgisi yoksa kırık bağlantı üretmez. İçinde bulunduğu kitap kartının tıklamasını tetiklemez; klavye odağı ve normal bağlantı davranışı korunur.

Kitap yorumları ve yanıtları, paragraf yorumları, oturum yazıları ve oluşturucuları, kitap kartındaki yazar, alıntı seçim önizlemesi ve mesajlardaki kitap yazarı bağlantıları bu bileşeni kullanır. Sohbet başlığındaki mevcut olmayan `/profile/:username` yolu düzeltildi. Konuşma/alıcı seçmek için kullanılan satırların seçim davranışı korunur.

## Doğrulama

Yeni testler bütün GraphQL bölüm erişim yollarında gizli metnin gönderilmemesini, yazar/yönetici erişimini, yetkisiz görünürlük değişikliğini, yeniden açmayı, uzunluk bilgisini, puan/ayraç/tamamlanma kısıtlarını, yorum/alıntı/paylaşım kısıtlarını ve eski bölüm uyumluluğunu kapsar.

Frontend testleri kapalı bölümün iki okuyucu görünümünde gösterilmesini, tamamlamanın engellenmesini, yazar gizleme işleminden önce taslağın kaydedilmesini ve yorum/yanıt adından profile gerçek gezinmeyi doğrular. Basım testi gizli bölümlerin yetkili basım sürümünde kaldığını kontrol eder. Tam proje testleri ve üretim derlemesi çalıştırılır; sonuçlar görev sonunda raporlanır.

Sonuçlar: backend tam çalışmada 26 grup/338 test; frontend son tam çalışmada 45 grup/287 test başarılı. Tam çalışmadan sonraki ek gizlilik kontrolleri ayrıca 9 testle tekrar doğrulandı. Değişen arayüzlerde ESLint hatası yok; mevcut bağımlılık ve mesajlaşma dosyası uyarıları sürüyor. Üretim derlemesi başarılı. `git diff --check` temiz. Commit/push yapılmadı; üretim veritabanına ve gizli yapılandırmalara dokunulmadı.
