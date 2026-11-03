# ASVS 5.0.0 gereksinim uygulanabilirlik matrisi

Tarih: 1 Kasım 2026. Resmî sabit kaynak: [OWASP v5.0.0_release JSON](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0_release/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json). Kaynak SHA-256: `bcdbec214d70abcfad9284a31d4f9e5134305831d628aad3aa85d7e26626cb35`.

345 gereksinim tek tek listelenir; L1 ve L2 hedef kapsamdır, L3 yüksek risk için ek değerlendirmedir. Tablodaki gerekçeler proje değerlendirmesidir; standart metninin çevirisi değildir. **ASVS L2 uyumluluk veya sertifikasyon iddiası yoktur.**

`Kontrol testli`: belirli kontrolün regresyon kanıtı vardır. `Kısmi`: bazı kanıtlar mevcut, madde bütünü doğrulanmadı. `Eksik`: uygulanabilir kontrol karşılanmıyor. `Manuel doğrulama`: altyapı kanıtı yok. `N/A`: mekanizma bulunmadığı için uygulanmaz; özellik eklenince yeniden değerlendirilir. Eksik bir zorunlu kontrol, özelliğin yokluğu gerekçesiyle N/A sayılmaz.

Kanıt kaynakları: [denetim](SECURITY_AUDIT_TR.md), [testler](SECURITY_TEST_RESULTS_TR.md), [operasyon](SECURITY_OPERATIONS_TR.md), `Server/tests/security*.test.js`, authentication, adminManagement, printFunding, iyzicoFunding, chapterVisibility, quotePrivacy, publisherPortal testleri. Her satır için ayrı test koşulduğu iddia edilmez.

## V1: Kodlama ve temizleme

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V1.1.1 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.1.2 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.2.1 | L1 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.2.2 | L1 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.2.3 | L1 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.2.4 | L1 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.2.5 | L1 | N/A | Web isteğinden OS komutu çalıştıran özellik yok; yerel yönetim scriptleri sabit komut/argüman kullanıyor. |
| V1.2.6 | L2 | N/A | LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı. |
| V1.2.7 | L2 | N/A | LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı. |
| V1.2.8 | L2 | N/A | LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı. |
| V1.2.9 | L2 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V1.2.10 | L3 | N/A | Kullanıcıya CSV/Excel dışa aktarımı bulunmadı; yerel rapor scriptleri ayrı yönetim aracıdır. |
| V1.3.1 | L1 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V1.3.2 | L1 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.3 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.4 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.5 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.6 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.7 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.8 | L2 | N/A | LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı. |
| V1.3.9 | L2 | N/A | Memcache çalıştırılmıyor; kullanılmayan eski cache paketi kaldırıldı. |
| V1.3.10 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.11 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.3.12 | L3 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.4.1 | L2 | N/A | Uygulamaya ait pointer/unmanaged bellek kodu yok; native runtime ve bağımlılık güvenliği ayrı kapsamdadır. |
| V1.4.2 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.4.3 | L2 | N/A | Uygulamaya ait pointer/unmanaged bellek kodu yok; native runtime ve bağımlılık güvenliği ayrı kapsamdadır. |
| V1.5.1 | L1 | N/A | LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı. |
| V1.5.2 | L2 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |
| V1.5.3 | L3 | Kısmi | JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok. |

## V2: Doğrulama ve iş mantığı

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V2.1.1 | L1 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.1.2 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.1.3 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.2.1 | L1 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.2.2 | L1 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.2.3 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.3.1 | L1 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.3.2 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.3.3 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.3.4 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.3.5 | L3 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.4.1 | L2 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |
| V2.4.2 | L3 | Kısmi | GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı. |

## V3: Tarayıcı güvenliği

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V3.1.1 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.2.1 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.2.2 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.2.3 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.3.1 | L1 | N/A | Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır. |
| V3.3.2 | L2 | N/A | Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır. |
| V3.3.3 | L2 | N/A | Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır. |
| V3.3.4 | L2 | N/A | Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır. |
| V3.3.5 | L3 | N/A | Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır. |
| V3.4.1 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.2 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.3 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.4 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.5 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.6 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.7 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.4.8 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.1 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.2 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.3 | L1 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.4 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.5 | L2 | N/A | Uygulamaya ait postMessage alıcısı bulunmadı; GIS redirect kullanılır. |
| V3.5.6 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.7 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.5.8 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.6.1 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.7.1 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.7.2 | L2 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.7.3 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.7.4 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |
| V3.7.5 | L3 | Kısmi / operasyon | API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam. |

