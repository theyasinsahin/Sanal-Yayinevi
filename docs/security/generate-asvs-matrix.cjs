// Input: official OWASP v5.0.0_release JSON, downloaded read-only as .asvs-source.json.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bytes = fs.readFileSync(path.join(__dirname, '.asvs-source.json'));
const source = JSON.parse(bytes);
if (source.Version !== '5.0.0') throw new Error('Only ASVS 5.0.0 is supported.');
const chapters = {
  1: ['Kodlama ve temizleme', 'Kısmi', 'JSX, richText ve literalSearch incelendi; bütün yorumlayıcı bağlamları için tam doğrulama iddiası yok.'],
  2: ['Doğrulama ve iş mantığı', 'Kısmi', 'GraphQL input sınırları ve basım transaction/durum testleri; tüm sosyal işlemlerde atomiklik kanıtlanmadı.'],
  3: ['Tarayıcı güvenliği', 'Kısmi / operasyon', 'API başlıkları ve HTML testli; frontend hosting başlıkları ile Google/Cloudinary ayarları dış kapsam.'],
  4: ['API ve web servisleri', 'Kısmi', 'HTTP/WS bütçe, gövde, origin, kimlik ve batching kontrolleri testli; uç proxy zinciri doğrulanmadı.'],
  5: ['Dosya işleme', 'Kısmi', 'PDF boyut/imza/ACL/attachment ve yükleme hız sınırı; antivirüs/CDR ve Cloudinary hesabı doğrulanmadı.'],
  6: ['Kimlik doğrulama', 'Kısmi', 'Parola/kayıt/kurtarma/Google testleri; MFA ve parola ihlal listesi yok.'],
  7: ['Oturum yönetimi', 'Kısmi', 'JWT yaş sınırı, authVersion, logout ve olayda iptal testli; idle timeout ve cihaz bazlı oturum envanteri yok.'],
  8: ['Yetkilendirme', 'Kısmi', 'Sahiplik, güncel ADMIN/PUBLISHER, nested kitap, özel ileti ve adres testleri; her olası alan birleşimi test edilmedi.'],
  9: ['Bağımsız tokenlar', 'Kısmi', 'HS256 allowlist, imza, nbf/exp/azami yaş, kullanıcı/sürüm kontrolü testli; uygulama JWT iss/aud claimleri yok.'],
  10: ['OAuth ve OIDC', 'Kısmi', 'Yalnız Google GIS istemcisi; SDK imza/audience, sub, email_verified, CSRF ve tarayıcı nonce kontrolü.'],
  11: ['Kriptografi', 'Kısmi / operasyon', 'Node crypto, AES-256-GCM/AAD, SHA-256/HMAC ve bcrypt; anahtar rotasyonu ve kasa henüz doğrulanmadı.'],
  12: ['Güvenli iletişim', 'Manuel doğrulama', 'CDN/TLS, sertifikalar, DB/SMTP ağı, monitoring ve servisler arası ağ yapılandırması denetlenmedi.'],
  13: ['Yapılandırma', 'Kısmi / operasyon', 'Güvenli startup/origin/proxy/introspection varsayılanları; secret rotasyonu ve deployment erişimleri açık.'],
  14: ['Veri koruma', 'Kısmi / operasyon', 'Özel alan/çıktı ve no-store testli; saklama/silme, DB şifreleme, KVKK ve yedek politikası açık.'],
  15: ['Güvenli kod ve mimari', 'Kısmi', 'Lockfile/audit ve sentetik yarış testleri; dağıtık yük, failover, tüm dependency davranışları doğrulanmadı.'],
  16: ['Loglama ve hata yönetimi', 'Kısmi / operasyon', 'Gizli hata/stack maskeleme ve transaction audit; merkezi güvenlik olayı/alarm/log koruma kurulumu açık.'],
  17: ['WebRTC', 'N/A', 'Uygulamada WebRTC, TURN, medya veya signaling işlevi bulunmadı.'],
};
const overrides = {};
function set(ids, status, reason) { ids.split(' ').forEach(id => { overrides['V' + id] = [status, reason]; }); }
set('1.2.5', 'N/A', 'Web isteğinden OS komutu çalıştıran özellik yok; yerel yönetim scriptleri sabit komut/argüman kullanıyor.');
set('1.2.6 1.2.7 1.2.8 1.3.8 1.5.1', 'N/A', 'LDAP, XPath/XML, LaTeX veya JNDI işleme bileşeni bulunmadı.');
set('1.2.10', 'N/A', 'Kullanıcıya CSV/Excel dışa aktarımı bulunmadı; yerel rapor scriptleri ayrı yönetim aracıdır.');
set('1.3.9', 'N/A', 'Memcache çalıştırılmıyor; kullanılmayan eski cache paketi kaldırıldı.');
set('1.4.1 1.4.3', 'N/A', 'Uygulamaya ait pointer/unmanaged bellek kodu yok; native runtime ve bağımlılık güvenliği ayrı kapsamdadır.');
set('1.2.9 1.3.1 4.3.1 4.3.2 9.1.1 9.1.2 9.1.3 9.2.1', 'Kontrol testli', 'İlgili literal arama, HTML, sorgu bütçesi/introspection veya JWT kontrolü güvenlik ve mevcut entegrasyon testleriyle doğrulandı.');
set('3.3.1 3.3.2 3.3.3 3.3.4 3.3.5', 'N/A', 'Betik oturum cookie üretmiyor; JWT Bearer kullanıyor. Google g_csrf_token sağlayıcı cookie kontrolü ayrıca uygulanır.');
set('3.5.5', 'N/A', 'Uygulamaya ait postMessage alıcısı bulunmadı; GIS redirect kullanılır.');
set('4.4.3 4.4.4', 'N/A', 'Ayrı WS tokenı yok; HTTPS girişinde üretilen aynı Bearer oturumu doğrulanır.');
set('5.2.3 5.2.5 5.3.3', 'N/A', 'Sunucu ZIP/arşiv açmıyor veya kullanıcı yolu ile disk çıkartımı yapmıyor.');
set('5.2.4', 'Eksik / kısmi', '20 PDF/saat/kullanıcı sınırı var; toplam depolama/adet kotası ve uzun süreli kota atomikliği yok.');
set('5.2.6', 'Kısmi / operasyon', 'İstemci 40 MP / 12000 piksel ve 8 MB sınırlar; unsigned Cloudinary isteği istemciyi atlayabildiğinden sağlayıcı limiti gerekir.');
set('5.4.3', 'Eksik', 'PDF antivirüs/CDR/karantina servisi yok. PDF imzası ve EOF kontrolü zararsızlık kanıtı değildir.');
set('6.2.4 6.2.11 6.2.12 6.1.2', 'Eksik', 'Yaygın/ihlalli ve Betik bağlamına özgü parola engel listesi bulunmuyor.');
set('6.2.5', 'Eksik', 'Mevcut büyük/küçük harf/rakam/özel karakter koşulları korundu; standardın serbest bileşim yaklaşımına uyumlu değil.');
set('6.2.9', 'Kısmi', '64 ASCII karakter kabul edilir; bcrypt nedeniyle yeni parolalar 72 UTF-8 baytıyla sınırlı, 64 çok baytlı karakter garantisi yok.');
set('6.3.3 6.4.4 7.5.3 8.4.2', 'Eksik', 'MFA ve yüksek riskli yönetici/finans işlemlerinde ek faktör/step-up uygulanmamış; yüksek riskli canlı kullanım ön koşulu.');
set('6.3.8', 'Kısmi', 'Giriş hataları eşitlendi; kayıt çakışması ve SMTP yanıt sürelerinden tam enumeration direnci iddia edilmez.');
set('6.5.2', 'Kontrol testli', 'Yeni kayıt kodları rastgele salt içeren bcrypt cost 10 ile saklanır; gerçek hash/tek kullanım/yarış regresyonu vardır. Eski kodlar en çok 10 dakika uyumlulukla kabul edilir.');
set('6.5.4', 'Kısmi', 'Altı rastgele ondalık basamak kullanılır; standardın tipik altı hane örneğine karşılık gelir. Beş deneme ve hız sınırı vardır; e-posta MFA olarak değerlendirilmez.');
set('6.5.6 6.5.7 6.5.8 6.6.1 6.6.4', 'N/A', 'Fiziksel/biyometrik/TOTP/SMS/PSTN veya MFA push faktörü uygulanmamış. Eksik MFA kontrolü N/A olarak saklanmaz (6.3.3).');
set('6.7.1 6.7.2', 'N/A', 'Betik cihaz/istemci sertifikasıyla challenge tabanlı kimlik doğrulama sunmuyor. Google nonce ayrıca uygulanır.');
set('6.8.3', 'N/A', 'SAML yok.');
set('8.4.1', 'N/A', 'Kurumsal tenant modeli yok; kullanıcı ve yayınevi sahipliği için 8.2/8.3 nesne yetkileri uygulanır.');
set('7.2.3', 'N/A', 'Oturum referans tokenı yerine imzalı JWT kullanılıyor.');
set('7.3.1 7.5.2', 'Eksik', 'Sunucu inactivity timeout ve cihaz/tek oturum yönetim ekranı yok; tüm oturum iptali vardır.');
set('9.2.3 9.2.4', 'Eksik / kapsam kararı', 'Betik JWT için issuer/audience ayırımı eklenmemiş. Anahtarı başka uygulamayla paylaşmayın; sürümlü geçiş tasarlayın.');
set('10.2.1', 'N/A', 'OAuth authorization-code grant kullanılmıyor; GIS ID token redirect ve CSRF/nonce kontrolleri var.');
set('10.2.2', 'N/A', 'Birden fazla authorization server desteği yok.');
for (const c of source.Requirements.filter(c => c.Ordinal === 10)) for (const s of c.Items) {
  if (['V10.3', 'V10.4', 'V10.6', 'V10.7'].includes(s.Shortcode)) for (const r of s.Items) overrides[r.Shortcode] = ['N/A', 'Betik OAuth yetkilendirme/resource server veya OpenID Provider değildir; Google servisinin iç kontrolleri denetlenmedi.'];
}
set('10.5.5', 'N/A', 'OIDC back-channel logout yok; Betik logout authVersion iptali yapar.');
set('11.3.5', 'N/A', 'Ayrı encrypt/MAC bileşimi yerine AES-GCM bütünleşik doğrulamalı şifreleme kullanılır.');
set('11.4.4', 'N/A', 'Şifreleme anahtarı kullanıcı parolasından türetilmiyor; rastgele deployment anahtarıdır.');
set('12.1.3', 'N/A', 'Uygulamaya ait mTLS istemci sertifikası kimlik doğrulaması yok.');
set('13.3.1 13.3.2 13.3.4', 'Eksik / operasyon', '.env takipten çıkarıldı ve yerel dosya korundu; eski Git erişimi nedeniyle anahtar rotasyonu/kasa/erişim politikası hâlâ gerekir.');
set('16.3.1 16.3.2 16.4.3', 'Eksik / operasyon', 'Tüm kimlik/erişim olaylarının merkezi, korelasyonlu ve ayrı sistemde korunmuş kaydı kurulmadı. Mali/admin audit bunun tamamı değildir.');
set('16.5.1', 'Kontrol testli', 'Üretimde bilinmeyen hata ve stacktrace gizlenir; HTTP parse hatası JSON döner.');

