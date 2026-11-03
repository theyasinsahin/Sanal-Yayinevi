# Kitap oluşturma, yayınlama, mobil okuma ve hesap e-postaları

Tarih: 3 Kasım 2026. Dal: `fix/google-login-profile-query`. Son kullanıcı düzenlemeleri dahil güncellendi.

## Uygulanan değişiklikler

| Akış | Sonuç |
| --- | --- |
| Kitap oluşturma | Düğme **Taslak Olarak Kaydet** oldu. Başarılı kayıt doğrudan `/dashboard/:bookId` yazma ekranını açıyor. Mevcut sunucu varsayılanı olan `DRAFT` korunuyor. |
| Eksik alanlar | Belirgin hata özeti ve alan hata mesajları eklendi. Kullanıcı isteğiyle alan çevresindeki ek kırmızı çerçeveler kaldırıldı. Form ilk eksik alana kaydırıp odaklanıyor; özetteki mesajlar ilgili alana götürüyor. Tarayıcının yerleşik doğrulaması özel hata akışını engellemiyor. |
| Yazma ekranı | Taslak yayınlama düğmesi, mobil bölüm menüsünden bağımsız olarak editörün üstünde görünüyor. Yayınlama öncesi bekleyen içerik kaydı tamamlanıyor. Basılı katalog kitaplarına dijital yayınlama işlemi sunulmuyor. |
| Kitap detayı | Taslağın yazarı **Yazmaya Devam Et**, **Yayınla (Görünür Yap)** ve **Sil** düğmelerini aynı satırda görüyor. Yayınlama onay, yüklenme, hata ve başarı durumlarını yönetiyor. |
| Alıntı açıklaması | Okuyucuda fareyle ve telefonda basılı tutarak seçimi anlatan, kapatılıp yeniden açılabilen bilgi baloncuğu var. |
| Mobil okuyucu | Bölüm listesi açılır panel oldu. Okuma alanı ekranı kullanıyor. Panel odak yönetimi, Escape ve kaydırma kilidi içeriyor. |
| Okuma görünümü | Kullanıcı isteğiyle Kitap Görünümü ve tüm kitabı indiren sorgu kaldırıldı. Okuyucu bölüm bazında çalışıyor; yalnız seçilen bölümün içeriği indiriliyor. |
| Mobil alıntı | `touchend` ve `selectionchange` destekleniyor. Metin seçimini bozan paragraf dokunuşuyla otomatik kaydırma kaldırıldı. Alıntı penceresi mobilde ekranın altında, görünen alana sığacak şekilde konumlanıyor. |
| Alıntı kaynağı | Yalnız kitap içeriğinden seçim kabul ediliyor. Alıntı, seçilen bölüm ve paragraf ile ilişkilendiriliyor; mobil metin seçimi korunuyor. |

## Kayıt ve şifre sıfırlama bulguları

SMTP adımlarının ayrı bekleme süreleri vardı; toplam işlem süresi sınırlı değildi. Her işlem artık kendine ait iptal edilebilir bağlantı kullanıyor ve SMTP işlemi toplam 12 saniyede sonuçlanıyor. DNS, bağlantı, karşılama ve soket beklemeleri de sınırlı. Bir isteğin zaman aşımı başka isteğin bağlantısını kapatmıyor. Sağlayıcının alıcıyı kabul ettiği kontrol ediliyor. Belirsiz teslimat sonucunda otomatik tekrar gönderim yapılmıyor.

Hata kayıtları yalnız işlem, güvenli hata kodu ve süre içeriyor. Kayıt ekranı SMTP hatasını anlaşılır gösteriyor; doğrulama kodu için yeniden gönderme ve bekleme süresi var. Şifre sıfırlama ekranı hesap varlığını açıklamıyor ve doğrulanmamış teslimatı kesin gönderilmiş gibi sunmuyor. Başarısız yeniden gönderim, önceki geçerli kodu/bağlantıyı koşullu güncellemeyle koruyor; daha yeni eşzamanlı işlem geri alınmıyor. Süresi dolmuş veya geçersiz sıfırlama bağlantısının güvenli hata mesajı üretim ortamında da korunuyor. İstemci, başarısız `Status.code` yanıtını başarı saymıyor.

Mevcut Gmail ayarlarıyla **gerçek SMTP bağlantı ve kimlik doğrulaması başarılı oldu; e-posta gönderilmedi**. Bu kontrol yerel geliştirme ortamından yapıldı; üretimde gelen kutusuna teslimat testi değildir.

## Render ücretsiz planının etkisi

Kullanıcı canlı backendin Render ücretsiz planda olduğunu doğruladı. Render'ın güncel belgeleri ücretsiz web servislerinde dışarıya SMTP `25`, `465`, `587` portlarını engellediğini belirtiyor. Mevcut Gmail SMTP akışı bu kısıtla uyumsuz. Ayrıca 15 dakika trafik almayan servis uyuyor ve tekrar açılması yaklaşık bir dakika sürüyor; bu davranış ilk istekteki gecikmeleri açıklayabilir. [Render ücretsiz servis belgeleri](https://render.com/docs/free), [SMTP kısıtı duyurusu](https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports).