## V4: API ve web servisleri

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V4.1.1 | L1 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.1.2 | L2 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.1.3 | L2 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.1.4 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.1.5 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.2.1 | L2 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.2.2 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.2.3 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.2.4 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.2.5 | L3 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.3.1 | L2 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V4.3.2 | L2 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V4.4.1 | L1 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.4.2 | L2 | Kısmi | HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı. |
| V4.4.3 | L2 | N/A | Ayrı WS tokenı yok; HTTPS girişinde üretilen aynı Bearer oturumu doğrulanır. |
| V4.4.4 | L2 | N/A | Ayrı WS tokenı yok; HTTPS girişinde üretilen aynı Bearer oturumu doğrulanır. |

## V5: Dosya işleme

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V5.1.1 | L2 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.2.1 | L1 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.2.2 | L1 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.2.3 | L2 | N/A | Sunucu ZIP/arşiv açmıyor veya kullanıcı yolu ile disk çıkartımı yapmıyor. |
| V5.2.4 | L3 | Eksik / kısmi | 20 PDF/saat/kullanıcı sınırı var; toplam depolama/adet kotası ve uzun süreli kota atomikliği yok. |
| V5.2.5 | L3 | N/A | Sunucu ZIP/arşiv açmıyor veya kullanıcı yolu ile disk çıkartımı yapmıyor. |
| V5.2.6 | L3 | Kısmi / operasyon | İstemci 40 MP / 12000 piksel ve 8 MB sınırlar; unsigned Cloudinary isteği istemciyi atlayabildiğinden sağlayıcı limiti gerekir. |
| V5.3.1 | L1 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.3.2 | L1 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.3.3 | L3 | N/A | Sunucu ZIP/arşiv açmıyor veya kullanıcı yolu ile disk çıkartımı yapmıyor. |
| V5.4.1 | L2 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.4.2 | L2 | Kısmi | PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı. |
| V5.4.3 | L2 | Eksik | PDF antivirüs/CDR/karantina servisi yok. PDF imzası ve EOF kontrolü zararsızlık kanıtı değildir. |

## V6: Kimlik doğrulama

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V6.1.1 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.1.2 | L2 | Eksik | Yaygın/ihlalli ve Betik bağlamına özgü parola engel listesi bulunmuyor. |
| V6.1.3 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.1 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.2 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.3 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.4 | L1 | Eksik | Yaygın/ihlalli ve Betik bağlamına özgü parola engel listesi bulunmuyor. |
| V6.2.5 | L1 | Eksik | Mevcut büyük/küçük harf/rakam/özel karakter koşulları korundu; standardın serbest bileşim yaklaşımına uyumlu değil. |
| V6.2.6 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.7 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.8 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.9 | L2 | Kısmi | 64 ASCII karakter kabul edilir; bcrypt nedeniyle yeni parolalar 72 UTF-8 baytıyla sınırlı, 64 çok baytlı karakter garantisi yok. |
| V6.2.10 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.2.11 | L2 | Eksik | Yaygın/ihlalli ve Betik bağlamına özgü parola engel listesi bulunmuyor. |
| V6.2.12 | L2 | Eksik | Yaygın/ihlalli ve Betik bağlamına özgü parola engel listesi bulunmuyor. |
| V6.3.1 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.2 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.3 | L2 | Eksik | MFA ve yüksek riskli yönetici/finans işlemlerinde ek faktör/step-up uygulanmamış; yüksek riskli canlı kullanım ön koşulu. |
| V6.3.4 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.5 | L3 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.6 | L3 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.7 | L3 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.3.8 | L3 | Kısmi | Giriş hataları eşitlendi; kayıt çakışması ve SMTP yanıt sürelerinden tam enumeration direnci iddia edilmez. |
| V6.4.1 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.4.2 | L1 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.4.3 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.4.4 | L2 | Eksik | MFA ve yüksek riskli yönetici/finans işlemlerinde ek faktör/step-up uygulanmamış; yüksek riskli canlı kullanım ön koşulu. |
| V6.4.5 | L3 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.4.6 | L3 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.5.1 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.5.2 | L2 | Kontrol testli | Yeni kayıt kodları rastgele salt içeren bcrypt cost 10 ile saklanır; gerçek hash/tek kullanım/yarış regresyonu vardır. Eski kodlar en çok 10 dakika uyumlulukla kabul edilir. |
| V6.5.3 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.5.4 | L2 | Kısmi | Altı rastgele ondalık basamak kullanılır; standardın tipik altı hane örneğine karşılık gelir. Beş deneme ve hız sınırı vardır; e-posta MFA olarak değerlendirilmez. |
| V6.5.5 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.5.6 | L3 | N/A | Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3). |
| V6.5.7 | L3 | N/A | Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3). |
| V6.5.8 | L3 | N/A | Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3). |
| V6.6.1 | L2 | N/A | Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3). |
| V6.6.2 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.6.3 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.6.4 | L3 | N/A | Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3). |
| V6.7.1 | L3 | N/A | Betik cihaz/istemci sertifikasıyla challenge tabanlı kimlik doğrulama sunmuyor. Google nonce ayrıca uygulanır. |
| V6.7.2 | L3 | N/A | Betik cihaz/istemci sertifikasıyla challenge tabanlı kimlik doğrulama sunmuyor. Google nonce ayrıca uygulanır. |
| V6.8.1 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.8.2 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |
| V6.8.3 | L2 | N/A | SAML yok. |
| V6.8.4 | L2 | Kısmi | Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok. |

