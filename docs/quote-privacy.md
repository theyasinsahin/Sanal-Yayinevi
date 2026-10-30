# Alıntı görünürlüğü ve profilde kitap grupları

## Uygulama sırası

1. **Veri modeli ve GraphQL:** `Quote.visibility` alanı `PUBLIC` veya `PRIVATE` olur. Yeni alıntının varsayılanı `PUBLIC`; alanı bulunmayan eski kayıtlar da herkese açık sayılır. Mevcut veriyi dönüştüren bir migration gerekmez. Kullanıcı/kitap/görünürlük sorguları için bileşik indeksler eklendi.
2. **Sunucu yetkilendirmesi:** Profil ve kitap sorguları özel alıntıları yalnızca sahibine döndürür. Doğrudan alıntı bağlantısında sahip denetimi uygulanır. Yönetici rolü özel alıntıyı okuma yetkisi vermez; yönetim kayıtları, referans etiketleri ve sayaçları da filtrelenir.
3. **Dolaylı erişim yolları:** Özel alıntılar akış, alıntı araması ve ana sayfa/Keşfet kitap aramasından çıkarılır. Özel alıntı beğenilemez, yorumlanamaz, yeniden paylaşılamaz, sosyal önizleme üretmez veya mesaj eki yapılamaz. Önceden doldurulmuş mesaj ekleri de sunucuda yeniden doğrulanır. Özel kayıtlara herkese açık alıntı puanı verilmez.
4. **Tekrar kontrolü:** Herkese açık kopyalar mevcut ortak tekrar kontrolünü kullanır. Özel kopyalarda yalnızca aynı kullanıcının aynı kitaptaki özel kayıtları karşılaştırılır. Başkasının özel alıntısı kayıt oluşturmayı engellemez ve kimliği sızdırılmaz. Paylaşılmış bir metin ayrıca kişisel olarak kaydedilebilir.
5. **İstemci formları:** Dijital okuyucudaki metin seçimi ve basılı kitap formunda “Herkese açık” / “Sadece ben (özel)” seçimi vardır. Dijital form görünürlük değiştiğinde tekrar kontrolünü yeniler; eski ağ yanıtları yeni seçimi değiştiremez. Kontrol başarısızsa yeniden denemeden kaydetme yapılmaz.
6. **Profil:** Sunucunun izin verdiği alıntılar kitap kimliğine göre gruplanır. Yeniden paylaşımlar orijinal kitabın grubuna girer. Gruplar en yeni alıntının sırasını korur; başlıkta kitap bağlantısı ve görünür alıntı sayısı bulunur. Özel kartta “Özel · Sadece ben” etiketi yer alır. İstemci önbelleği kayıt sonrası geçersizleştirilir; mevcut oturum değişimi önbellek temizliği korunur.

## Erişim matrisi

| İşlem | Herkese açık alıntı | Özel alıntının sahibi | Diğer kullanıcı / ziyaretçi / yönetici |
| --- | --- | --- | --- |
| Profil ve kitap listesi | Mevcut profil izinleriyle görünür | Görünür | Özel alıntı dönmez |
| Doğrudan alıntı bağlantısı | Mevcut paylaşım izinleriyle görünür | Görünür | `null` |
| Akış / arama / alıntıdan kitap arama | Dahil | Özel kayıt dahil edilmez | Özel kayıt dahil edilmez |
| Sosyal paylaşım / mesaj eki / yeniden paylaşım | Mevcut izinlerle kullanılabilir | Özel kayıt için kapalı | Özel kayıt için kapalı |
| Silme | Yalnız sahibi | İzinli | Yetkisiz |

## Doğrulama

- `Server/tests/quotePrivacy.test.js`: sahip/ziyaretçi/misafir/yönetici erişimi, arama, tekrar kontrolü, doğrudan bağlantı, eski kayıt uyumluluğu, mesaj ekleri, sosyal işlemler, yönetim erişimi, GraphQL oluşturma, puan ve silme sınırları.
- `QuotePopup.test.jsx`: iki görünürlükte dijital kayıt, herkese açık metnin özel kopyası, ağ hatası sonrası yeniden kontrol.
- `QuoteCard.test.jsx`: özel kart sahipliği ve sosyal düğmelerin gizlenmesi.
- `UserProfile.test.jsx`: kitap grupları, yeniden paylaşım grubu ve ziyaretçiye özel grubun gösterilmemesi.
- `PrintedBooks.test.jsx`: iki görünürlükte sayfa numarasıyla basılı alıntı kaydı.

Görünürlük oluşturulurken seçilir; sonradan değiştirme bu özelliğin kapsamına dahil değildir. Testler geçici test veritabanında çalışır; canlı veritabanında değişiklik yapılmaz.

29 Ekim 2026 doğrulaması: sunucunun 24 test dosyasında 308 test, istemcinin 44 test dosyasında 270 test geçti. Üretim derlemesi mevcut bağımlılık/lint uyarılarıyla başarılı. Sahte verilerle ayrı Chrome oturumunda 1440 ve 390 piksel genişliklerinde profil kontrol edildi: kitap grupları ve özel etiketler görünüyor, özel kartlarda sosyal düğme ve yatay taşma yok; JavaScript çalışma hatası oluşmadı.
