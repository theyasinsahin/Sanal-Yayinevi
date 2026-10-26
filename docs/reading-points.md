# Okuma puanları ve canlı puan güncellemeleri

## Kullanıcı davranışı

Giriş yapmış kullanıcı, erişilebilir ve metni olan bir kitabı okurken her 60 aktif
saniyede 1 puan kazanır. Süre 15 saniyelik aralıklarla sunucuya kaydedilir; dakika
altındaki doğrulanmış saniyeler kitap veya sayfa değişince sıfırlanmaz. Puan,
dakika tamamlandıktan sonraki kayıt isteğinde kesinleşir: normalde en fazla 15
saniye ve ağ yanıt süresi kadar görünme farkı olabilir. Saniyeler ve dakika
puanları birbirinden ayrı tutulur.

Gizli sekmeler, boş/taslak bölümler, onaysız basılı kitaplar ve misafirler okuma
puanı kazandırmaz. 90 saniye etkileşimsizlikte uyarı gösterilir; 120 saniyede süre
sayımı durur. Kaydırma, dokunma, tıklama ve klavye etkileşimi sayımı sürdürür.
Tek hesap için yalnızca en son açılan okuyucu oturumu süre kaydedebilir; diğer
okuyucu bilgilendirilir. Bu, eşzamanlı sekmelerde puanın katlanmasını önler.

Puanlar, rozetler ve bildirimler işlem kesinleştikten sonra WebSocket üzerinden
kişisel abonelere; lider tablosundaki değişiklik ise açık lider tablosuna
bildirilir. Puan sorguları tekrar alınır. Bağlantı yeniden kurulurken 15 saniyelik
sorgulama ve sekmeye geri dönünce yenileme yedek olarak çalışır. WebSocket
kimliği, oturum açılan hesap değiştiğinde yeniden bağlanarak güncellenir.

## Veri bütünlüğü

`startReadingSession` kitap ve bölüm erişimini doğrular; `reportReadingTime`
1–60 saniyelik, sıralı ve sunucunun ölçtüğü gerçek zamana sığan kayıtları kabul
eder. Aynı sıra numarasını yeniden göndermek puanı veya süreyi artırmaz.
`ReadingSession` hesap başına tek kayıt tutar; süre bakiyesi `UserScore` içindedir.
Oturum, son doğrulanan kayıttan 120 saniye sonra sona erer.

İstemci paketi göndermeden önce kullanıcıya ve kitaba bağlı yerel kayıt oluşturur.
Başarısız istek aynı sıra numarasıyla denenir. Sayfadan ayrılırken `keepalive`
isteği gönderilir; kesilen istek sonraki açılışta oturum geçerliyse kurtarılır.
Tarayıcının zorla kapanmasında teslim garantisi yoktur. Uzun bağlantı kesintileri
sonrasında doğrulanamayan çevrimdışı süre puanlandırılmaz; önceden sunucuya
kaydedilen saniyeler korunur. Tarayıcı kaydı kapalıysa okuma sürer, fakat sayfa
kapandıktan sonra gönderilemeyen isteği kurtarma imkânı olmaz.

İstek sıra numarası, süre bakiyesi, puan, istatistik, puan olayı, bildirim ve
kazanılan rozet aynı MongoDB transaction içinde güncellenir. Diğer puan
işlemlerinde de puan kaydı kendi içinde atomiktir; kaynak içerik kimliği tekrar
ödüllendirmeyi önler. Aynı kitabı yeniden yayınlamak veya aynı alıntıyı yeniden
paylaşmak ikinci ödül vermez. Yayın puanı yöneticiye değil kitabın yazarına gider.
Günlük/haftalık/aylık dönemler İstanbul takvimine göre hesaplanır. Silinen veya
pasif hesaplar lider tablosuna ve aktif kullanıcıların sırasına dahil edilmez.

## Yayın ve sınırlar

Önce sunucu, ardından istemci yayınlanmalı; eski önbellekteki istemciler
yenilenmelidir. Doğrulanmamış `addReadingMinutes` işlemi artık puan vermez ve
istemciyi yenileme mesajı döndürür. MongoDB replica set/transaction ve yeni
benzersiz indeksler gerekir; projedeki takip onayı da transaction kullanır.
Mevcut puanlar ve eski puan olayları geriye dönük değiştirilmez. Eski olaylarda
kaynak içerik kimliği olmadığından geçmişte hangi kitaba yayın puanı verildiği
otomatik olarak çıkarılamaz; tekilleştirme yeni kaynaklı kayıtlara uygulanır.

Mevcut `PubSub` süreç içindedir. Birden fazla sunucu süreci kullanılırsa canlı
olaylar için ortak bir dağıtıcı gerekir; sorgulama yedeği veri doğruluğunu korur.
Sistem metnin bir insan tarafından gerçekten anlaşıldığını kanıtlamaz; gerçek
zamandan hızlı ve paralel süre bildirimlerini engeller.

Testler: `Server/tests/readingPoints.test.js`, istemcinin `readingTracker`,
`useReadingTracker`, `useLiveScoreQuery` ve `ScoreUpdates` testleri. Önceki kitap
okuma, yazma, takip, profil ve sosyal paylaşım testleri de çalıştırılır.
