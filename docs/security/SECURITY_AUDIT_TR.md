# Betik güvenlik denetimi

Denetim başlangıcı: 1 Kasım 2026. Dal: `security/hardening-betik`. Başlangıç çalışma ağacı temizdi. Bu çalışma kaynak kodunda düzeltme ve yerel doğrulama içerir; üretim sızma testi veya ASVS sertifikasyonu değildir.

## Yönetici değerlendirmesi

En önemli başlangıç riskleri Git içinde secret yapılandırması, kitap HTML'inde stored XSS, özel oturum iletilerine yetkisiz erişim, kurtarma/kayıt belirteçlerinin yaşam döngüsü, Google girişinin tarayıcı isteğine bağlanmaması ve sınırsız GraphQL işlem maliyetiydi. Ek bir regresyon, yayımdan kaldırılan kitabın eski alıntılarından metin okunabildiğini gösterdi.

Kod düzeltmeleri aşağıda kanıtlarıyla listelenir. **Git geçmişindeki anahtarların rotasyonu, yönetici MFA/step-up, frontend hosting güvenlik başlıkları ve PDF zararlı içerik taraması açık kalır.** Bu koşullar tamamlanmadan yüksek riskli finansal canlı kullanım uygun kabul edilmemelidir.

## Kapsam ve yöntem

React/Apollo/Quill ve Android kabuğu; Express/Apollo HTTP ve graphql-ws; resolver/schema, Mongoose modelleri ve servisler; JWT/Google/kayıt/kurtarma; profil, takip, mesaj, kitap/bölüm/alıntı, ADMIN/PUBLISHER; basım başvurusu, maliyet, kampanya, ödeme/rezervasyon/ledger/iade/üretim/adres; PDF ve Cloudinary yükleme; SMTP ve bildirimler; environment, Git ve npm lockfile; mevcut testler incelendi.

Keşif → STRIDE → risk planı → sentetik regresyon → düzeltme → entegrasyon/derleme/lint/audit sırası izlendi. İlk sekiz regresyonun sekizi düzeltme öncesinde başarısız oldu. Sonraki yayımdan kaldırma senaryosu da önce başarısız, düzeltme sonrası başarılı oldu. Başarısız ara koşular sonuç dosyasında korunur; son doğrulamanın yerine kullanılmaz.

Üretim DB/ödeme/SMTP/Cloudinary/hosting taranmadı. Gerçek ödeme, e-posta, migration, deployment, push, commit veya geçmiş yeniden yazımı yapılmadı. `.env` değerleri raporlanmadı. Dosya yalnız Git indeksinden çıkarıldı; yerel dosyanın SHA-256 karşılaştırması içeriğin değişmediğini doğruladı. Bu işlem Git'te silinmiş olarak hazırlanmıştır; commit yapılmadı.

## Doğrulanan bulgular

[Bulgu bazında dosya ve satır tablosu](FINDING_LOCATIONS_TR.md) son kaynak ağacından üretilir. Aşağıdaki açıklamalar önceki davranışın kanıtını ve yeni kontrolü birlikte verir.

### BETIK-SEC-001 — P0: Git tarafından izlenen secret yapılandırması

- **Bileşen/konum:** önceki Git ağacında `Server/.env:1` ve devamı; düzeltme `.gitignore:4`, tarayıcı `Server/src/scripts/securityScan.js`.
- **Yüzey ve saldırgan:** depoya, eski clone'a, CI artefaktına veya geçmişine okuma erişimi olan kişi.
- **Anlamı/etki:** oturum imzalama, DB, ödeme veya SMTP secret'ı geçerliyse bunların güven sınırı aşılabilir. Deponun halka açık olduğu veya anahtarların hâlen geçerli olduğu iddia edilmez.
- **Kanıt:** `git ls-files` ve değer basmayan tarama; JWT_SECRET, MONGO_URI, IYZICO_API_KEY, IYZICO_SECRET_KEY ve EMAIL_PASS için yapılandırılmış secret adayları. [Önceki tarama](SECRET_SCAN_REDACTED.json).
- **Çözüm/durum:** `.env` indeks dışına çıkarıldı; `.env.*` ignore, örnek dosyalar için istisna eklendi. Yerel yapılandırma korundu. [Son taramada](SECRET_SCAN_REDACTED_AFTER.json) aday yok; geçmiş kopyalar temizlenmiş sayılmaz. **Rotasyon hâlâ gerekli.**

