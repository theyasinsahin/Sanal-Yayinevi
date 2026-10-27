# 🪶 Betik - Sanal Yayınevi ve Kitle Fonlama Platformu

Betik, yazarların kitaplarını dijital ortamda yazıp yayınlayabildiği, okurların ise bu kitapları okuyup beğendikleri eserlerin basılması için maddi destekte bulunabildiği (Crowdfunding) modern bir platformdur.

![Project Status](https://img.shields.io/badge/Status-Development-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🚀 Proje Hakkında

Yazarlar eserlerini dijital olarak yayımlayabilir; tamamlanan eserler için ayrı basım başvurusu hazırlayabilir. Sabit içerik sürümü, yönetici incelemesi ve maliyet onayından sonra destek kampanyası açılır.

**Ödeme durumu:** Canlı tahsilat kapalıdır. Eski iyzico başlatma/callback akışı devre dışıdır. Yeni karşılıksız destek, ön sipariş, rezervasyon ve iade akışı yalnızca açıkça etkinleştirilen geliştirme/test sandbox sağlayıcısıyla çalışır. Eski kitaplar ve ödeme geçmişi korunur. Kurulum, durum geçişleri, migration ve canlıya geçiş eksikleri: [Basım ve destek sistemi](docs/print-funding.md).

### Öne Çıkan Özellikler

- **🎨 Füturistik UI/UX:** Glassmorphism tasarım dili, yumuşak gradyanlar ve modern animasyonlar.
- **🔄 Ayrı yaşam döngüleri:** Dijital yayın, yazım tamamlanması, başvuru, kampanya, üretim ve sipariş.
- **💰 Destek ve ön sipariş:** Sandbox ödeme, kuruş hesabı, atomik rezervasyon, tekil muhasebe, uzlaştırma ve tam iade.
- **📖 Gelişmiş Okuma Modu:** Gerçekçi sayfa çevirme efekti ve odaklanmış okuma deneyimi.
- **🛡️ Yönetim Paneli (SaaS Dashboard):** Kullanıcı, içerik ve finansal işlemlerin yönetildiği, grafiklerle desteklenen admin paneli.

---

## 🛠️ Teknolojiler (Tech Stack)

### Frontend

- **Core:** React.js (Hooks, Context API)
- **Data Fetching:** Apollo Client (GraphQL)
- **Styling:** Pure CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism)
- **Routing:** React Router DOM v6
- **Icons:** Material UI Icons

### Backend

- **Runtime:** Node.js & Express
- **API:** GraphQL (Apollo Server)
- **Database:** MongoDB & Mongoose ORM
- **Auth:** JWT (JSON Web Tokens)
- **Payment:** Sağlayıcı arayüzü + kalıcı sandbox; canlı sağlayıcı adaptörü kapalı/uygulanmamış.
- **Media:** Cloudinary (Görsel optimizasyonu için)

---

## 🏗️ Veritabanı Mimarisi

Mevcut ana koleksiyonlar korunur:

1.  **Users:** Kullanıcı rolleri (`ADMIN`, `USER`), kayıtlı kitaplar, takipçiler.
2.  **Books:** `digitalStatus` ve `writingStatus` ayrıdır. Eski `status`, `printConfig`, `fundingTarget` ve `currentFunding` alanları geçmiş/uyumluluk için korunur; yeni finansın kaynağı değildir.
3.  **Transactions:** Geçmiş TL cinsinden ödeme kayıtları; yeni sandbox muhasebesine otomatik aktarılmaz.
4.  **Chapters & Comments:** Kitap içeriği ve etkileşimler.

Yeni basım koleksiyonları `Server/src/models/printFunding.js` içindedir: içerik sürümleri, özel PDF dosyaları, başvurular, tarifeler, kampanyalar, kuruş cinsinden ödeme/rezervasyon/ledger/iade, şifreli adresli ön sipariş, basım ilgisi, güncellemeler ve bildirim outbox'ı. Ayrıntılı alan/index/API açıklamaları [teknik dokümanda](docs/print-funding.md).

---

## ⚙️ Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

- Node.js 22 (bu geliştirmede test edilen sürüm: 22.14.0)
- MongoDB replica set veya mongos; tek düğümlü standalone finansal transaction desteklemez.

### Kurulum

```powershell
npm.cmd --prefix Server ci
npm.cmd --prefix Client ci
```

Backend için `Server/.env` içinde ayrı test ortamına ait `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL` ve mevcut medya/e-posta ayarlarını yapılandırın. Canlı ödeme anahtarı eklemeyin. Basım sandbox ayarları için [Server/.env.print.example](Server/.env.print.example) ve [kurulum kılavuzunu](docs/print-funding.md) izleyin. Gerçek üretim veritabanında migration veya veri sıfırlama çalıştırmayın.

İki ayrı terminalde:

```powershell
npm.cmd --prefix Server start
```

```powershell
npm.cmd --prefix Client start
```

Testler: [test kılavuzu](docs/testing.md). Basım sisteminin doğrulama sonuçları ve canlı kullanım eksikleri: [sonuç raporu](docs/print-funding-report.md).

Betik © 2026 - Tüm Hakları Saklıdır.
