# Betik güvenlik operasyonları

Tarih: 1 Kasım 2026. Bu dosyadaki production işlemleri bu çalışma sırasında uygulanmadı. Kod değişiklikleri yereldir; commit/push/PR ve yayın için mevcut proje onayı korunur.

## Canlıya çıkış kapısı

- [ ] Eski Git erişimine açık secret adaylarının hangi ortamda kullanıldığı belirlendi; JWT, DB, iyzico ve SMTP için ilgili sağlayıcıda rotasyon tamamlandı. Aktiflik burada denenmedi.
- [ ] `Server/.env` yerelde duruyor ve Git'ten çıkarılması commit'e dahil ediliyor; `.env`, `.env.prod`, yerel basım ayarları veya secret içeren loglar yeniden eklenmiyor. `.gitignore` tek başına geçmiş sızıntıyı gidermez.
- [ ] Node **22.15.0 veya üstü güncel güvenlik yamalı desteklenen sürüm** ile temiz `npm ci`, test ve build tekrarlandı. Bu çalışma ortamı 22.14.0 idi; yeni transitif paketin engine uyarısı kaydedildi. Sistem Node sürümü değiştirilmedi.
- [ ] Frontend ve backend aynı güvenlik sürümüyle birlikte devreye alınıyor. Eski Google query handoff ve kodsuz PRIVATE okuma kabul edilmeyecek; eski istemcinin bu yolları için geçiş planı gerekiyor.
- [ ] Google GIS redirect alanında `g_csrf_token` cookie'si callback'e gerçekten ulaşabiliyor; nonce aynı tab'da korunuyor. Frontend/API farklı sitelerdeyse aynı origin üzerinden güvenli auth reverse proxy/topoloji sağlandı ve tarayıcıda doğrulandı. Cookie kontrolü atlanarak geçiş yapılmamalı. Gerçek Google giriş/kayıt/yeniden giriş testleri tamamlandı.
- [ ] Google Console izinli JavaScript origin ve callback URI listeleri daraltıldı; gereksiz eski adresler kaldırıldı. Public client ID secret olarak değerlendirilmedi.
- [ ] CDN/reverse proxy üzerinde yalnız HTTPS/WSS, desteklenen TLS ve güvenilir sertifikalar; HTTP yönlendirmesi; gerçek proxy CIDR'leri; API origin listesi doğrulandı. Doğrudan origin sunucusuna proxy dışı erişim kapatıldı.
- [ ] Frontend hosting CSP, HSTS, frame-ancestors ve no-store kuralları uygulandı. API sunucusundaki başlıkların statik frontend'i korumadığı anlaşıldı.
- [ ] Mongo replica set, gerekli unique/TTL indeksler, en az yetkili uygulama hesabı ve test edilmiş yedek/geri dönüş var. Üretimde indeks değişikliği kontrollü bakım yetkisiyle yapılıyor; destructive migration yok.
- [ ] Cloudinary unsigned preset; raster format, azami byte/piksel, oran/adet/depolama kotası, allowed origins ve gerekiyorsa imzalı upload modeliyle doğrulandı. İstemci kısıtları tek başına güvenlik sınırı sayılmıyor.
- [ ] Özel PDF için antivirüs/CDR veya karantina/izole açma prosedürü var. PDF magic/EOF ve attachment, zararsız dosya garantisi sayılmıyor.
- [ ] Önceden yönetici tarafından kapatılmış hesaplar audit geçmişinden incelendi; gerekli `loginBlocked` düzeltmesi ayrı ve onaylı planla yapıldı. Otomatik tarihsel veri değişikliği bu görevde yapılmadı.
- [ ] Yönetici/yüksek değerli işlemler için backend'de zorunlu MFA/step-up ve güvenli recovery akışı geliştirildi veya yüksek riskli kullanım öncesinde güvenilir erişim katmanında eşdeğer kontrol sağlandı. Yalnız admin ekranını gizlemek yeterli değil.
- [ ] Kalan dependency ve lint borçları sorumluya atandı; Android yeni binary/cihaz kabul testi ve gerçek tarayıcı testleri tamamlandı.

## Ortam değişkenleri