### BETIK-SEC-002 — P1: Kitap metninde stored XSS

- **Konum:** `Client/src/pages/BookReader/index.jsx` HTML render noktası; `Client/src/components/ParagraphComment/ParagraphRenderer/index.jsx`; `Server/src/graphql/resolvers/chapter.js:107`, `Server/src/services/chapterService.js`, `Server/src/security/richText.js`.
- **Yetki/yüzey:** kitap yazabilen hesap, bölüm HTML'i. Okur veya yönetici kitabı açtığında zararlı işaretleme işlenebilir; tarayıcıda tutulan JWT ve hesap işlemleri etkilenebilir.
- **Kanıt:** event handler, script ve kodlanmış javascript URL içeren eski bölüm API çıktısında korunuyordu; başlangıç regresyonu başarısızdı. Gerçek kullanıcı tokenı çalınmadı.
- **Çözüm:** sunucuda sanitize-html allowlist; eski verinin okuma çıktısında temizlik; tarayıcıda DOMPurify; sayfa bölmede attribute escaping. Biçimlendirme, bağlantı ve imzası doğrulanan sınırlı raster data URI görselleri korunur; SVG/MathML/script/event ve keyfi CSS kaldırılır. Toplu metin migration'ı yapılmadı.
- **Durum/test:** düzeltildi; saklama/çıktı ve tarayıcı DOM regresyonları, namespace/mutation XSS örnekleri ve normal biçimlendirme testli. PDF/harici medya zararsızlığı bu kontrolün kapsamı değildir.

### BETIK-SEC-003 — P1: Sınırlı oturumlarda HTTP/WS erişim tutarsızlığı

- **Konum:** `Server/src/services/sessionService.js` içindeki `getSessionEntries` / `requireSessionRead`, `Server/src/graphql/resolvers/session.js:121`, session GraphQL sözleşmesi ve `Client/src/hooks/useSessions.js`.
- **Yetki/yüzey:** anonim veya oturuma yetkisi olmayan kullanıcı; sessionId ile ileti listesi, beğeni ve gerçek zamanlı abonelik.
- **Kanıt:** PRIVATE okumaları erişim kodu istemiyor, abonelik yalnız sessionId karşılaştırıyordu. Takipçi olmayan hesap abonelik açabiliyordu. Sentetik regresyonlar bunu yeniden üretti.
- **Çözüm:** ortak `requireSessionRead`; PRIVATE için sahiplik/kod, FOLLOWERS_ONLY için güncel takip ilişkisi. İlk abonelikte ve olayda erişim/hesap sürümü yeniden doğrulanır. İstemci kodu okumaya, sayfalamaya, beğeniye ve aboneliğe taşır; kapı açılmadan özel ileti sorgulamaz. Son erişim incelemesinde, bütün kod kontrol yollarına oda/IP ve hesap bazında ortak başarısız deneme bütçesi bağlandı; başarılı okumalar bu bütçeyi tüketmez.
- **Durum/test:** düzeltildi; HTTP/gerçek WS reddi, normal açık oturum yayını, iptal/süre sonu, özel okuma ve istemci sayfalama testleri. Başlık/kapak gibi listeleme metadatası hâlâ keşif amaçlıdır.

### BETIK-SEC-004 — P1: Kurtarma tokenı ve oturum iptali eksikleri

- **Konum:** `Server/src/services/userService.js:110`, `resetPassword`, `forgotPassword`; `Server/src/utils/auth.js:5`; `Server/src/graphql/resolvers/user.js:63`.
- **Yetki/yüzey:** çalınmış geçerli oturum veya DB'den okunmuş kurtarma tokenı; eşzamanlı reset istekleri.
- **Kanıt:** reset tokenı açık saklanıyordu, okuma ve tüketme ayrıydı; parola değişimi authVersion artırmıyordu. İlk regresyonlarda eski JWT geçerli kaldı ve iki reset tamamlanabildi.
- **Çözüm:** 256 bit reset tokenının SHA-256 özeti saklanır; süre ve token eşleşmesiyle tek atomik update; parola/e-posta değişiminde ve sunucu logout işleminde authVersion artar. JWT HS256 allowlist, azami bir gün yaş ve güncel DB kullanıcı/sürüm kontrolü HTTP/WS'de paylaşılır. E-posta değişimi eski kurtarma bağlantısını ve doğrulanmışlık iddiasını temizler; eski adrese gizli bildirim kopyası gönderir.
- **Durum/test:** düzeltildi; eşzamanlı iki resetten biri geçer, eski oturumlar reddedilir. Eski açık token biçimindeki reset bağlantıları yeniden istenmelidir. Sunucuya ulaşılamayan yerel logout, sunucu iptali garantisi vermez.