## V7: Oturum yönetimi

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V7.1.1 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.1.2 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.1.3 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.2.1 | L1 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.2.2 | L1 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.2.3 | L1 | N/A | Oturum referans tokenı yerine imzalı JWT kullanılıyor. |
| V7.2.4 | L1 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.3.1 | L2 | Eksik | Sunucu inactivity timeout ve cihaz/tek oturum yönetim ekranı yok; tüm oturum iptali vardır. |
| V7.3.2 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.4.1 | L1 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.4.2 | L1 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.4.3 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.4.4 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.4.5 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.5.1 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.5.2 | L2 | Eksik | Sunucu inactivity timeout ve cihaz/tek oturum yönetim ekranı yok; tüm oturum iptali vardır. |
| V7.5.3 | L3 | Eksik | MFA ve yüksek riskli yönetici/finans işlemlerinde ek faktör/step-up uygulanmamış; yüksek riskli canlı kullanım ön koşulu. |
| V7.6.1 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |
| V7.6.2 | L2 | Kısmi | JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok. |

## V8: Yetkilendirme

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V8.1.1 | L1 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.1.2 | L2 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.1.3 | L3 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.1.4 | L3 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.2.1 | L1 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.2.2 | L1 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.2.3 | L2 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.2.4 | L3 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.3.1 | L1 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.3.2 | L3 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.3.3 | L3 | Kısmi | Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi. |
| V8.4.1 | L2 | N/A | Kurumsal tenant modeli yok; kullanıcı ve yayınevi sahipliği için 8.2/8.3 nesne yetkileri uygulanır. |
| V8.4.2 | L3 | Eksik | MFA ve yüksek riskli yönetici/finans işlemlerinde ek faktör/step-up uygulanmamış; yüksek riskli canlı kullanım ön koşulu. |

## V9: Bağımsız tokenlar

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V9.1.1 | L1 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V9.1.2 | L1 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V9.1.3 | L1 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V9.2.1 | L1 | Kontrol testli | İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı. |
| V9.2.2 | L2 | Kısmi | HS256 allowlist, imza, nbf/exp/azami yaş, kullanıcı/sürüm kontrolü testli; uygulama JWT iss/aud claimleri yok. |
| V9.2.3 | L2 | Eksik / kapsam kararı | Betik JWT için issuer/audience ayırımı eklenmemiş. Anahtarı başka uygulamayla paylaşmayın; sürümlü geçiş tasarlayın. |
| V9.2.4 | L2 | Eksik / kapsam kararı | Betik JWT için issuer/audience ayırımı eklenmemiş. Anahtarı başka uygulamayla paylaşmayın; sürümlü geçiş tasarlayın. |

## V10: OAuth ve OIDC

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V10.1.1 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.1.2 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.2.1 | L2 | N/A | OAuth authorization-code grant kullanılmıyor; GIS ID token redirect ve CSRF/nonce kontrolleri var. |
| V10.2.2 | L2 | N/A | Birden fazla authorization server desteği yok. |
| V10.2.3 | L3 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.3.1 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.3.2 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.3.3 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.3.4 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.3.5 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.1 | L1 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.2 | L1 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.3 | L1 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.4 | L1 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.5 | L1 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.6 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.7 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.8 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.9 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.10 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.11 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.12 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.13 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.14 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.15 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.4.16 | L3 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.5.1 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.5.2 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.5.3 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.5.4 | L2 | Kısmi | Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü. |
| V10.5.5 | L2 | N/A | OIDC back-channel logout yok; Betik logout authVersion iptali yapar. |
| V10.6.1 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.6.2 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.7.1 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.7.2 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |
| V10.7.3 | L2 | N/A | Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi. |

