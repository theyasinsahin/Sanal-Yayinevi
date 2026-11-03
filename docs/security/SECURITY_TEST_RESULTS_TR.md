# Güvenlik test sonuçları

Tarih: 1 Kasım 2026. Testler yalnız sentetik verilerle, mongodb-memory-server geçici replica set'leri ve loopback HTTP/WS üzerinde yürütüldü. Gerçek ödeme/SMTP/Cloudinary/production DB çağrısı yapılmadı.

## Sonuç

| Kontrol | Sonuç |
| --- | --- |
| Server tam test | **43 suite, 695/695 test başarılı**; `security-server-release-check.log` |
| Son ortak session kodu kotası sonrası tekrar | **7 suite, 98/98 test başarılı**; iki yeni çapraz yol/normal kullanım regresyonu dahil `security-final-session-check.log`. Bu 98 testin önceki tam koşuyla örtüşenleri yeni test sayısı olarak toplanmaz |
| Client tam test | **74 suite, 507/507 test başarılı**; `security-client-release-check.log` |
| Client production build | **Başarılı**; `security-client-release-build.log` |
| Değişen Client kaynaklarının ESLint kontrolü | **0 hata, 2 uyarı**, 19 JS/JSX dosyası; [makine kaydı](CHANGED_CLIENT_LINT.json) |
| Tüm Client `src` ESLint | **Başarısız: 36 hata, 13 uyarı**. Hatalar değiştirilmeyen 10 test dosyasında; render-result isimlendirme ve doğrudan DOM erişim kuralları. Tam lint'in geçtiği iddia edilmez |
| Server lint | Lint script/config bulunmadı. Syntax, Jest ve gerçek entrypoint startup doğrulandı; bunlar ESLint olarak adlandırılmaz |
| Server syntax | 206 JS dosyası `node --check` ile başarılı; [kayıt](SERVER_SYNTAX_CHECK.json) |
| npm audit Server | 35 → 26 paket uyarısı; kritik 1 → 0, yüksek 8 → 0. Production bağımlılıkları: 5 orta |
| npm audit Client | 106 → 78; kritik 5 → 0, yüksek 37 → 13. Kalan yüksekler eski CRA/build/development zincirindedir |
| Secret kalıp taraması | Önce izlenen env + beş secret adayı; sonra çalışma ağacında 0. [Önce](SECRET_SCAN_REDACTED.json), [sonra](SECRET_SCAN_REDACTED_AFTER.json) |
| Lockfile kaynağı/bütünlüğü | Kontrol edilen resolved kayıtların tamamı npm registry ve integrity içeriyordu; doğrulama paketin kötü niyetli olmadığını kanıtlamaz |
| Build secret karşılaştırması | 160 metin artefaktında yerel env secret adaylarının tam değer eşleşmesi yok; [redakte kayıt](BUILD_SECRET_SCAN_REDACTED.json). Genel secret yokluğu iddiası değildir |
| Git diff whitespace | `git diff --check` başarılı |

Testlerin çalıştığı runtime **Node 22.14.0** idi. Yeni GraphQL Tools transitif bileşeni `>=22.15.0` istediği için engine uyarısı alındı; package metadata minimumu 22.15.0 yapıldı. Sistem Node kurulumu değiştirilmedi. Desteklenen güncel runtime'da temiz CI koşusu canlı ön koşuludur. React act/Quill ve CRA Babel bakım uyarıları da vardır; başarılı test bunların yokluğu anlamına gelmez.

## Önce / sonra