### BETIK-SEC-005 — P1: Kayıt kodunda süre/deneme/rasgelelik eksikleri

- **Konum:** `Server/src/services/userService.js`, `sendRegistrationCode` ve `registerUser`; `Server/src/models/verification.js`.
- **Yetki/yüzey:** anonim kayıt isteği; eski veya tahmin edilen altı haneli kod.
- **Kanıt:** Math.random, açık kod, deneme sayısı olmaması ve süre kontrolünün yalnız MongoDB TTL temizliğine bırakılması. TTL silinmesinden önce süresi geçmiş kod kabul edildi; yanlış denemelerden sonra doğru kod hâlâ çalıştı.
- **Çözüm:** kriptografik altı basamak, rastgele saltlı bcrypt cost 10 saklama; açık 10 dakika kontrolü; beş doğrulama denemesi; atomik tüketim; IP/hesap kotası ve sunucu giriş doğrulaması. Yeni hesap doğrulanmış e-posta ile oluşturulur.
- **Durum/test:** düzeltildi; gerçek bcrypt, süre, deneme, tek kullanım ve paralel tüketim testli. Eski süresi geçmemiş kodlar en fazla mevcut 10 dakikalık pencere boyunca kabul edilir. Kullanıcıya yeni e-posta değişimini doğrulayacak tamamlanmış bir süreç sunulmuş sayılmaz.

### BETIK-SEC-006 — P1: Google login CSRF ve güvenli hesap bağlama eksikleri

- **Konum:** `Server/src/routes/googleAuthRoutes.js`, `Server/src/services/userService.js:280`; istemci Auth Login/Register/GoogleCallback ve `utils/googleLoginNonce.js`.
- **Yetki/yüzey:** kendi Google hesabı/tokenı olan saldırgan; hazırlanmış callback veya giriş bağlantısı.
- **Kanıt:** form callback cookie/body CSRF eşleşmesini kontrol etmiyor; oturum tokenı query string'e yazılıyordu. Servis email_verified/sub şartı olmadan e-postayla eşleştirme yapıyordu. Gerçek Google hesabı veya oturumu ele geçirilmedi; mock claim/yerel HTTP testleri kullanıldı.
- **Çözüm:** GIS double-submit cookie kontrolü, tab'a bağlı 256 bit nonce, tek kullanımlı nonce tüketimi ve süre; yalnız URL fragment'inde handoff ve anında temizleme; SDK audience/imza doğrulamasına ek doğrulanmış e-posta/sub; yetkili olmayan üçüncü taraf e-postasıyla otomatik mevcut hesap bağlamanın reddi. Subject mevcut hesaba kaydedilir.
- **Durum/test:** yerel kontroller düzeltildi. Gerçek Google Console origin/callback ayarları ve tarayıcı uçtan uca akışı manuel doğrulanmalı. Gmail/Workspace dışındaki mevcut hesaplar için ayrı güvenli hesap bağlama akışı hâlâ geliştirme konusudur.

### BETIK-SEC-007 — P1: API kaynak tüketimi ve deneme sınırı eksikleri

- **Konum:** `Server/index.js`; `Server/src/security/graphqlSecurity.js`, `rateLimit.js`, `httpSecurity.js`, `websocketSecurity.js`; `SecurityRateBucket`.
- **Yetki/yüzey:** anonim/normal hesap; alias, fragment, iç içe listeler, giriş/kod ve büyük istekler.
- **Kanıt:** başlangıçta derinlik/maliyet ve deneme kotası yoktu; introspection üretimde de açıktı. HTTP batch'in geçmişte etkin olduğu iddia edilmez. Gerçek kapasiteyi çökerten yük testi yapılmadı.
- **Çözüm:** parse token/gövde, derinlik/alan/alias/maliyet ve runtime değişken sınırları; root resolver başına kalıcı atomik IP/hesap kotası; eski getAll listelerinde 100'lük sayfalama; HTTP ön-parser kalkanı; WS payload, origin, bağlantı/abonelik/başlatma sınırları. WS query/mutation kabul etmez. Üretimde introspection kapalıdır. Proxy IP kararı HTTP ve upgrade için aynı güven zincirini kullanır.
- **Durum/test:** kontroller testli; 30 paralel denemede beş kabul, alias değişiminde kotanın korunması, fragment/list maliyeti, HTTP/WS bypass ve proxy senaryoları. Tüm legacy nested listeler ve çok instance gerçek yük ölçülmüş sayılmaz.

