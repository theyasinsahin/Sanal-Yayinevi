# Güvenlik uygulama planı

Tarih: 1 Kasım 2026. Başlangıç: `security/hardening-betik`; çalışma ağacı temiz. Commit/push/PR/deployment yapılmayacak. `.env` içerikleri, gerçek DB/servisler ve mevcut kullanıcı verileri değiştirilmeyecek.

## Keşiften çıkan öncelik sırası

| Öncelik | İş paketi | Gerekçe ve hedef |
| --- | --- | --- |
| P0 / operasyon | Git tarafından izlenen secret yapılandırmasını raporla | Değerleri ifşa etmeden rotasyon ve takipten çıkarma; geçmiş yeniden yazılmaz |
| P1 | Kitap HTML güvenliği | Sunucuda allowlist temizliği, eski içerik için çıktı temizliği, tarayıcı render öncesi savunma; kitap biçimi korunur |
| P1 | Kurtarma/kayıt/oturum | Hashlenmiş tek kullanımlık süreli token, atomik tüketim, parola değişiminde authVersion iptali, kriptografik kayıt kodu ve deneme sınırı |
| P1 | Özel içerik ACL | PRIVATE/FOLLOWERS_ONLY HTTP ve WS eşitliği, olayda erişim/oturum yeniden kontrolü, nested taslak sızıntısı |
| P1 | Google giriş güvenliği | GIS double-submit CSRF, doğrulanmış e-posta claim'i, URL query'de oturum taşımayı kaldırma |
| P1 | API kaynak/kötüye kullanım sınırları | Ortak HTTP/WS sorgu bütçesi, alias/fragment ve değişken sınırı; kalıcı IP/hesap hız sınırı; gövde ve socket sınırları |
| P1/P2 | Bağımlılıklar | npm audit; uyumlu yamalar önce; zorunlu API değişikliği kontrollü ve testli; `audit fix --force` yok |
| P2 | Yapılandırma/hata/dosya | Hassas hata/stack gizleme, no-store/header/origin/proxy kontrolleri, özel PDF yükleme kotası ve içerik kontrolleri |
| Doğrulama | Regresyon ve mevcut davranış | Yeni güvenlik testleri, finans tekrar/yarış/ACL testleri, Server/Client testleri, build ve lint |
| Teslim | Türkçe kanıt ve operasyon dosyaları | Bulguların dosya/satırları, önce/sonra, test edilemeyenler, manuel canlı ön koşulları |

## Uygulama ilkeleri

Önce sentetik regresyon senaryoları yazılır; uygulanabilir olduğunda düzeltme öncesi başarısızlık kaydedilir. Koruma merkezi yardımcılarla paylaşılır ama nesne yetkileri servis/resolver içinde tutulur. Veri kaybına neden olacak sanitization migration, index silme, mevcut ödemeleri yeniden işleme veya otomatik secret rotasyonu yapılmaz. Gerekli paketlerin install scriptleri kapatılır. Paket değişiklikleri son test koşusundan önce tamamlanır.

## Uygulanan değişiklikler

