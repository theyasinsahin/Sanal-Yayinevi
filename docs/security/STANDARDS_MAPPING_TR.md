# Standart eşlemesi

Tarih: 1 Kasım 2026. Bu eşleme kontrol kapsamını gösterir; uyumluluk belgesi değildir. [ASVS matrisi](ASVS_5_0_0_MATRIX_TR.md) 345 gereksinimin tümünü, L1/L2/L3 ve N/A gerekçelerini içerir.

## OWASP Top 10:2025

| Başlık | Betik değerlendirmesi |
| --- | --- |
| A01 Erişim kontrolü | Uygulanır: PRIVATE/WS, taslak/nested kitap, alıntı, admin/publisher, özel adres ve PDF ACL; SEC-003/008/009/010 |
| A02 Güvenlik yapılandırması | Uygulanır: proxy/origin/header/introspection ve environment; altyapı doğrulaması açık |
| A03 Yazılım tedarik zinciri | Uygulanır: npm audit, lockfile/integrity, kullanılmayan bağımlılık, install scripti ve eksik CI politikası |
| A04 Kriptografi | Uygulanır: JWT, bcrypt, CSPRNG, AES-GCM/AAD ve anahtar yaşam döngüsü; rotasyon açık |
| A05 Enjeksiyon | Uygulanır: HTML/XSS, literal regex ve typed GraphQL/JSON allowlist. SQL/LDAP/LaTeX/XML/OS komutu özellikleri bulunmadı |
| A06 Güvensiz tasarım | Uygulanır: yayın/başvuru/kampanya ayrımı, mali onay, Kota ve MFA/step-up eksikleri |
| A07 Kimlik doğrulama | Uygulanır: kayıt/kurtarma/Google/JWT/revocation; SEC-004/005/006/008 |
| A08 Yazılım/veri bütünlüğü | Uygulanır: sağlayıcı imzası, immutable snapshot/ledger, dosya hash'i ve registry bütünlüğü |
| A09 Loglama/uyarı | Uygulanır: finans/admin audit var; merkezi kimlik/erişim olayı ve alarm altyapısı eksik |
| A10 İstisnai koşullar | Uygulanır: genel hata, fail closed, provider yanıt kaybı, retry, transaction rollback ve replay testleri |

