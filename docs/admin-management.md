# Yönetim paneli geliştirme planı

Branch: `feature/admin-management`. `develop` üzerinden açıldı; tamamlanmış `feature/performance-optimization` değişiklikleri fast-forward ile dahil edildi. Mevcut çalışmalar korunur. Canlı veritabanına veya gizli yapılandırmaya bağlanılmaz; commit/push ayrıca onay gerektirir.

## İnceleme bulguları

- Kullanıcı silme düğmesi yalnızca console'a yazıyor. Rol/durum düzenleme ekranı yok.
- Kitap ekranı genel katalog sorgusunu kullandığı için taslakları, silinenleri ve tüm basılı kayıtları kapsamıyor; eksik yazar/tür verisinde kırılabiliyor.
- Dashboard bütün kullanıcıları, kitapları ve işlemleri indirerek sayıyor. Gerçek olmayan grafik alanı var ve tarih dönüşümü hatalı.
- Finans araması bağlı değil. Tür oluşturma/güncelleme API'si var fakat admin ekranı yok.
- Şema, tüm kayıtlar, işlem geçmişi ve eşzamanlı düzenleme kontrolü bulunmuyor.

## Uygulama sırası

1. **Sunucuda yönetici sınırı:** Yönetim sorguları ve değişiklikleri aktif, silinmemiş yönetici hesabını veritabanından doğrular. Kullanıcı tarafından gönderilen rol, koleksiyon adı, MongoDB sorgusu veya rastgele alan adı yetki sağlamaz.
2. **Model kataloğu:** Her uygulama modeli için alan türü, zorunluluk, enum, ilişki, indeks ve düzenlenebilirlik bilgisi gösterilir. Kayıtlar sunucuda arama, durum filtresi ve sayfalama ile listelenir. Parola, doğrulama kodu, erişim kodu ve sıfırlama/oturum anahtarları yanıt ve loglardan çıkarılır.
3. **Kayıt inceleme/düzenleme:** Okunabilir alan etiketleri ve alan türüne uygun form kullanılır. İlişkiler ilgili kayda açılır. Sunucu model başına izin verilen alanları doğrular. Kayıt değişmişse eski ekranın üzerine yazılması engellenir. Her değişiklik gerekçesi ve yönetici kimliğiyle işlem geçmişine yazılır.
4. **Türler:** İkonsuz/emoji gerektirmeyen tür ekleme, güncelleme, aktifleştirme/pasifleştirme; Türkçe addan otomatik URL adı, çakışma kontrolü, açıklama ve renk. Tür adı değişince adla tutulan yazar tercihleri eşitlenir; mevcut kitap bağlantıları kimlik üzerinden korunur. Türler fiziksel olarak silinmez.
5. **Operasyon ekranları:** Kullanıcılar, kitaplar ve finans mevcut menülerden yeni veri yönetimine bağlanır. Dashboard sunucudaki sayımları ve bekleyen incelemeleri kullanır. Basılı kitap/hak talebi onay akışı korunur. Diğer tüm modeller aynı kayıt/şema ekranından ulaşılır.
6. **Tutarlılık:** Hesap durum/rol değişikliklerinde oturumlar geçersizleştirilir ve son aktif yöneticinin kaybedilmesi engellenir. Ödeme durumları sağlayıcının onay akışında, puan/ilişki/başvuru kayıtları kendi işlem kurallarında kalır. Teknik kimlikler ve hesaplanan sayaçlar doğrudan formdan değiştirilemez.
7. **Kontroller:** Gerçek GraphQL belgeleriyle geçici MongoDB entegrasyon testleri; yetkisiz erişim, hassas alanlar, tür işlemleri, eski veri, eşzamanlı kayıt ve yönetici korunması; istemcide form/arama/durum/hata testleri; tüm mevcut testler, lint ve production build.

Şema ekranı uygulamanın veri yapısını inceler. Çalışan sunucunun model kodunu veya veritabanı indekslerini tarayıcıdan değiştiren bir kod çalıştırma aracı değildir.
