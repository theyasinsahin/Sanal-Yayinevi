# 3 Kasım 2026 — yerel teslim ve push hazırlığı

Çalışma dalı: `fix/google-login-profile-query`.

Bu teslim; güvenlik güçlendirmelerini, Google giriş/profil sorgusu ve hesap e-postası düzeltmelerini, kitap oluşturma/yayınlama/okuma iyileştirmelerini, bildirim yönlendirmelerini, mesaj alıcısı aramasını ve kullanıcıya özel görsel düzenlemeleri birlikte içerir.

## Dal güncellemesi

- `origin` referansları fetch ile yenilendi.
- Uzak `develop` ucu: `ee4ec4d`. Bu birleştirme commit'inin dosya ağacı yerel geçmişteki `efd8df2` ile aynı; yereldeki iki mevcut commit korunarak aktif dala alındı. Kodda ek bir çatışma veya değişiklik oluşmadı.
- Yerel `develop` referansı da commit kaybetmeden `origin/develop` ucuna ilerletildi.
- `main` dalına commit, merge veya push yapılmıyor. Uzak sunucuya değişiklik gönderilmiyor.

## Yapılandırma

Önceden izlenen `Server/.env` kaydı Git indeksinden kaldırıldı. Yerel dosya diskte korunuyor ve `.gitignore` kapsamındadır; commit'e gizli yapılandırma eklenmez. Bu işlem geçmiş commit'leri temizlemez; önceki güvenlik raporundaki anahtar yenileme ve dağıtım ön koşulları geçerlidir.

Tilki süslerinin tek etkinlik koşulu oturumdaki kullanıcının tam olarak `kolelkaa` kullanıcı adına sahip olmasıdır. Profil URL'si, görünen ad veya harf büyüklüğü varyasyonları bu koşulu sağlamaz. Görseller diğer hesaplarda ve misafirlerde yüklenmez. Bu bir görsel kişiselleştirme koşuludur; public PNG dosyaları için erişim kontrolü değildir.

## Doğrulama

| Kontrol | Sonuç |
| --- | --- |
| İstemci tam Jest koşusu | 76 dosya, 575/575 test başarılı |
| Sunucu Jest doğrulaması | 46 dosya, 731 farklı test doğrulandı; aşağıdaki tekrar notuna bakın |
| Tarayıcı tam Playwright koşusu | 38/38 senaryo başarılı; masaüstü ve dokunmatik mobil |
| İstemci üretim derlemesi | Başarılı; mevcut CRA/ESLint bakım uyarıları sürüyor |
| Değişen istemci kaynaklarında ESLint | 38 dosya, 0 hata, 2 uyarı |
| Git whitespace kontrolü | Başarılı |

Sunucu ilk tam koşusunda 730/731 test geçti. Tek hata, kullanıcı isteğiyle kaldırılan `GET_BOOK_READER_FULL` belgesini hâlâ çağıran eski performans beklentisiydi. Bu eski beklenti kaldırıldı; metadata projeksiyonu ve seçilen bölümün erişim/içerik kontrolleri korunuyor. Ardından performans dosyasının 16/16 testi yeniden başarılı oldu. Bu 16 test, 731 toplamına tekrar eklenmedi.

Tarayıcı koşusu kitap yazma/yayınlama/okuma, Google callback ve oturum devamlılığı, HTTP/WebSocket + geçici MongoDB ile giriş, kişisel tilkilerin tam kullanıcı adı koşulu, destek akışları ve yayınevi portalını kapsıyor. Harici Google/ödeme/SMTP servisine gerçek işlem gönderilmedi. Testler geçici veritabanları ve sentetik veriler kullanır.

Çalıştırılan Node sürümü 22.14.0. Proje engine gereksinimi >=22.15.0 olarak kalıyor; sistem Node kurulumu değiştirilmedi. Önceki güvenlik raporundaki desteklenen runtime ve canlı dağıtım koşulları geçerlidir.

Kaynak kalıp taraması: 848 çalışma dosyasında eşleşme yok. Tarama sınırlı kalıplar kullanır; genel güvenlik veya geçmişte sır bulunmadığı garantisi değildir.

Önceki ayrıntılı kayıtlar: [güvenlik sonuçları](security/SECURITY_TEST_RESULTS_TR.md), [kitap ve hesap akışları](book-authoring-reader-report.md).