### BETIK-SEC-008 — P1: Yönetici tarafından kapatılmış hesabın login ile açılabilmesi

- **Konum:** `Server/src/services/adminService.js` kullanıcı düzenleme; `userService.js` parola/Google girişleri; `models/user.js` loginBlocked alanı.
- **Yetki/yüzey:** kapatılmış hesabın parolasını veya Google hesabını bilen kullanıcı.
- **Kanıt:** isActive=false olan her hesap login'de otomatik açılıyordu; öz devre dışı bırakma ile yönetici yaptırımı ayrılmamıştı. Kod akışı kanıttır; son test gerçek admin servisinden kapatıp login'i dener.
- **Çözüm/durum:** yönetici işlemi loginBlocked kaydeder; iki giriş yolu bunu aşamaz. Kullanıcının kendi devre dışı bırakma/yeniden açma deneyimi korunur. **Daha önce yönetici tarafından kapatılan eski kayıtlar için geçmiş incelemesi gerekir; geriye dönük tahmini migration yapılmadı.**

### BETIK-SEC-009 — P1: Yayımdan kaldırılmış kitabın eski alıntısından metin sızması

- **Konum:** `Server/src/services/quoteService.js`, `Server/src/utils/quoteAccess.js`, `Server/src/graphql/resolvers/quote.js`.
- **Yetki/yüzey:** anonim/normal okur; alıntı akışı, kullanıcı/kitap alıntıları, arama ve etkileşimler.
- **Kanıt:** yayımlanmış kitaba ait alıntı oluşturuldu, kitap DRAFT yapıldı; yalnız `{ getQuotesFeed { text } }` seçilerek eski özel metin okunabildi. `security-unpublish-before.log` başarısız regresyondur.
- **Çözüm:** alıntı listesindeki kitaplar topluca güncel görünürlükten geçirilir; metin alanı ayrıca kitap erişimini doğrular; etkileşim için requireQuote kitap görünürlüğünü de denetler. Kayıt silinmez.
- **Durum/test:** düzeltildi; yayımdan kaldırma regresyonu ve alıntı gizliliği/etkileşimi testleri geçti. Sayfa sonrasında görünmez kayıt elenmesi kısa sayfa oluşturabilir; ileri çalışma olarak sorgu öncesi görünürlük/pagination optimizasyonu değerlendirilmeli.

### BETIK-SEC-010 — P2: Doğrudan/nested taslak kitap metadatası

- **Konum:** `bookService.js:21`, `bookAccess.js`, GraphQL Book alan koruması, message.attachedBook, publicUrl ve Chapter sorguları.
- **Yetki/yüzey:** kitap/mesaj/bölüm kimliğini bilen başka kullanıcı; başlık/açıklama ve bölüm listesi.
- **Kanıt:** getBookById dijital DRAFT metadatasını döndürüyordu; önceden populate edilmiş mesaj kitabı yeniden yetkilendirilmiyordu. Asıl bölüm metninde zaten ayrı bir erişim kontrolü vardı; o kontrolün tamamen yok olduğu iddia edilmez.
- **Çözüm/durum:** public sorguda görünürlük; nested Book alanlarında da ACL; mesaj ekinde güncel kitabı okuma; Chapter listesinde erişilebilir kitap filtresi. Sahibinin yazı masası korunur. Doğrudan ve gerçek mesaj eki regresyonları testli.

### BETIK-SEC-011 — P2: Aramanın ham regex olarak yorumlanması

- **Konum:** `bookService.searchBooksInDb`, `quoteService.searchQuotes`, `security/search.js`.
- **Yetki/yüzey:** anonim arama isteği. `.*` gibi ifade düz metinden farklı sonuç, patolojik regex ise DB kaynak maliyeti doğurabilir.
- **Kanıt:** kullanıcı sorgusu doğrudan $regex'e konuluyordu. Sınırsız regex yorumlama koddan doğrulandı; gerçek DB üzerinde ReDoS kapasitesi ölçülmedi. GraphQL String girişinden Mongo operator nesnesi enjeksiyonu kanıtlanmadı.
- **Çözüm/durum:** 120 karakter ve literal escaping, kitap aramasında sonuç sınırı. Mevcut katalog aramasının önceden güvenli escaping'i korundu; ona yeni açık yakıştırılmadı.

