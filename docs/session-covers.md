# Oturum kapakları ve paylaşım

## Tasarım ve kullanıcı akışı

Oturum kartları dikeydir: üstte 16:9 fotoğraf, altında başlık, açıklama,
etiketler, tarih, düzenleyen kişi ve katılımcı sayısı bulunur. Fotoğraf ve bilgi
alanı oturumun okunabilir adresine bağlantıdır. Paylaş düğmesi bu bağlantının
dışındadır; paylaşmak oturuma yönlendirmez. Telefonda tek sütun, geniş ekranda
mevcut uyarlanabilir kart ızgarası kullanılır.

Yeni oturum formunda mevcut `ImageUpload` ile kapak seçilir. Yükleyici oturum
fotoğrafını 16:9 kırpar ve en fazla 1600 piksel genişliğinde JPEG yükler.
JPEG/PNG/WebP dosyaları ve en fazla 8 MB giriş boyutu kabul edilir. Kitap ve
profildeki eski kullanımın varsayılan 2:3 oranı korunur. Yükleme sürerken form
gönderilemez; başarısız yükleme veya kayıt kullanıcıya gösterilir.

Oturumun detayında da başlığın üstünde fotoğraf vardır. Sahip veya yönetici
“Kapak fotoğrafını düzenle” ile yeni kapak yükleyip kaydedebilir ya da varsayılan
fotoğrafa dönebilir. Yüklenen fotoğrafı kaydetmeden iptal etmek mevcut oturum
kaydını değiştirmez. Diğer üyeler bu denetimi göremez; sunucu da yetkiyi denetler.

## Sunucu ve eski kayıtlar

`Session.coverImageUrl`, oluşturma girdisi ve GraphQL Session alanı eklendi.
`updateSessionCover` yalnızca sahip/yönetici için çalışır. Var olan ücretli
üyelikle oturum oluşturma kuralı, erişim kodları, takipçi kontrolü ve yazı
ekleme akışı korunur. Kapak URL'si mevcut görsel yükleyicinin HTTPS Cloudinary
image/upload adresi olmalıdır; keyfi URL, data URI veya kullanıcı bilgili URL
kabul edilmez.

Kapaksız eski ve yeni oturumlarda `/images/sessions/default-cover.jpg` döner.
Bu, mevcut tüm kartlara otomatik fotoğraf atar; toplu üretim verisi migration'ı
veya canlı veritabanına manuel müdahale gerekmez. Bozuk özel görsel yüklenirse
istemci de varsayılan kapağa döner. [Fotoğrafın kaynağı ve dosyası](../Client/public/images/sessions/README.md).

Kapak ve oturumun künyesi liste sayfasında herkese açıktır. Form bu bilgiyi
yükleme öncesinde gösterir; özel oturumun katılım kodu veya yazıları kapakla
birlikte paylaşılmaz.

## Sosyal paylaşım

Açık ve aktif oturumlarda karttan ve detaydan mevcut sosyal paylaşım penceresi
açılır: WhatsApp, Telegram, X, bağlantı/metin kopyalama, görsel indirme ve
desteklenen cihazlarda yerel paylaşım. Okunabilir `/oturum/:adres` bağlantısı ve
oturuma özel sunucu önizlemesi kullanılır. Open Graph/Twitter görseli ve
indirilecek görsel oturum kapağıdır. Görsel üretilmez; fotoğrafın üstüne metin
çizilmez. Harici görsel dosyası indirilemezse genel paylaşım görseli yedektir.

Özel, takipçilere özel, kapatılmış veya silinmiş oturumlar herkese açık sosyal
paylaşım önizlemesi üretmez. Bu durumlar paylaş düğmesini gizler ve sunucu
eski bağlantıları tekrar denetleyerek 404 döndürür. Diğer içerik türlerinin
paylaşım davranışı değişmez.

## Yayın ve doğrulama

Önce sunucu, ardından istemci yayınlanmalıdır. Yeni varsayılan fotoğraf web
dağıtımına dahildir; Unsplash'a sürekli bağlantı gerektirmez. Mevcut Cloudinary
cloud/preset yapılandırması kullanılır. Varsayılanı değiştirmek için
`Client/public/images/sessions/default-cover.jpg` dosyasını aynı adla değiştirin.

Testler; gerçek GraphQL oluşturma/liste/detay/güncelleme sorgularını, eski
kayıtları, rol kontrollerini, URL doğrulamasını, paylaşım meta etiketlerini,
formda yükleme beklemeyi, önizleme hatalarını ve kitap kırpma oranını kapsar.