| Değişken | Güvenli işletim |
| --- | --- |
| NODE_ENV | Production'da `production`; development dosyalarını canlıda yüklemeyin |
| JWT_SECRET | En az 32 byte uzunlukta, yüksek entropili, uygulamaya özel secret; başka servisle paylaşmayın |
| MONGO_URI | Replica set/mongos, TLS ve en az yetki; production URI'si test runner'a verilmez |
| CLIENT_URL | Production'da tam HTTPS origin; path/query/credential içermez |
| CORS_ALLOWED_ORIGINS | İsteğe bağlı, virgülle ayrılmış tam izinli origin'ler; production için HTTPS; wildcard eklemeyin |
| TRUSTED_PROXY_CIDRS | Yalnız gerçek proxy IP/CIDR listesi; varsayılan güvenilmez. Tüm internete güvenen aralık kullanmayın. HTTP ve WS IP hesabında paylaşılır |
| GOOGLE_CLIENT_ID | Doğru Google projesinin public client ID'si; SDK audience kontrolü için zorunlu |
| PRINT_SYSTEM_ENABLED / PRINT_PAYMENTS_MODE | Canlı tahsilat yok. Gerekli test onayı yoksa açıkça kapalı tutun. `LIVE` desteklenmez |
| IYZICO_BASE_URL / IYZICO_API_KEY / IYZICO_SECRET_KEY | Yalnız desteklenen iyzico sandbox origin'i ve ilgili sandbox hesabı; gerçek ödeme anahtarı eklemeyin |
| PRINT_SANDBOX_WEBHOOK_SECRET | Yerel mock sağlayıcı için ayrı en az 32 karakter; gerçek iyzico imza protokolünün yerine kullanılmaz |
| PRINT_ADDRESS_ENCRYPTION_KEY | 32 byte / 64 hex; adresleri çözmek için eski anahtarı kaybetmeyin; JWT/webhook anahtarıyla aynı olmasın |
| EMAIL_USER / EMAIL_PASS / CONTACT_EMAIL | Deployment secret manager; SMTP app password rotasyonu ve kontrollü test alıcısı. Log/issue'ya yazmayın |

Üretim ortamı dışarıdan verilen değişkenleri kullanır; yerel `.env` dosyası değiştirilmedi. Cloudinary cloud adı/preset ve Google client ID public istemci bilgisi olabilir; bu durum unsigned upload kotası/izinlerini gereksiz yapmaz.

## Secret rotasyonu

1. Sorumlu ve bakım penceresi belirleyin; Git erişimi, CI log/artefaktı, eski clone ve dağıtımları envanterleyin. Anahtar değerlerini rapor/chat/komut loguna taşımayın.
2. Sağlayıcı paneli/secret manager üzerinden yeni secret üretin. DB kullanıcısını minimum rolle yenileyin; SMTP/iyzico eski anahtarlarını planlı iptal edin. Bu değişiklikler uygulama kodundan ayrı ortam operasyonudur.
3. JWT anahtarı değişince eski oturumlar geçersiz olur; kullanıcıları yeniden girişe yönlendirin. Eski kurtarma token biçimi için yeni bağlantı istemeleri gerekir. Anahtarın tekrar eski değere döndürülmesi güvenlik geri alması değildir.
4. **Adres anahtarını körlemesine değiştirmeyin.** AES-GCM envelope v1 anahtar sürüm yönetimi sunmuyor. Eski anahtarla çözme/yeni anahtarla şifreleme, kimlik/AAD/bütünlük kontrolleri, yedek ve ayrı migration onayı gerekir; aksi halde adresler geri dönülmez biçimde okunamaz.
5. Anahtarların Git geçmişindeki tüm kopyalarını iptal edilmiş sayın. Bu çalışma geçmişi yeniden yazmadı. Gerekirse ayrı onaylı geçmiş temizliği/erişim planı hazırlayın; temizliğin rotasyonun yerini tutmadığını unutmayın.

## HTTP, GraphQL ve WS sınırları

