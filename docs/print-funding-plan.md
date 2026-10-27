# Basım ve destek sistemi: analiz ve uygulama planı

## Başlangıç incelemesi

27 Ekim 2026. Mevcut yapı React 18/CRA, Apollo GraphQL, Express, Mongoose 8 ve MongoDB. JWT ile oturum; güncel rolü DB'den kontrol eden `requireAdmin`; soft delete ve genel yönetim paneli mevcut. Bildirimler MongoDB'de saklanıyor. Jest ve geçici MongoMemoryReplSet mevcut. Yeni framework veya servis eklenmeyecek. Çalışma dalı `feature/book-funding-system`; başlangıçtaki kaydedilmemiş değişiklikler korunacak.

`Book.status` dijital görünürlük, tamamlanma ve fon durumlarını birleştiriyor. `updateBookStatus` istemcinin fon hedefini kabul ediyor. Maliyet modalı örnek fiyatlarla doğrudan FUNDING açıyor. Eski iyzico checkout servisi gerçek servis çağrısı yapabiliyor; callback transaction/tekilleştirme olmadan Book toplamını artırıyor. `Transaction.amount` TL/Number. Bunlar yeni finansal sistemin kaynağı olamaz. Eski kayıtlar korunacak, otomatik olarak yeni muhasebeye aktarılmayacak. Eski ödeme başlatma ve callback yazma yolları kapatılacak.

## Kararlar ve bağımlılık sırası

1. Eklemeli modeller/indexler; dijital durum ve yazım tamamlanmasını ayırma. Eski status/funding alanları salt okunur uyumluluk verisi olarak korunur. Üretimde otomatik veri dönüşümü, index silme veya reset yok.
2. Sunucu içerik snapshot'ı, SHA-256, özel PDF varlıkları, sürümlü baskı özellikleri/beyanlar. Başvuru revizyonunda yeni snapshot; önceki sürüm değişmez. Sayfa tahmini kelimeden; kesin sayfa mizanpaj PDF'inin matbaa/yönetici doğrulamasından gelir.
3. Transaction içinde başvuru kararları, versiyonlu maliyet tarifesi, doğrulanmış maliyet, sabit kampanya hedefi ve birim satış fiyatı. Onaylı başvurudan kampanya; yazar/kitap/sürüm başına unique aktif kilit.
4. Kuruş cinsinden tam sayılar, kullanıcı kapsamlı idempotency key + istek özeti. Kampanya belgesi üzerinde koşullu kapasite rezervasyonu. Ödeme sağlayıcısı DB transaction'ının dışında. Sandbox sağlayıcı kalıcı ve idempotent; imzalı olay + sunucu sorgusu; ayrı değişmez capture/allocation/refund muhasebesi.
5. Sonlanma/rezervasyon süresi/uzlaştırma/iade worker'ı. Hedefe ulaşınca CLOSING; mutabakat sonrası SUCCEEDED. Başarısız/iptal kampanyasında tam iade. Süresi geçmiş rezervasyonun geç tahsilatı kampanyaya sayılmaz, tam iade edilir. Ön sipariş tam bedeli hedefe sığmalı; kısmi tahsilat yok. Aynı sepette ilave karşılıksız destek mümkün.
6. Yazar başvurusu, okuyucu kampanya/checkout/geçmiş, yönetici inceleme/maliyet/kampanya/üretim/teslimat/operasyon arayüzleri. Ücretsiz ve tekil basım ilgisi beğeniden ayrıdır. Adresler sadece sipariş sahibi ve yetkili yöneticiye açılır.
7. Gerçek MongoDB transaction ve paralel Promise.all istekleriyle entegrasyon testleri; GraphQL dokümanları, imza/erişim, iadeler, geç olaylar, mevcut testler, lint ve build. Test edilemeyen dış hizmetler ayrıca raporlanır.

## Güvenli sınır

Canlı ödeme adaptörü yok; production ortamında sandbox ödeme de çalışmaz. Ödemeler varsayılan DISABLED, sadece development/test ve açık SANDBOX ayarıyla etkin. Sandbox kayıtları eski Transaction'a ve canlı toplamlarına yazılmaz. Kart verisi alınmaz. Matbaa fiyatları bilinmiyor; sadece açıkça örnek etiketli yönetilebilir sandbox tarifesi kullanılır. Gerçek sözleşmeler, hukuki model, KVKK/saklama politikası, matbaa PDF ön kontrolü ve gerçek sağlayıcı testleri canlıya geçişin dış bağımlılıklarıdır.