## V11: Kriptografi

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V11.1.1 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.1.2 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.1.3 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.1.4 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.2.1 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.2.2 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.2.3 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.2.4 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.2.5 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.3.1 | L1 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.3.2 | L1 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.3.3 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.3.4 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.3.5 | L3 | N/A | Ayrı encrypt/MAC bileşimi yerine AES-GCM bütünleşik doğrulamalı şifreleme kullanılır. |
| V11.4.1 | L1 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.4.2 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.4.3 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.4.4 | L2 | N/A | Şifreleme anahtarı kullanıcı parolasından türetilmiyor; rastgele deployment anahtarıdır. |
| V11.5.1 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.5.2 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.6.1 | L2 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.6.2 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.7.1 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |
| V11.7.2 | L3 | Kısmi / operasyon | Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı. |

## V12: Güvenli iletişim

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V12.1.1 | L1 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.1.2 | L2 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.1.3 | L2 | N/A | Uygulamaya ait mTLS istemci sertifikası kimlik doğrulaması yok. |
| V12.1.4 | L3 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.1.5 | L3 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.2.1 | L1 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.2.2 | L1 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.3.1 | L2 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.3.2 | L2 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.3.3 | L2 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.3.4 | L2 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |
| V12.3.5 | L3 | Manuel doğrulama | CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi. |

## V13: Yapılandırma

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V13.1.1 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.1.2 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.1.3 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.1.4 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.1 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.2 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.3 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.4 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.5 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.2.6 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.3.1 | L2 | Eksik / operasyon | .env takipten çıkarıldı ve yerel dosya korundu; eski Git erişimi nedeniyle anahtar rotasyonu/kasa/erişim politikası hâlâ gerekir. |
| V13.3.2 | L2 | Eksik / operasyon | .env takipten çıkarıldı ve yerel dosya korundu; eski Git erişimi nedeniyle anahtar rotasyonu/kasa/erişim politikası hâlâ gerekir. |
| V13.3.3 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.3.4 | L3 | Eksik / operasyon | .env takipten çıkarıldı ve yerel dosya korundu; eski Git erişimi nedeniyle anahtar rotasyonu/kasa/erişim politikası hâlâ gerekir. |
| V13.4.1 | L1 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.2 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.3 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.4 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.5 | L2 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.6 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |
| V13.4.7 | L3 | Kısmi / operasyon | Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık. |

## V14: Veri koruma

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V14.1.1 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.1.2 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.1 | L1 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.2 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.3 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.4 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.5 | L3 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.6 | L3 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.7 | L3 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.2.8 | L3 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.3.1 | L1 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.3.2 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |
| V14.3.3 | L2 | Kısmi / operasyon | Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık. |

## V15: Güvenli kod ve mimari

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V15.1.1 | L1 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.1.2 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.1.3 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.1.4 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.1.5 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.2.1 | L1 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.2.2 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.2.3 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.2.4 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.2.5 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.1 | L1 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.2 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.3 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.4 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.5 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.6 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.3.7 | L2 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.4.1 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.4.2 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.4.3 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |
| V15.4.4 | L3 | Kısmi | Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı. |

## V16: Loglama ve hata yönetimi

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V16.1.1 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.2.1 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.2.2 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.2.3 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.2.4 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.2.5 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.3.1 | L2 | Eksik / operasyon | Tüm kimlik/erişim olaylarının merkezi, korelasyonlu ve ayrı sistemde korunmuş kaydı kurulmadı. Mali/admin audit bunun tamamı değildir. |
| V16.3.2 | L2 | Eksik / operasyon | Tüm kimlik/erişim olaylarının merkezi, korelasyonlu ve ayrı sistemde korunmuş kaydı kurulmadı. Mali/admin audit bunun tamamı değildir. |
| V16.3.3 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.3.4 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.4.1 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.4.2 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.4.3 | L2 | Eksik / operasyon | Tüm kimlik/erişim olaylarının merkezi, korelasyonlu ve ayrı sistemde korunmuş kaydı kurulmadı. Mali/admin audit bunun tamamı değildir. |
| V16.5.1 | L2 | Kontrol testli | Üretimde bilinmeyen hata ve stacktrace gizlenir; HTTP parse hatası JSON döner. |
| V16.5.2 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.5.3 | L2 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |
| V16.5.4 | L3 | Kısmi / operasyon | Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık. |

## V17: WebRTC

| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |
| --- | --- | --- | --- |
| V17.1.1 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.1.2 | L3 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.1 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.2 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.3 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.4 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.5 | L3 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.6 | L3 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.7 | L3 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.2.8 | L3 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.3.1 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
| V17.3.2 | L2 | N/A | Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı. |