| Kontrol | Varsayılan |
| --- | --- |
| JSON | 2 MB; sıkıştırılmış body kabul edilmez |
| GraphQL sorgu | 64 KB, 10000 parser tokenı, derinlik 12, alan 400, alias 40, tahmini maliyet 20000 |
| GraphQL girdileri | Değişken toplamı 1 MB; girdi derinliği 12; array 500; bölüm 500000 karakter; açık liste limit 1–100 / offset 0–10000 |
| Kalıcı root API kotası | IP başına 600 root çağrı/dakika; alias'lar ayrı sayılır |
| Genel yazma | Kullanıcı veya IP başına 120/dakika; bazı hassas operasyonların daha dar kotası vardır |
| Login | IP 20 / hesap 10 deneme, 15 dakika |
| Kayıt kodu / forgot password | IP 5 / hesap 3, 15 dakika; register IP 15 / hesap 5 |
| Reset / parola / e-posta değişimi | IP 10, 15 dakika |
| Session kodu doğrulama | IP 10, 15 dakika |
| PRIVATE kod tahminleri | Okuma/yazma/beğeni/doğrulama/WS için ortak oda+IP ve oda+hesap başarısız deneme bütçesi: 10 / 15 dakika; başarılı kodlu okumalar tüketmez |
| Checkout / bakım | IP 15/dakika ve bakım 2/dakika |
| PDF | 10 MB; kullanıcı başına 20 yükleme/saat |
| WS | 64 KB, IP başına 20 bağlantı, bağlantı başına 5 abonelik; IP 60 abonelik başlatma/dakika; init 5 saniye |
| Ön-parser kalkanı | Process/IP başına 900 istek/dakika; en fazla 10000 IP kovası |

Kalıcı kotalar MongoDB atomik artışıyla paylaşılır; anahtarlar ham IP/e-posta içermez. TTL temizliği gecikse de pencere anahtarı eski kilidi yeni pencereye taşımaz. Store hatasında hassas operasyon fail closed olur. HTTP işlem sayaçları root resolver başınadır; tek HTTP isteği çok resolver içerirse birden fazla sayılır.

Bu sayılar kapasite garantisi değildir. NAT/proxy arkasındaki gerçek trafik ve otomatik okuma heartbeat'iyle izole staging'de ölçün. Proxy ayarı eksikse tüm kullanıcılar aynı proxy IP'sinde kota paylaşır. Çok instance/botnet/WS ping/payload ve büyük nested listeler için CDN/WAF/bağlantı bütçesi ve gerçek yük testi gereklidir. Limit değişiklikleri `Server/src/security` içindeki sabitlerle kontrollü kod değişikliğidir; secret veya üretim DB toplamı elle değiştirilerek aşılmaz.

## Güvenli yayın ve geri alma

Kilitleme dosyalarını koruyun, `npm ci` kullanın; bakım sırasında install scriptlerini ayrı değerlendirin. Bu çalışmada `--ignore-scripts` kullanıldı. CI için read-only repository izinleri, güvenilir/pinlenmiş Actions, ayrı deployment onayı ve PR kontrolü kurun; depoda hazır bir GitHub Actions pipeline'ı bulunmadı. Production paketinde test DB scriptleri, `.git`, `.env`, coverage ve yönetim loglarını public sunmayın. Frontend'i statik build olarak sunun; CRA development server'ını internete/production'a açmayın.

Apollo 5 için `@as-integrations/express4` gerekir. Root GraphQL ve `/graphql` WS adresleri korunmuştur. Google nonce ve PRIVATE erişim kodu geçişi nedeniyle backend/frontend sürüm eşleşmesini staging'de test edin. Eski kullanıcı kaydına destructive migration gerekmez; `authVersion` eski eksik değerleri 0 kabul eder. Yeni SecurityRateBucket TTL indeksi ve mevcut finans unique indeksleri için yetki/çakışma kontrolü yapın. Kod geri alınırken `.env` dosyasını yeniden Git'e sokmayın, ledger veya adres anahtarlarını silmeyin.

Frontend hosting için uygulamanın gerçek Google, API/WS, medya/font kaynaklarını içeren CSP allowlist'i hazırlayın; React/MUI/Quill inline stil ihtiyaçlarını gerçek tarayıcıda ölçün. Önce CSP report-only ile kaynakları doğrulayın, ardından enforce edin. HSTS includeSubDomains/preload yalnız tüm alt alanlar HTTPS olduğunda değerlendirilir. API'nin `default-src 'none'` politikası frontend'e aynen kopyalanmaz. Kaynak haritaları ve source control dosyalarının public erişimini ayrıca kontrol edin.