### BETIK-SEC-012 — P2: Hata/HTTP/proxy sertleştirme eksikleri

- **Konum:** `utils/formatError.js`, `security/httpSecurity.js`, kullanıcı status yanıtları, DB/startup logları, Google callback, socialShareRoutes ve `Client/public/index.html`.
- **Kanıt/etki:** beklenmeyen hata metni ile validation mesajındaki ham değer korunabiliyordu. register/sendRegistrationCode Status nesnesi hata formatter'ını atlayabiliyordu. Paylaşım protokolü güvenilmeyen forwarded header'dan seçiliyordu. Üretimde her zaman stack açıldığı iddia edilmez.
- **Çözüm/durum:** bilinmeyen üretim hatası genelleştirilir; stack/exception çıkarılır, validation alan mesajı ham değerden ayrılır; hesap Status hataları allowlist'ten geçer. JSON parser hata yanıtı, no-store/nosniff/referrer/CSP/HSTS, sınırlı CORS ve proxy ayarı eklendi. Frontend referrer metası var; tam frontend CSP/HSTS hosting işidir. Testler sentetik hassas mesajın dışarı çıkmadığını doğrular.

### BETIK-SEC-013 — P2: Dosya yükleme kaynak ve aktif içerik riskleri

- **Konum:** `services/print/assetService.js:5`, `routes/printRoutes.js`, `Client/src/components/ImageUpload/index.jsx`.
- **Kanıt:** tek PDF 10 MB olsa da hesap başına yükleme sıklığı sınırsızdı; genel görsel bileşeninin varsayılan boyutu sınırsızdı. Zararlı gerçek dosya dağıtılmadı.
- **Çözüm:** 20 PDF/saat/hesap; PDF raw gövdede sıkıştırma kapalı; istemci raster tip/8 MB/40 MP/12000 piksel sınırı ve JPEG yeniden kodlama. Mevcut özel ACL, dedup hash, attachment/CSP ve sunucu isimlendirmesi korundu.
- **Durum:** **kısmen kapandı.** İstemci sınırı Cloudinary'yi doğrudan çağırmayı engellemez. Toplam depolama kotası ve PDF antivirüs/CDR/karantina yok; imza/EOF kontrolü tam PDF parse veya zararsızlık kanıtı değildir.

### BETIK-SEC-014 — P1: Bilinen bağımlılık güvenlik uyarıları

- **Yüzey/yetki:** pakete bağlıdır; bazıları build/development, bazıları backend veya Android runtime. CVSS paket seviyesi, otomatik olarak Betik için aynı istismar önceliği değildir.
- **Kanıt:** [npm audit önce/sonra](DEPENDENCY_AUDIT_REDACTED.json). Başlangıç Server: 35 (1 kritik, 8 yüksek); Client: 106 (5 kritik, 37 yüksek).
- **Çözüm:** Apollo 4.13.0 → 5.5.1 ve Express 4 entegrasyonu; Nodemailer 8.0.11 → 10.3.1; body-parser 1.20.6 → 1.20.9; GraphQL Tools güncellemesi; Capacitor Android 8.5.0 → 8.6.0; Router 6.28.1 → 6.30.6; uyumlu transitif yamalar. GraphQL 16.14.2 korundu. Kullanılmayan eski cache/GraphQL ve istemci Node SDK/HTTP/WS paketleri kaldırıldı. Install scriptleri kapalıydı; force fix yapılmadı.
- **Son durum:** Server 26 (0 kritik/yüksek; production bağımlılıklarında 5 orta); Client 78 (0 kritik, 13 yüksek). Kalan Client yüksekleri CRA/build/dev zincirindedir; tam bundle/Android sözleşme analizi yapılmadı. CRA ve Quill 1 zinciri için ayrı geçiş gerekir. Android binary yeniden üretilip cihazda doğrulanmadı.

## Finansal değerlendirme

Mevcut finans kodunda istemciden ödeme başarısı kabul edilmesi, kuruş yerine floating-point ile yeni ledger tutulması veya doğrulanmamış ödeme tutarının kampanyaya eklenmesi **bulunmadı**. Bunlar düzeltilmiş yeni açık olarak sayılmaz.