| Dosya grubu | Değişiklik ve gerekçe |
| --- | --- |
| `.gitignore`, Git indeksi | Secret dosyasının takibi kaldırıldı; yerel `.env` içeriği korunarak bütünlüğü karşılaştırıldı. Yeni env dosyalarını ignore eden, örnekleri koruyan kurallar eklendi. Rotasyon operasyon ekibindedir |
| `Server/src/security/*`, `models/securityRateBucket.js`, `index.js`, GraphQL schema | Paylaşılan sorgu/input bütçesi, kalıcı atomik rate limit, HTTP parser/header/CORS/proxy ve WS bağlantı/kimlik/olay denetimi; sınırsız alias/deneme ve transport bypass riskini azaltır |
| `utils/auth.js`, user model/service/resolver/typedefs | HS256/yaş sınırı, güncel hesap/sürüm; hashli atomik reset, parola/e-posta/logout iptali; güvenli giriş hata mesajı ve Status hata allowlist'i |
| verification model ve userService | Kriptografik, bcrypt ile saklanan kayıt kodu; açık süre/deneme kontrolü ve tek atomik tüketim. TTL gecikmesi güvenlik kararı değildir |
| googleAuthRoutes, Auth Login/Register/GoogleCallback, googleLoginNonce | Cookie CSRF ve tab nonce; query yerine fragment; doğrulanmış Google sub/e-posta; güvenli mevcut hesap bağlama koşulları |
| richText, imageSource, chapterService/resolver, BookReader, ParagraphRenderer, htmlPageSplitter | Sunucu saklama/çıktı ve tarayıcı temizlik katmanları; karakter kaçışı; eski metne toplu değişiklik yapmadan XSS önleme |
| bookAccess, bookService/resolver, Chapter sorguları, Message eki, publicUrl, Quote servis/alan/erişim | Taslak ve yayımdan kaldırılmış kitabın doğrudan/nested/alinti erişimini engelleme; metadata ve metin ayrı ayrı değerlendirilir |
| pagination, getAll query/typedefs, bookCatalogService | Eski liste uçlarına 100'lük limit/offset; görünürlük için gerekli alan projeksiyonu korunur, katalog sorgu sayısı artmaz |
| adminService/adminResources/user model | Yönetici kapatmasını self-deactivation'dan ayıran loginBlocked; yeni iç kimlik/engelleme alanları admin JSON çıktısında hassas kabul edilir |
| PDF asset/route ve ImageUpload | Kullanıcı PDF sıklık kotası, sıkıştırılmış gövde reddi, varsayılan raster/byte/piksel sınırı. Cloudinary sağlayıcı kotası ve AV hâlâ operasyon/tasarım işidir |
| session schema/resolver/service, istemci query/hook/SessionDetail | PRIVATE/FOLLOWERS_ONLY için HTTP/WS aynı erişim kuralı; kod okumaya/sayfalamaya/beğeniye/aboneliğe aktarılır, özel cache anahtarları korunur |
| formatError, DB log, socialShareRoutes, frontend index.html | Genel iç hata ve güvenli validation mesajı, logda hassas hata azaltımı, güvenilir proxy protokolü ve referrer metası |
| Client QuotesPage ve testi | Başlangıçta da başarısız olan sayfalama testi incelendi; ilk sayfa hazır olmadan observer açma ve paralel loadMore istekleri engellendi |
| Server/Client package ve lockfile | Apollo 5 / Express 4 adaptasyonu, güvenlik yamaları ve kullanılmayan paketlerin kaldırılması; Node minimumu 22.15.0; lockfile bütünlüğü korundu |
| Güvenlik testleri ve Jest setup | Yerel sentetik regresyonlar ve gerçek HTTP/WS startup testleri. Jest 29 CJS/ESM köprüsü gerçek htmlparser2 exportlarını kullanır, sanitizer/parse sonucu taklit edilmez; resolver mock yolları mutlak yapıldı |
| securityScan script ve redakte JSON kanıtları | Değer basmadan çalışma ağacı secret kalıbı kontrolü; dependency, lint ve test sonuçlarının tekrar incelenebilir kayıtları |

[Tam dosya manifesti](CHANGED_FILES_TR.md) mevcut Git farkı ve yeni dosyalardan üretilir. Finans ledger/state motoru yeniden yazılmadı; mevcut transaction ve sağlayıcı doğrulaması korundu.

## Ertelenen ve manuel işler

Secret rotasyonu/depo erişimi, eski admin kapatma kayıtlarının kontrollü düzeltmesi, frontend/proxy/Google/Cloudinary yapılandırması, DB/yedek ve alarm kurulumu, Node güncellemesi ve gerçek tarayıcı/Android kabulü kod dışı adımlardır. Bu görev bunları production'da uygulamadı.

MFA/step-up ve recovery; yeni e-posta doğrulama/üçüncü taraf Google hesap bağlama UI akışı; cihaz bazlı session/idle timeout; issuer/audience geçişi; tam PDF AV/CDR/toplam kota; kalan CRA/Quill geçişi; merkezi güvenlik logları; legacy nested listelerin tümünü sayfalama ve dağıtık yük/failure testi ayrı geliştirme paketleridir. Bu alanlara eksik protokol veya sahte güvenlik sağlayıcısı eklenmedi. ASVS matrisi eksikleri açık bırakır.

Yeni authVersion/loginBlocked/googleSubject/attempts/rate koleksiyonu alanları eklemelidir; mevcut finansal kayıtlar dönüştürülmedi. Yeni indekslerin production'da hazırlanması bakım/deployment sürecinde doğrulanmalıdır. Adres anahtarını değiştiren bir migration yoktur.