Kaynak: [OWASP Top 10:2025](https://top10.owasp.org/2025/).

## OWASP API Top 10:2023

| Kategori | Uygulanabilirlik ve kanıt |
| --- | --- |
| API1 BOLA | Uygulanır; kitap, bölüm, özel alıntı, mesaj, PDF, ödeme/adres sahiplik testleri |
| API2 Authentication | Uygulanır; JWT/Google/kurtarma ve deneme sınırları; MFA eksik |
| API3 Property authorization | Uygulanır; özel kullanıcı/finans alanları, admin JSON allowlist ve nested Book koruması |
| API4 Resource consumption | Uygulanır; sorgu/alias/fragment/input/payload, kalıcı kota ve sınırlı sayfalama; gerçek dağıtık yük açık |
| API5 Function authorization | Uygulanır; güncel DB ADMIN/PUBLISHER ve finans/yönetim resolver kontrolleri |
| API6 Sensitive flows | Uygulanır; kayıt/e-posta, etkileşim, checkout ve mali state/tekrar işleme |
| API7 SSRF | Dış sağlayıcı/SMTP URL yapılandırması için uygulanır; kullanıcıya keyfi sunucu URL fetch/proxy özelliği bulunmadı. Ağ egress allowlist'i manuel |
| API8 Misconfiguration | Uygulanır; HTTP/WS origin, proxy, header, debug/introspection, secret ve TLS sınırı |
| API9 Inventory | Uygulanır; REST/GraphQL/WS ve legacy callback kapsamı belgelendi; hosting varlık envanteri manuel |
| API10 External APIs | Uygulanır; Google SDK claimleri ve iyzico imza/tutar/referans doğrulaması; gerçek sağlayıcı sözleşme denemesi yapılmadı |

Kaynak: [OWASP API Security 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/).

## NIST SSDF 1.1 pratikleri

Bütün pratikler yazılım yaşam döngüsü bakımından uygulanabilirdir. Aşağıdaki durumlar organizasyonel denetimin yerine geçmez; alt görevlerin tamamı için uyumluluk iddiası yoktur.

| Pratik | Yerel çalışma / açık alan |
| --- | --- |
| PO.1 Güvenlik gereksinimleri | Tehdit modeli, kabul sınırları ve ASVS matrisi; kuruluş politikası onayı açık |
| PO.2 Rol ve sorumluluk | Admin/author/publisher ayrımı; operasyon ve olay sorumlularının atanması gerekli |
| PO.3 Araç zinciri | npm/Jest/ESLint/derleme ve sınırlı secret scan; yönetilen CI/SAST eksik |
| PO.4 Kontrol kriterleri | Önce/sonra regresyon, bulgu/test/operasyon dosyaları; release kapısı manuel |
| PO.5 Güvenli ortam | Sentetik geçici replica set ve kapalı dış servisler; production/staging izolasyonu kuruluşta doğrulanmalı |
| PS.1 Kod koruması | Secret takibi kaldırıldı; geçmiş erişim ve branch protection/secret manager açık |
| PS.2 Sürüm bütünlüğü | Lockfile resolved/integrity kontrolü; imzalı release/SBOM doğrulaması kurulu değil |
| PS.3 Sürüm arşivi | Yerel raporlar var; erişim kontrollü artefakt ve provenance politikası manuel |
| PW.1 Güvenli tasarım | STRIDE, güven sınırları, yayın/finans durum modeli |
| PW.2 Tasarım incelemesi | Kaynak ve iş mantığı gözden geçirildi; bağımsız ikinci denetçi değerlendirmesi yok |
| PW.4 Bileşen seçimi | Uygun güvenlik kitaplıkları ve audit yamaları; kalan eski araçlar açık |
| PW.5 Güvenli kod | Sunucu enforcement, input/output, atomic reset, rate/ACL ve güvenli hata |
| PW.6 Derleme ayarları | Üretim frontend build ve Node sürüm gereksinimi; prod artefakt güvenliği manuel |
| PW.7 Kod analizi | Odaklı manuel kaynak/kalıp taraması ve lint; tam SAST yürütülmedi |
| PW.8 Çalıştırılabilir test | Sentetik DB, HTTP/WS ve concurrency regresyonları; gerçek cihaz/sağlayıcı/yük açık |
| PW.9 Güvenli varsayılanlar | Proxy güveni kapalı, üretim introspection kapalı, sınır ve no-store; hosting ayarları manuel |
| RV.1 Açık tespiti | Paket audit ve yeniden üretilebilir regresyon; düzenli tarama programı atanmalı |
| RV.2 Risk ve düzeltme | P0–P3 planı, kod değişiklikleri, açık iş listesi ve release koşulları |
| RV.3 Kök neden | Ortak erişim/kota/temizlik/hata katmanları; tekrar eden alanları azaltma, uzun vadeli platform geçişi |

Kaynak: [NIST SP 800-218 / SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final).

## Cheat Sheet ve özel kapsam

GraphQL kılavuzu sorgu maliyeti ve resolver erişimi; Authentication/Authorization kılavuzları hesap ve nesne yaşam döngüsü; File Upload kılavuzu byte/tip/ACL/karantina; Transaction Authorization ilkeleri sunucu mali niyeti, tutar ve durum doğrulaması için kullanıldı. Webhook incelemesi mevcut sağlayıcının gerçek imza protokolü, raw byte doğrulaması, zaman penceresi, referans/tutar eşleşmesi ve idempotency üzerindedir. Her rehberdeki her tavsiyenin tamamlandığı iddia edilmez; PDF AV, MFA, WAF ve dağıtık operasyon açık alanlardır.

AI/LLM, WebRTC, ZIP açma, SQL, LDAP, XPath, LaTeX, JNDI ve CSV kullanıcı export'u bulunmadı. İşlev eklenirse ilgili N/A kararları yeniden ele alınmalıdır. Android kaynakları/paketleri incelendi; native MASVS/cihaz penetrasyon testi yapılmadı.
