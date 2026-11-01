# Sosyal medya ve story paylaşımı

Kitap kartı/detayı, basılı kitap detayı, alıntı kartı, profil, bölüm editörü, bölüm okuyucusu ve açık oturumlarda paylaşım seçenekleri bulunur. Mevcut Betik mesajıyla kitap/alıntı gönderme seçeneği korunur. Editörde bölüm paylaşımı, bekleyen kayıtların tamamlanmasını bekler; kayıt başarısızsa pencere açılmaz.

## Kullanıcı akışı

Paylaş penceresi; WhatsApp, Telegram, X, bağlantı kopyalama, metin+bağlantı kopyalama ve görsel indirme sunar. Tarayıcı destekliyorsa cihazın paylaşım menüsü ve görsel dosyasıyla paylaşım da görünür. Native paylaşım için görsel önceden yüklenir; paylaşım çağrısı doğrudan kullanıcı tıklamasında yapılır. İptal işlemi hata veya başarılı yayın olarak gösterilmez.

Görseller statiktir; yeni fotoğraf oluşturulmaz ve canvas ile kompozisyon çizilmez. Şimdilik tüm dosyalar aynı stok fotoğraftır. Tasarımlar `Client/public/social-share/` klasöründe tür bazında değiştirilebilir. [Dosya ve boyut tablosu](../Client/public/social-share/README.md).

Web Share API, paylaşım hedeflerini işletim sistemi/tarayıcıya bırakır. Belirli bir uygulamanın story ekranını veya Instagram bağlantı etiketini otomatik açma garantisi yoktur. Görsel indirme ve metin/bağlantı kopyalama bu durumlar için sunulur. [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

## Bağlantılar ve önizlemeler

`getSocialShare(type, id)` sunucudan herkese açık paylaşım bilgilerini getirir. Dışarı giden bağlantılar API sunucusunda `/share/{book|chapter|quote|profile|session}/{adres}?webOrigin=…` adresine gider. Kitap, bölüm ve oturumlarda kalıcı okunabilir adres, profillerde kullanıcı adı kullanılır; alıntılarda ID korunur. Eski ID paylaşım bağlantıları da çalışır. Bu GET endpoint'i JavaScript çalıştırmayan mesajlaşma botlarına Open Graph ve Twitter meta etiketleri döndürür; normal tarayıcıyı ilgili web sayfasına yönlendirir. JavaScript kapalıysa aynı sayfada doğrudan bağlantı bulunur. Fotoğraflar web uygulamasında barındırılır; kaynak siteye hotlink yapılmaz.

Bölüm bağlantısı `/kitap/:kitapAdresi/bolum/:bolumAdresi`, alıntı bağlantısı `/quotes/:quoteId` şeklindedir. Eski `/book-reader/:bookId?chapter=:chapterId` bağlantıları yeni adrese yönlenir. Bağlantıdaki bölüm, kayıtlı okuma ilerlemesinden önceliklidir. Silinmiş içerik bağlantılarında içerik bulunamadı sayfası gösterilir. Alıntı sayfası `getQuoteById` ile tek alıntıyı yükler. [Adres kuralları ve yayın sırası](readable-urls.md).

Taslak/silinmiş kitaplar, onay bekleyen basılı kitaplar, gizli alıntılar ve özel/takipçilere özel oturumlar dışarıya açılmaz. Bölüm önizlemelerine tam bölüm metni konulmaz. Spoiler alıntının metni önizlemeye veya dış paylaşım açıklamasına konulmaz. Gizli profil bağlantısı paylaşılabilir, ancak adı ve biyografisi dış önizlemeye aktarılmaz. İçerik kaldırılmış veya gizlenmişse eski paylaşım bağlantısı da yeniden denetlenerek 404 döner. Önizleme yanıtları `no-store` olarak verilir.

## Ortam ayarları

Web tarayıcısında mevcut origin kullanılır; localhost'ta çalışma otomatik olarak canlı siteye yönlenmez. Native/Capacitor origin'i için `REACT_APP_PUBLIC_WEB_URL` kullanılabilir; yoksa sunucunun `CLIENT_URL` değeri kullanılır. Sunucudaki `CLIENT_URL`, gerçek web adresiyle eşleşmelidir. Üretimde bu origin dışında yönlendirme kabul edilmez. `SHARE_ALLOWED_WEB_ORIGINS` yalnızca geliştirmede ilave yerel önizleme adreslerini izin listesine ekler.

API sunucusundaki `/share/*` GET yolu GraphQL middleware'inden önce kaydedilmiştir. Dağıtımın bu yolu Express uygulamasına ulaştırması, web dağıtımının da `/quotes/:quoteId` gibi SPA yollarını ve `public/social-share` dosyalarını sunması gerekir. Yerel bağlantıların internetten erişilebilir olmaması doğaldır; gerçek mesajlaşma önizlemeleri için web ve API adreslerinin herkese açık olması gerekir.

Doğrulama: `Server/tests/socialSharing.test.js`, `Client/src/utils/socialSharing.test.js`, `Client/src/components/Sharing/SocialShare.test.jsx` ve okuyucunun bölüm bağlantısı testleri. Gerçek cihazdaki hedef uygulama seçenekleri cihaz ve uygulama kurulumuna bağlıdır.