| Senaryo | Başlangıç kanıtı | Son davranış |
| --- | --- | --- |
| Parola değişimi sonrası eski JWT | Yeni regresyon başarısız; eski token kabul ediliyordu | authVersion yükselir, token reddedilir |
| Reset tokenı saklama/yarış | Açık token saklanıyordu; iki paralel reset tamamlanabiliyordu | Hash saklanır, atomik tüketimde tek başarı |
| Süresi geçmiş kayıt kodu | TTL silinmeden önce kabul edildi | Sunucu 10 dakika süresini ayrıca kontrol eder |
| Kod denemeleri | Beş yanlış deneme ardından doğru kod çalıştı | Deneme bütçesi bitince doğru kod da reddedilir; yeni kod gerekir |
| Eski HTML ve yeni bölüm yazımı | Script/event/javascript URL çıktıda kaldı | Saklama, API çıktısı ve DOM render allowlist'i temizler |
| PRIVATE ileti okuma/beğeni | Kodsuz okuma ve yetkisiz işlem mümkündü | Kod veya sahiplik; FOLLOWERS_ONLY güncel ilişki |
| Takipçi olmayan WS abonesi | Abonelik açıldı | Subscribe reddi, olayda erişim ve oturum yeniden kontrolü |
| Başkasının taslak kitabı | Başlık/açıklama döndü | Public lookup null; mesaj eki yeniden yetkilendirilir |
| Yayımdan kaldırılmış kitabın eski alıntısı | Ek regresyonda `{ getQuotesFeed { text } }` metni gösterdi | Feed ve metin alanı güncel kitap görünürlüğünü uygular |
| Google handoff | CSRF/nonce kontrolü yok; token query'deydi | Cookie/body eşleşmesi, tab nonce, fragment ve temizleme |
| Admin kapatma | isActive=false login'de yeniden açılıyordu (kod kanıtı) | Gerçek admin servisi loginBlocked kaydeder; parola ile açılamaz |

İlk `securityRegression.test.js` koşusu **8/8 başarısız**dı (`security-regression-before.log`). Düzeltme sonrası aynı sekiz test geçti. Ek yayımdan kaldırma testi **1 başarısız, 16 atlanan** koşuda açığı gösterdi (`security-unpublish-before.log`); sonra düzeltildi. Son tam koşu yeni ve mevcut testleri birlikte kapsar.

## Test grupları ve kapsamları

- **securityRegression:** gerçek Mongoose/bcrypt ile reset/hash/tek kullanım, concurrency, kayıt kodu süre/deneme, HTML saklama/çıktı, özel ileti, takipçi aboneliği, doğrudan/nested draft, eski alıntı, logout, gerçek admin kapatması, e-posta değişimi, eşit login hatası, doğrulanmamış Google claim ve hesap bağlama; Status nesnesinden SMTP hata sızıntısı.
- **securityControls:** atomik 30 eşzamanlı kota isteği, alias ile login bütçesi, sınırlı public liste, HTTP batching/introspection/CSRF, büyük/bozuk/sıkıştırılmış body, depth/field/alias/fragment/list budget, input/prototype anahtarları, proxy spoofing, HTTP/WS proxy eşitliği, gerçek WS transport/kimlik/özel erişim, stream revocation/expiry ve hostile HTML.
- **securityStartup:** gerçek `Server/index.js` alt process'i ayrı `betik_print_sandbox_*` geçici DB ve yalnız sentetik environment ile açılır. Secret dosyası yüklenmez; CORS/header, health ve batch reddi test edilir; process ve replica set kapatılır.
- **İstemci güvenlik regresyonları:** gerçek DOMPurify çıktısında attribute/script/namespace/data URI kontrolü; sayfa bölme quote escaping'i; biçimlendirme/raster embed; tab nonce ve StrictMode; özel session sorgusunun doğrulama öncesi beklemesi ve kodlu sayfalama.
- **Mevcut auth/ACL testleri:** authentication, profileSettings, chapterVisibility, quotePrivacy, messaging, session lifecycle/access, followRequests, adminManagement ve publisherPortal gibi dosyalar tam koşuya dahildir.
- **Mevcut finans testleri:** printFunding ve iyzicoFunding içinde 120 paralel reservation/capture, aynı anahtar/duplicate webhook, replay, yanlış tutar/para birimi/imza, yanıt kaybı, geç başarı, iade retry/tekilleştirme, onaysız kampanya, üretim/teslimat durum geçişleri, özel PDF/adres, AES-GCM/AAD, ledger ve audit. iyzico SDK yanıtları mock'tur; bankaya test isteği atılmaz.
- **Normal davranış/performance:** istemci GraphQL dokümanları, kataloğun pagination/sıralama ve sorgu sayısı, okuma/otomatik kayıt/puan/sosyal görünürlük, admin ve basım ekranları. İlk katalog N+1 regresyonu projeksiyonda isDeleted alanı korunarak düzeltildi; sınır gevşetilmedi.

