# 🪶 Quill - Sanal Yayınevi ve Kitle Fonlama Platformu

Quill, yazarların kitaplarını dijital ortamda yazıp yayınlayabildiği, okurların ise bu kitapları okuyup beğendikleri eserlerin basılması için maddi destekte bulunabildiği (Crowdfunding) modern bir platformdur.

![Project Status](https://img.shields.io/badge/Status-Development-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🚀 Proje Hakkında

Bu proje, geleneksel yayıncılık zorluklarını aşmak amacıyla geliştirilmiştir. Yazarlar, eserlerini parçalar halinde (Chapter) yayınlayabilir, topluluk oluşturabilir ve kitap tamamlandığında "Baskı Maliyeti Hesaplayıcı" ile hedef bir fon tutarı belirleyerek okurlarından destek toplayabilirler.

### Öne Çıkan Özellikler

- **🎨 Füturistik UI/UX:** Glassmorphism tasarım dili, yumuşak gradyanlar ve modern animasyonlar.
- **🔄 Kitap Yaşam Döngüsü:** Taslak -> Yazılıyor -> Tamamlandı -> Fonlanıyor -> Basıldı döngüsü.
- **💰 Kitle Fonlama (Crowdfunding):** Iyzico entegrasyonu ile güvenli ödeme ve ilerleme çubuğu (Progress Bar) takibi.
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
- **Payment:** Iyzico API
- **Media:** Cloudinary (Görsel optimizasyonu için)

---

## 🏗️ Veritabanı Mimarisi

Proje 4 ana koleksiyon üzerine kuruludur:

1.  **Users:** Kullanıcı rolleri (`ADMIN`, `USER`), kayıtlı kitaplar, takipçiler.
2.  **Books:** \* `status`: Kitabın görünürlüğünü yönetir (`DRAFT`, `WRITING`, `COMPLETED`, `FUNDING`, `PUBLISHED`).
    - `printConfig`: Kağıt türü, boyut vb. baskı detayları.
    - `finance`: Hedeflenen ve toplanan fon miktarı.
3.  **Transactions:** Ödeme geçmişi, tutar, durum (`SUCCESS`, `FAILURE`) ve ilişkili kitap/kullanıcı.
4.  **Chapters & Comments:** Kitap içeriği ve etkileşimler.

---

## ⚙️ Kurulum ve Çalıştırma

Projeyi yerel ortamınızda çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

- Node.js (v14 veya üzeri)
- MongoDB (Yerel veya Atlas URI)

### 1. Repoyu Klonlayın

```bash
git clone [https://github.com/username/quill-project.git](https://github.com/username/quill-project.git)
cd quill-project
2. Backend Kurulumu
Bash
cd Server
npm install
# .env dosyasını oluşturun ve gerekli değişkenleri girin (Aşağıda listelenmiştir)
npm start
3. Frontend Kurulumu
Bash
cd Client
npm install
npm start
🔐 Çevresel Değişkenler (.env)
Backend klasöründe .env dosyası oluşturup şu değerleri girmelisiniz:

Kod snippet'i
PORT=4000
MONGO_URI=mongodb+srv://<kullanici>:<sifre>@cluster.mongodb.net/quill
JWT_SECRET=cok_gizli_anahtar_buraya
IYZICO_API_KEY=iyzico_api_key_buraya
IYZICO_SECRET_KEY=iyzico_secret_key_buraya
CLOUDINARY_URL=cloudinary://...
CLIENT_URL=http://localhost:3000
```

Quill © 2026 - Tüm Hakları Saklıdır.
