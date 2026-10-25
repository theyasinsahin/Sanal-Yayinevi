# Okunabilir içerik adresleri

| İçerik | Örnek |
| --- | --- |
| Profil | `/yazar/deniz` |
| Kitap | `/kitap/icimizdeki-ses-deniz` |
| Okuyucu | `/kitap/icimizdeki-ses-deniz/oku` |
| Bölüm | `/kitap/icimizdeki-ses-deniz/bolum/ilk-bolum` |
| Oturum | `/oturum/birlikte-okuyalim` |

Profil adresi mevcut kullanıcı adını kullanır; kullanıcı adı URL için kodlanır.
Kitap adresi kitap adı ve kullanıcı adından oluşur. Henüz Betik'te onaylı yazarı
olmayan basılı kitaplarda künyedeki yazar adı kullanılır. Türkçe harfler adreslerde
Latin harflerine çevrilir. Aynı adlı kayıtlar `-2`, `-3` gibi ekler alır.

Kitap, bölüm ve oturum adresleri ilk ihtiyaç anında `urlSlug` alanına bir kez
kaydedilir. Böylece eski kayıtlar için ayrıca toplu veri taşıma işlemi gerekmez.
Başlık, kullanıcı adı veya basılı kitabın onaylı yazarı sonradan değişse de bu
içeriklerin kalıcı bağlantısı korunur. Profil adresi ise güncel kullanıcı adını
takip eder; eski kullanıcı adları için takma adres tutulmaz.

`urlSlug` alanlarının benzersiz, sparse indeksleri eşzamanlı isteklerde çakışmayı
engeller. Mevcut soft delete kayıtlarının adresleri tekrar dağıtılmaz. Adres
oluşturmak içeriğin `updatedAt` tarihini değiştirmez.

Eski `/user/:id`, `/book-detail/:id`, `/book-reader/:id?chapter=:id` ve
`/sessions/:id` bağlantıları korunur. İstemci bunları `resolvePublicRoute`
ile çözer ve geçmişe yeni kayıt eklemeden asıl adrese yönlendirir. Diğer sorgu
parametreleri ve URL fragment'i korunur. Sayfa bileşenleri, yorumlar, takip,
ayraçlar, okuma ilerlemesi ve düzenleme işlemleri veritabanı kimlikleriyle çalışır.
Gizlilik, basılı kitap moderasyonu ve oturuma erişim denetimleri korunur.

Sosyal önizleme uçları da kullanıcı adı/kalıcı içerik adresini kabul eder;
önceden paylaşılmış ID bağlantıları çalışmaya devam eder. Alıntıların başlığı
olmadığı ve metni spoiler veya özel içerik taşıyabildiği için alıntı metninden
adres üretilmez. Alıntı kimlikleri, özel mesaj, ödeme ve yönetim adresleri korunur.

## Yayına alma

Önce sunucuyu, ardından istemciyi yayınlayın: yeni istemci `publicPath` alanını
ve `resolvePublicRoute` sorgusunu bekler. MongoDB üzerinde schema indekslerinin
oluşturulmasına izin verilmelidir. Canlı veritabanına bu çalışma sırasında bir
migration veya manuel işlem uygulanmaz. İstemci sunucusunda tüm SPA adreslerinin
`index.html` dosyasına yönlendirilmesi gerekir; mevcut ID rotalarında olduğu gibi
bu kural yeni adresler için de geçerlidir.

Doğrulama: `Server/tests/publicUrls.test.js`, `Server/tests/socialSharing.test.js`,
`Client/src/components/Route/PublicContentRoute.test.jsx` ve sosyal paylaşım
testleri; mevcut takip, kitap okuma, yazma ve basılı kitap testleri de çalıştırılır.
