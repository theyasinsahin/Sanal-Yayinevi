# Profil ayarları denetimi

Dal: `feature/profile-settings`

## Kapsam

Tek yayınevi ve yalnızca Türkçe içerik kararına göre yayınevlerine görünürlük,
varsayılan kitap dili, uygulama dili ve tema seçimi kaldırıldı. Kullanıcının
tercihine göre henüz iş akışı bulunmayan teklif, teklif güncellemesi, haftalık
özet ve diğer e-posta bildirim seçenekleri de arayüzden kaldırıldı.

## Düzeltilen davranışlar

| Ayar | Önceki sorun | Yeni davranış |
| --- | --- | --- |
| Ayarların yüklenmesi | Profil sorgusu tercihleri istemiyordu | Tercihler profille yüklenir ve bölüm değiştirildiğinde korunur |
| Gizli profil | Yalnızca tercih kaydediliyordu | Profil açıklaması, profil içeriği ve alıntılar takipçi/hesap sahibi kuralına göre döner |
| Kitaplık ve takip listeleri | Ziyaretçide ya hiç gösterilmiyor ya izinsiz sorgulanabiliyordu | Hem arayüz hem doğrudan GraphQL sorguları tercihi uygular; taslaklar ziyaretçiye dönmez |
| Arama motorları | Tercihi kullanan kod yoktu | Profil sayfası `robots` meta etiketini `noindex,nofollow` olarak ayarlar; sayfadan çıkarken önceki etiketi geri yükler |
| Mesaj izinleri | Konuşma açma/gönderme kontrol edilmiyordu | Yeni ve mevcut konuşmalarda alıcının izni kontrol edilir; yalnızca konuşma katılımcıları mesajları okuyabilir |
| Mesaj hataları | Hata konsola yazılıp gönderilmiş gibi davranılabiliyordu | Mesaj metni korunur, hata kullanıcıya gösterilir; paylaşım başarı bildirimi verilmez |
| Bildirimler | Altı tercihin olay üreticileri yoktu | Takip, kitap yorumu/beğenisi, alıntı beğenisi ve oturum olayları tercihi denetleyerek bildirim üretir |
| Tür tercihleri | Sabit kategori listesi öneri sisteminden bağımsızdı | Etkin türler sunucudan yüklenir; yazar ayarları ve Keşfet aynı öneri tercihlerini kullanır |
| Haftalık hedef | Sayı kaydediliyor, ilerleme hesaplanmıyordu | Bölüm kayıtlarına eklenen kelimeler Türkiye saatine göre pazartesi başlayan haftada toplanır; ilerleme ayarlarda gösterilir |
| Telif notu | Görüntülendiği yer yoktu | Not yalnızca hesap sahibine ve yöneticiye döner; yönetici kullanıcı tablosunda gösterilir |
| Yazı boyutu | Ayarlarda önizleme vardı, okuyucu kullanmıyordu | Tercih cihazda saklanır; yeniden açılışta yüklenir, iki okuma görünümüne ve profil açıklamasına uygulanır |
| E-posta değiştirme | Değişiklik kaydedildikten sonra SMTP hatası tüm işlemi başarısız gösteriyordu | Adres doğrulanır ve normalize edilir; hesap değişikliği ve bilgilendirme e-postasının sonucu doğru bildirilir |
| Şifre değiştirme | Kayıt ekranındaki kurallar uygulanmıyordu | İstemci ve sunucu aynı kuralları uygular; eski sıfırlama bağlantıları geçersizleştirilir |
| Devre dışı bırakma | Eski tokenlar çalışıyor, içerikler görünüyordu | Eski oturumlar geçersizleşir, içerikler listelerden gizlenir; şifre/Google girişi hesabı etkinleştirir |
| Hesap silme | Metin fiziksel silme vaat ediyor, bazı içerikler açık kalıyordu | İşlem geri alınamayan erişim kapatma olarak açıklanır; kitaplar, alıntılar, yorumlar, oturumlar ve gönderilen mesajlar soft-delete edilir |

## Uyumluluk ve doğrulama

- Kullanılmayan eski tercih alanları mevcut istemciler ve kayıtlar için şemada
  korunur; yeni arayüz bu alanları okuyup göndermez. Üretim veritabanı için
  migration veya mevcut kullanıcıları değiştiren komut çalıştırılmaz.
- Servisler giriş dosyasından ayrılmış ortak PubSub kullanır. Böylece servis
  testleri gerçek sunucuyu başlatmaz ve önceki import döngüsü giderilir.
- Sunucu testleri geçici MongoDB, e-posta testleri mock gönderici kullanır.
  Üretim hesabına/veritabanına istek ya da gerçek e-posta gönderimi yapılmaz.
- Haftalık kelime sayacı yeni sürümle kaydedilen eklemeleri ölçer; geçmiş
  bölüm düzenlemelerinin kayıtları olmadığı için geçmiş haftaları tahmin etmez.
- `noindex`, arama motorlarının sayfayı yeniden taramasından sonra etkisini
  gösterir; daha önce dizine alınmış sayfaları anında kaldırmaz.

## Testler

- Sunucu: `npm test -- --runInBand` — 9 paket, 59 test.
- İstemci: `Settings.test.jsx` ve `Community.test.jsx` — 2 paket, 11 test.
- Ayar ekranı testleri kaydedilmiş tercihlerin yüklenmesini, Apollo metadata
  alanlarının mutation input'larına sızmamasını, kaldırılan seçenekleri ve
  yazı boyutunun yeniden açılışta korunmasını kapsar.
- Sunucu testleri gerçek GraphQL sorguları ve subscription'lar üzerinden
  izinleri, bildirim üretimini, önerileri, kelime hedefini ve hesap işlemlerini
  doğrular. Eski resolver testleri güncel kimlik doğrulama ve soft-delete
  davranışına uygun veriyle çalışacak şekilde güncellendi.