const rows = [];
for (const c of source.Requirements) for (const s of c.Items) for (const r of s.Items) {
  const [, defaultStatus, defaultReason] = chapters[c.Ordinal];
  const [status, reason] = overrides[r.Shortcode] || [defaultStatus, defaultReason];
  rows.push({ id: r.Shortcode, level: r.L, chapter: c.Ordinal, status, reason });
}
let markdown = '# ASVS 5.0.0 gereksinim uygulanabilirlik matrisi\n\n';
markdown += 'Tarih: 1 Kasım 2026. Resmî sabit kaynak: [OWASP v5.0.0_release JSON](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0_release/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json). Kaynak SHA-256: `' + crypto.createHash('sha256').update(bytes).digest('hex') + '`.\n\n';
markdown += `${rows.length} gereksinim tek tek listelenir; L1 ve L2 hedef kapsamdır, L3 yüksek risk için ek değerlendirmedir. Tablodaki gerekçeler proje değerlendirmesidir; standart metninin çevirisi değildir. **ASVS L2 uyumluluk veya sertifikasyon iddiası yoktur.**\n\n`;
markdown += '`Kontrol testli`: belirli kontrolün regresyon kanıtı vardır. `Kısmi`: bazı kanıtlar mevcut, madde bütünü doğrulanmadı. `Eksik`: uygulanabilir kontrol karşılanmıyor. `Manuel doğrulama`: altyapı kanıtı yok. `N/A`: mekanizma bulunmadığı için uygulanmaz; özellik eklenince yeniden değerlendirilir. Eksik bir zorunlu kontrol, özelliğin yokluğu gerekçesiyle N/A sayılmaz.\n\n';
markdown += 'Kanıt kaynakları: [denetim](SECURITY_AUDIT_TR.md), [testler](SECURITY_TEST_RESULTS_TR.md), [operasyon](SECURITY_OPERATIONS_TR.md), `Server/tests/security*.test.js`, authentication, adminManagement, printFunding, iyzicoFunding, chapterVisibility, quotePrivacy, publisherPortal testleri. Her satır için ayrı test koşulduğu iddia edilmez.\n';
for (const c of source.Requirements) {
  markdown += `\n## V${c.Ordinal}: ${chapters[c.Ordinal][0]}\n\n| Gereksinim | Seviye | Durum | Betik için gerekçe / sınır |\n| --- | --- | --- | --- |\n`;
  for (const row of rows.filter(row => row.chapter === c.Ordinal)) markdown += `| ${row.id} | L${row.level} | ${row.status} | ${row.reason} |\n`;
}
fs.writeFileSync(path.join(__dirname, 'ASVS_5_0_0_MATRIX_TR.md'), markdown);
console.log(JSON.stringify({ requirements: rows.length, na: rows.filter(row => row.status === 'N/A').length, individuallyTestedControls: rows.filter(row => row.status === 'Kontrol testli').length }));
