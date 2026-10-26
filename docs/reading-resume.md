# Kaldığı bölümden okumaya devam etme

## Açılış kuralları

1. URL bir bölüm belirtiyorsa o bölüm açılır. Mevcut okunmuş işaretleri korunur;
   doğrudan bağlantı önceki bölümlerin okunduğu anlamına gelmez.
2. Normal kitap açılışında geçerli paragraf ayracı önceliklidir. Bölüm kimliği
   kullanılır; ayracın eski bölüm indeksi kullanılmaz. Bölüm açıldıktan sonra
   işaretli paragraf görünür alana kaydırılır.
3. Ayraç yoksa son okunan bölüm, sunucu ve bu cihazdaki ilerleme kayıtlarından
   seçilir. Gönderilmemiş yerel değişiklikler korunur; diğer durumlarda güncel
   tarihli kayıt esas alınır.
4. Eski sunucu kaydında son bölüm yoksa ilk tamamlanmamış bölüm seçilir. Tüm
   bölümler bitmişse son bölüm açılır. Geçerli kayıt yoksa ilk bölüm açılır.

Ayraçtan veya ilerlemeden devam edildiğinde açılan bölümden önceki tüm bölümler
okundu işaretlenir. Açılan bölüm otomatik tamamlanmaz; önceden özellikle
tamamlandıysa işareti korunur. Okundu kutuları ve “Tamamla ve Devam Et”
düğmesi çalışmaya devam eder. Bu kayıtlar okuma puanı vermez; puan takibi ayrı
doğrulanmış süre oturumunu kullanır ve ilerleme geri yüklendikten sonra başlar.

## Kayıt ve eşitleme

`ReadingProgress.lastChapterId` son bölümü tutar. `completedChapters`, mevcut
modeldeki bölüm kimlikleridir. `saveReadingProgress` oturum açmış kullanıcının
kitaba ve bölüme erişimini doğrular; başka veya silinmiş bölümlerin kimlikleri
tamamlanma sayısını artırmaz. Konum, tamamlanan bölümler ve `isCompleted` aynı
doküman güncellemesinde yazılır. Kutunun işaretini kaldırmak kitabı yeniden
tamamlanmamış hale getirebilir. Eski `markChapterAsRead` yolu da bölüm üyeliğini
doğrular ve eşzamanlı tamamlama kayıtlarını kaybetmeden çalışır.

İstemci kitap, ayraç ve ilerleme sorgularının sonuçlanmasını bekler. Bu sırada
varsayılan ilk bölüm saklanan konumun üzerine yazılmaz. Özel sorgular Apollo
önbelleğine yazılmaz; hesaplar arasında eski özel kayıt paylaşılmaz. Hesap veya
kitap değişiminde okuyucunun durumu yeniden oluşturulur.

Yerel anahtar `book-progress-{kullanıcıId|guest}-{kitapId}` şeklindedir. Eski,
hesap bilgisi içermeyen `book-progress-{kitapId}` kaydı ilk kullanıldığı hesaba
veya misafir kapsamına bir kez aktarılıp ortak anahtar kaldırılır. Eski formatın
asıl sahibi belirlenemez; aktarım sonrasında yeni kayıtlar hesaplara ayrılır.
İndeksli eski kayıtlar mevcut bölüm listesiyle kimliklere dönüştürülür. Yeni
kayıtlarda bölüm sırası değişse bile kimlik esas alınır.

Değişiklikler hemen yerel kayda, 250 ms sonra sıralı isteklerle sunucuya yazılır.
Her yerel değişiklik sunucu onayına kadar `pending` kalır. Eski bir isteğin
yanıtı daha yeni yerel seçimin onayını silemez. Sayfadan ayrılmada `keepalive`
isteği kullanılır. Hesap değişiminde bekleyen kayıt, oluşturulduğu hesabın
kimlik bilgisiyle gönderilir. Ağ hatasında yerel kayıt korunur; tekrar deneme
ve bağlantı geri gelince eşitleme sunulur. İlk sorgu başarısızsa henüz bilinmeyen
sunucu konumunun üzerine varsayılan ilk bölüm otomatik yazılmaz.

Sayfalı görünüm mevcut bölümden açılır. Sayfalar bölüm kimliklerini taşır;
sayfa çevrildiğinde görünen bölüm son konum olarak kaydedilir. Normal bölüm
görünümüne dönüldüğünde de aynı bölüm gösterilir. Otomatik konum kaydı bölüm
düzeyindedir; paragraf düzeyinde devam etmek için mevcut ayraç kullanılır.

## Sınırlar ve doğrulama

Silinmiş ayraç bölümü atlanır; geçerli ilerleme kaydına dönülür. Ayraç paragrafı
kısalmışsa son mevcut paragraf görünür hale getirilir. Bozuk tarayıcı kayıtları
yok sayılır. Sunucuya gönderilemeyen son değişikliklerin başka cihazda görünmesi
bağlantı ve eşitleme gerektirir; zorla kapatılan tarayıcıda teslim garantisi yoktur.

Önce yeni sunucu, sonra istemci yayınlanmalıdır. `lastChapterId` isteğe bağlıdır;
eski kayıtlar için toplu migration gerekmez. Canlı veritabanında manuel işlem
yapılmaz. Yeni konum API'si, paragraf ayraçları, eski kayıtlar, geciken sorgular,
yeniden açılış, hesap ayrılığı, hatalı kimlikler ve sayfalı görünüm test edilir.