`print/paymentService`, `paymentProvider`, `iyzicoProvider`, `campaignService` ve modellerde sunucu fiyatı; tutar/referans/para birimi eşleştirmesi; imzalı sonuç sorgulaması; unique event/ledger/refund anahtarları; Mongo transaction ve koşullu kapasite rezervasyonu; geç capture'ın iadeye yönelmesi; audit ve şifreli adres kontrolleri vardır. Mevcut testler 120 paralel rezervasyon/capture, replay, duplicate, yanıt kaybı, yanlış imza/tutar, tam iade ve durum geçişlerini kapsar.

Bu çalışmada eklenen ortak oturum/rol kontrolü, hız sınırı, GraphQL bütçesi ve PDF kotası bu yüzeyi de korur. Gerçek sağlayıcı protokolü değiştirilmedi veya hayali sağlayıcı eklenmedi. Yerel SANDBOX ve iyzico sandbox vardır; canlı tahsilat adaptörü yoktur. Gerçek banka mutabakatı, chargeback, çok process failover ve mevzuat/işletme onayı doğrulanmadı.

## Açık kalan riskler ve kapsam sınırı

1. **P0 / operasyon:** eski secret'lar yeni secret manager değerleriyle değiştirilmeli; erişenler/clone/CI geçmişi değerlendirilmeli. Anahtarın hâlen geçerli olup olmadığını bu çalışma doğrulamadı.
2. **P1 / tasarım:** yönetici ve yüksek değerli finans işlemleri için MFA/step-up; cihaz/oturum envanteri ve sunucu inactivity timeout yok. Yeni faktör/account recovery tasarımı ve UI geçişi ayrı geliştirmedir; yalnız frontend MFA koruması yeterli olmaz.
3. **P1/P2 / operasyon:** eski admin kapatma kayıtlarının loginBlocked'a göre incelenmesi; Cloudinary unsigned preset ve depolama kotası; DB ağ/rol/yedek/şifreleme; TLS/CDN ve frontend CSP; merkezi güvenlik olayları/alarm ve harici audit koruması.
4. **P2:** kalan dependency uyarıları; yaygın/ihlalli parola listesi yok; mevcut karmaşıklık politikası ASVS ile tam uyumlu değil; bcrypt UTF-8 sınırı; yeni e-posta doğrulama ve güvenli üçüncü taraf hesap bağlama UI akışları eksik.
5. **P2:** PDF antivirüs/CDR/karantina ve toplam depolama/adet kotası yok. Hesap silme soft-delete'dir; fiziksel silme/saklama ve mali kayıt muhafazası için onaylı veri yaşam döngüsü gerekir.
6. JWT localStorage'da kalır; XSS giderimleri bu riski azaltır. HttpOnly/BFF'ye geçiş CSRF, mobil ve oturum API'siyle birlikte tasarlanmalı. Uygulama JWT iss/aud ayrımı yok; aynı secret başka servise verilmemeli. Google tokenının kendisinin çalınmasına karşı tam replay direnci iddia edilmez.
7. Bazı sosyal sayaç/beğeni ve içerik işlemleri finans kadar atomik değildir. Tüm nested koleksiyonlar sayfalanmış değildir; sorgu bütçesi gerçek maliyet ölçümü yerine muhafazakâr bir tahmindir. Dağıtık botnet/WAF ve gerçek yük/failure testi açık kalır.
8. Üretim, DNS, CDN, WAF, sertifika, sağlayıcı Console ayarları, cihaz/gerçek tarayıcı, yönetilen yedek ve geri dönüş bu kaynak denetimiyle doğrulanamaz. AI/LLM ve WebRTC/SQL/LDAP/LaTeX/XML işlevleri bulunmadı; bunlar için hayali savunma kodu eklenmedi.

## Standartlar ve kanıt sınırı

[ASVS 5.0.0 matrisi](ASVS_5_0_0_MATRIX_TR.md) 345 gereksinimin uygulanabilirliğini ve doğrulama durumunu listeler. [Tehdit modeli](THREAT_MODEL_TR.md), [uygulama planı](SECURITY_ACTION_PLAN_TR.md), [test sonuçları](SECURITY_TEST_RESULTS_TR.md) ve [operasyon adımları](SECURITY_OPERATIONS_TR.md) birlikte okunmalıdır. Açık L1/L2 gereksinimleri bulunduğundan ASVS L2 uyumluluğu iddia edilmez.

Dayanaklar: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/), [API Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/), [ASVS resmî sürümü](https://github.com/OWASP/ASVS/releases/tag/v5.0.0_release), [GraphQL Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html), [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html), [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final), [Google ID token/CSRF doğrulaması](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).