## Log, alarm ve finans runbook'u

Admin/finans audit'i transaction ile tutulur; raw DB yöneticisine karşı WORM garantisi yoktur. Uygulama hesabından ledger/event/audit update/delete yetkilerini kaldıran DB politikası ve harici değiştirilemez log gerekir. Timestamp UTC, korelasyon kimliği, aktör/işlem/sonuç/safe hata kodu kullanın. Parola, JWT, reset/kayıt kodu, sağlayıcı raw yanıtı, adres veya secret loglamayın. Tüm authentication/authorization olayları için merkezi log altyapısı bu görevde kurulmadı.

Alarm örnekleri: RATE_LIMITED artışı, anormal login başarısızlığı, Google CSRF hataları, PDF yükleme hacmi, Mongo/SMTP hata oranı, worker gecikmesi, uzun GraphQL süreleri, provider signature/amount/reference uyuşmazlığı, financeIssue, bekleyen refund/rezervasyon/outbox ve ledger dengesizliği. Alarm testini gerçek kullanıcı yerine sentetik staging olayıyla yapın.

Finansal uyuşmazlıkta kampanya toplamını veya payment.state'i elle düzeltmeyin. İlgili ödeme/event/refund/audit kimliklerini koruyun; sağlayıcının doğrulanmış raporuyla uzlaştırın, gerekiyorsa kontrollü iade saga'sını tekrar çalıştırın. Finans sorunu varken üretime geçmeyin. Eski gerçek ödeme geçmişi yeni sandbox ledger'ına körlemesine taşınmaz. Banka, matbaa, kargo, chargeback ve gerçek tahsilat için ayrı entegrasyon/işletme kabulü gerekir.

## Yedekleme, veri yaşam döngüsü ve olay müdahalesi

Şifreli Mongo yedeği ve ayrı erişim kontrollü anahtar yedeği alın. Ledger/refund/audit tutarlılığını aynı recovery point ile koruyun. RPO/RTO'yu proje sahibi belirlesin; düzenli izole restore tatbikatında AES-GCM adres çözme, ledger toplamı ve worker idempotency'sini doğrulayın. Üretim yedeği bu çalışma için indirilmedi veya restore edilmedi.

Soft-delete gerçek fiziksel silme değildir. Hesap, adres, mesaj ve mali kayıtların saklama/silme takvimini sorumlu ekip belirlesin. Mali kayıtları rastgele silmeden mahremiyet gereksinimleriyle uzlaştırın. PDF metadatası ve depolama süresi de bu plana dahil olsun.

Olayda önce yetki/erişim ve zaman aralığını sınırlandırın, kanıtları redakte ederek koruyun; ilgili secret/oturumları iptal edin, gerekirse etkilenen akışı bakım moduna alın. Düzeltmeyi sentetik regresyonla doğrulayın; yetkili sorumluya özel kanaldan bildirin. Depo issue'suna gerçek kullanıcı içeriği veya secret koymayın. Bu görevde dışarıya bildirim/e-posta gönderilmedi.

## Sürekli kontroller

Her PR'da test/build ve `npm audit`; secret taramasında `npm.cmd --prefix Server run security:scan`; periyodik lockfile ve SBOM gözden geçirmesi uygulayın. Tarayıcı yalnız sınırlı kalıplar kullanır; kapsamlı SAST veya tüm Git geçmişi secret taraması yerine geçmez. Tam geçmiş taraması gerektiğinde güvenilir aracın redaction özelliğini açın ve çıktıyı kısıtlayın.

Önerilen risk SLA'sı: P0 aynı gün sınırlama/rotasyon; P1 yayından önce veya sorumlu tarafından onaylanmış kısa bakım planı; P2 planlı sprint; P3 periyodik bakım. Bu hedefler operasyon taahhüdü değildir; sorumlu ve tarih atanmalıdır. AI/LLM eklenirse veri minimizasyonu, tenant/kullanıcı izolasyonu, güvenilmeyen metin/prompt ayrımı, araç allowlist'i ve maliyet kotası tasarım incelemesi zorunlu iş paketi olarak açılmalıdır.