## Çalıştırılan komutlar ve ara koşular

```powershell
npm.cmd --prefix Server run test:ci
npm.cmd --prefix Client run test:ci
npm.cmd --prefix Client run build
# Client çalışma dizininde:
.\node_modules\.bin\eslint.cmd src --ext .js,.jsx
# Server/Client çalışma dizinlerinde:
npm.cmd audit --json
# Server çalışma dizininde ayrıca:
npm.cmd audit --omit=dev --json
# Repo kökünde:
node Server/src/scripts/securityScan.js
git diff --check
```

Odaklı koşular `securityRegression`, `securityControls`, `securityStartup`, authentication/accountEmails/formatError/httpCallbacks/profileSettings, performance/printedBooks, quotePrivacy/quoteInteractions/chapterVisibility ve dört resolver dosyasını; Client koşuları richText, GoogleCallback, useSessions, ImageUpload ve QuotesPage dosyalarını içerdi. Sonuçlar [test yürütme kaydında](TEST_RUNS_REDACTED.json) komut grubu ve gerçek özetleriyle tutulur; aynı testlerin tekrarları toplanıp yeni test sayısı gibi gösterilmez. Son session kodu bütçesi değişikliğinden sonra bütün Server suite'i tekrar çalıştırılmadı; değişikliğin etkilediği yedi suite, gerçek startup/HTTP/WS ve normal session yaşam döngüsü dahil yeniden çalıştırıldı.

Başlangıç Server koşusu 40 suite/652 test geçti. Başlangıç Client koşusunda 73 suite/497 testten 496'sı geçti; QuotesPage infinite scroll testi başarısızdı. İlk ara hardening koşuları gerçek parser'ın Jest CJS/ESM uyumsuzluğunu, resolver mock yolunu ve bir katalog ek sorgusunu ortaya çıkardı. Bunlar giderildi. Paket güncellemesiyle çakışan bir ara koşudaki dosya okuma hatası geçerli doğrulama sayılmadı; son tam koşu bağımlılık kurulumu tamamlandıktan sonra alındı. Alıntı testi gerçek akış hazır olmadan observer çağrısını tetikliyordu; UI'ya paralel çağrı kilidi ve hazır olma kontrolü eklendi, test gerçek aktif observer'ı bekler.

## Test edilemeyenler

Production TLS/CDN/WAF/DNS/proxy zinciri, Mongo hizmet hesabı/şifreleme/yedek/restore/failover, gerçek Google browser redirect ve cookie topolojisi, SMTP teslimatı, Cloudinary preset/kota, gerçek iyzico sandbox sözleşmesi ve banka/chargeback, gerçek matbaa/kargo, Android native binary ve cihaz, browser görsel/E2E kabulü, antivirüs/CDR, çok process/çok node finans worker ve botnet/gerçek yük testi yapılmadı. AI/LLM bulunmadığından prompt injection testi uygulanmaz.

Secret scanner sınırlı bir kalıp tarayıcısıdır; tam SAST/Git geçmişi analizi değildir. npm audit advisories paket seviyesindedir; uygulama istismarı otomatik kanıtı değildir. ASVS matrisi birebir her gereksinime ayrı test yazıldığı anlamına gelmez. [Operasyon kapıları](SECURITY_OPERATIONS_TR.md) tamamlanmadan bütün sistem için güvenlik garantisi verilmez.