Backendin **servis instance/compute planını** ücretliye geçirmek bu ücretsiz plan kısıtlarını kaldırır. Yalnız workspace planını yükseltmek yeterli değildir. Ücretsiz planda kalınacaksa HTTPS üzerinden çalışan bir e-posta API entegrasyonu gerekir. Bu çalışmada plan, üretim ayarı veya e-posta sağlayıcısı değiştirilmedi. Tüm farklı üretim hatalarının tek sebebi olduğu iddia edilmez; gerçek sunucu logları ve teslimat sonuçları ayrıca değerlendirilmelidir.

Geçiş sonrasında aynı ortamın yapılandırmasıyla `npm.cmd --prefix Server run mail:verify` bağlantıyı e-posta göndermeden kontrol eder. `EAUTH` kimlik doğrulama, `EDNS` DNS çözümleme, `ETIMEDOUT` zaman aşımı tanısını ayırır. Gerçek teslimat daha sonra kontrollü bir test hesabıyla doğrulanmalıdır.

## Önceki aşamanın doğrulaması

- İstemci: 8 test dosyasında **69 test başarılı**. Son küçük düzenlemelerden sonra etkilenen 4 dosyadaki **45 test yeniden başarılı**.
- Sunucu: 9 dosyadaki 89 test başarılı; eklenen üretim hata biçimlendirme senaryosuyla etkilenen 2 dosya yeniden çalıştırıldı ve 28 test başarılı. Toplam **90 farklı sunucu testi** doğrulandı. Geçici MongoDB replica set kullanıldı.
- Tarayıcı: Playwright/Edge ile **6 senaryo başarılı**; 1440×900 masaüstü ve 393×852 dokunmatik mobil görünüm. Okuma alanı taşması, bölüm paneli, fare olayı olmadan gerçek DOM metin seçimi, özel alıntı kaydı, doğru kaynak bölüm, editörde yayınlama görünürlüğü ve detay düğmelerinin aynı satırda kalması kontrol edildi.
- Gerçek Nodemailer, yerel sentetik SMTP sunucusunda bağlantı ve gönderim akışını geçti. Zaman aşımı, iptal, reddedilen alıcı, kimlik doğrulama hatası ve bağımsız eşzamanlı istekler sınandı.
- Gerçek MongoDB üzerinde başarısız yeniden gönderimden sonra önceki kayıt koduyla hesap açılması ve önceki bağlantıyla şifre sıfırlanması geçti.
- Son üretim derlemesi başarılı. Değiştirilen arayüz kaynaklarında ESLint başarılı; derlemede diğer sayfalardaki önceden mevcut uyarılar sürüyor.
- `git diff --check` başarılı.

Mobil testler tarayıcı emülasyonudur; fiziksel iOS/Android seçim tutamaçları ve işletim sistemi klavyesi ayrıca sınanmadı. Üretim veritabanı ve gizli yapılandırmalar değiştirilmedi. Önceden bulunan çalışma alanı değişiklikleri korundu. Commit, push, merge, PR veya dağıtım yapılmadı.

## Son kullanıcı düzenlemeleri

- Lider Tablosu etiketi Aktiflik Tablosu oldu. Kitap takibi açıkça Kitabı Takip Et / Kitabı Takip Ediyorsun olarak gösteriliyor.
- Bildirim satırları ilgili kitap, bölüm, alıntı, oturum, profil veya basım başvurusuna yönlendiriliyor. Puan bildirimleri tıklanmıyor. Eski basım bildirimlerinin hedefleri de çözümleniyor.
- İçeriksiz, yalnız boş HTML/boşluk içeren veya silinmiş bölümleri olan kitaplar sunucuda yayınlanamıyor. Arayüz de boş içerikte yayınlamayı kapatıyor.
- Yayınlama, taslağa çekme, yazımı tamamlama ve destek fonu başvuru adımları editörde ve kitap detayında erişilebilir. Kitap detayındaki durum kutusu ve düğmeler küçültüldü.
- Mobil editörde yayın alanı ve kayıt araçları kompakt. Gizleme/paylaşma işlemleri bölüm menüsünde. Daralan görsel viewport, üst araçlarla birlikte kaydırılabiliyor. Otomatik kayıt ve işlem öncesi kayıt sırası korunuyor.
- Mesaj araması, önceki konuşmalara ek olarak takip edilen ve mesaj kabul eden hesapları listeliyor. Arama ve sayfalama sunucuda sınırlandırılıyor; alıcı izni konuşma açılırken tekrar doğrulanıyor.
- Tilki görselleri yalnız oturumdaki `user.username === 'kolelkaa'` ve geçerli kullanıcı kimliği durumunda yüklenen kişisel bileşende gösteriliyor. Diğer hesaplar, misafirler ve büyük/küçük harf varyasyonları etkinleştirmiyor. Profil URL'si belirleyici değil.
- Profilin sol boşluğunda uçaklı tilki, sağ kenarında kart arkasından bakan tilki var. Dar ekranda dış kenar süsleri gizleniyor; yazı ve kontrol alanlarına binmiyor.

Son toplu doğrulama ve commit hazırlığı için [teslim kaydı](release-readiness-2026-11-03.md) esas alınmalıdır. Yukarıdaki önceki test sayıları yeni testlerle toplanmamalıdır.
