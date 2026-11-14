# Navigation and roles — observed

## Global navigation

**Desktop top bar:** logo "BETİK" (home) · KEŞFET `/feed` · ALINTILAR `/quotes` · BASILI KİTAPLAR `/printed-books` · AKTİFLİK TABLOSU `/leaderboard` · OTURUMLAR `/sessions`, then by role:

| Role | Right side of the bar |
|---|---|
| Guest | GİRİŞ YAP |
| Member | KİTAP OLUŞTUR · messages icon (green unread badge) · bell (red unread badge) · profile icon |
| Publisher | as member + YAYINEVİ PORTALI |
| Admin | as member; the admin area is reached at `/admin` and has its own sidebar |

**Mobile:** logo + hamburger. Slide-out from the right over a dimmed page with the same destinations as rows with icons, Profilim, Kitap Oluştur, Mesajlar, Bildirimler and ÇIKIŞ YAP (`nav/mobile_menu_member`). Guests get Giriş Yap and Kayıt Ol.

**Footer (every standard page):** brand text, four social icons, PLATFORM (Keşfet, Kitap Yaz, Yazarlar, Basılı Kitaplar), KURUMSAL (Hakkımızda, İletişim, Kullanım Koşulları, Gizlilik Politikası), newsletter form.

**Screens with their own chrome:** writing dashboard (no site bar or footer), reader (site bar kept, own sidebar), admin (own sidebar).

## Page hierarchy

```
Landing /
├─ Keşfet /feed ── tabs: Tüm kitaplar | Senin için
│   └─ Book detail /kitap/<slug>
│       ├─ Reader /kitap/<slug>/oku   (deep link: /kitap/<slug>/bolum/<chapter>)
│       ├─ Checkout /donate/<bookId>
│       └─ Author: Dashboard /dashboard/<bookId> ── Print application /print/<bookId>
├─ Alıntılar /quotes ── /quotes/<id>
├─ Basılı Kitaplar /printed-books ── /kitap/<slug> (printed variant)
├─ Aktiflik Tablosu /leaderboard
├─ Oturumlar /sessions ── /oturum/<slug>
├─ Yazarlar /authors ── Profile /yazar/<username>
├─ Profile /profile ── tabs: Yayınlananlar | Dijital Kitaplık | Okuduğum Basılı Kitaplar | Taslaklar | Alıntılar | Takip | Ayarlar
│   └─ Ayarlar: Hesap | Gizlilik | Bildirimler | Yazar | Görünüm | Hesabı Sil
├─ Mesajlar /messages ── /messages/<conversationId>
├─ Desteklerim /funding-history
├─ Kitap Oluştur /create-book
├─ Auth: /login, /register, /sifremi-unuttum, /reset-password/<token>
├─ Community: /about, /contact, /terms, /privacy, /newsletter
├─ Publisher /publisher
└─ Admin /admin, /admin/data[/<Resource>], /admin/schemas, /admin/session-access, /admin/printed-books, /admin/print-funding
```

Legacy addresses redirect: `/book-detail/<id>`, `/book-reader/<id>`, `/user/<id>`, `/sessions/<id>`, `/forgot-password`. Notifications still use the legacy form and rely on the redirect.

## Route guards (tested)

| Route | Guest | Member | Publisher | Admin |
|---|---|---|---|---|
| `/profile`, `/create-book`, `/messages`, `/funding-history`, `/payment/success` | → `/login` | ✔ | ✔ | ✔ |
| `/publisher` | → `/login` | → `/` | ✔ | ✔ |
| `/admin/*` | → `/` | → `/` | → `/` | ✔ |
| `/dashboard/<own book>` | → `/login` | ✔ | — | ✔ (any book) |
| `/dashboard/<other's public book>` | → `/login` | opens (writes refused) — B-03 | — | ✔ |
| `/print/<other's book>` | → `/login` | public campaign card only | — | — |
| Hidden chapter link | 404 | not listed | — | — |
| Draft book of another user | 404 | 404 | — | — |

## What each role can do (verified items only)

| Capability | Guest | Member | Author of the book | Publisher | Admin |
|---|:-:|:-:|:-:|:-:|:-:|
| Browse feed, quotes, printed catalogue, leaderboard, sessions, authors, profiles | ✔ | ✔ | ✔ | ✔ | ✔ |
| Read first chapter | ✔ | ✔ | ✔ | ✔ | ✔ |
| Read all visible chapters, bookmark, quote, comment, like, save, follow | — (sign-up prompt) | ✔ | ✔ | ✔ | ✔ |
| "Senin için" recommendations | sign-up prompt | ✔ | ✔ | ✔ | ✔ |
| Create book, write, publish, hide chapters, delete | — | ✔ (own) | ✔ | ✔ | ✔ (SİL and classification on any book) |
| Create a writing session | — | after admin approval | — | — | reviews requests |
| Post in sessions | read only | ✔ | ✔ | ✔ | ✔ (private still needs code) |
| Messaging, follow requests, notifications | — | ✔ | ✔ | ✔ | ✔ |
| Submit / rate / quote / claim printed books | — | ✔ | ✔ | ✔ | reviews |
| Print application | — | — | ✔ (completed book) | — | reviews, opens campaign, refunds |
| Support / pre-order | — | ✔ | ✔ | ✔ | ✔ |
| Publisher portal | — | — | — | ✔ | ✔ |
| Data browser, record editor, audit | — | — | — | — | ✔ |

## Secondary navigation patterns

- **Back links** at the top of deep screens ("Kitaplığa Dön", "Kitap Detayına Dön", "← Oturumlara Dön", "← Alıntılara dön", "← Basılı kitaplara dön", "← Kitaba dön", "← Profilime dön", "← Yazı masasına dön").
- **Tabs** as button rows: feed tabs, profile tabs, settings sub-tabs, leaderboard periods, quotes sort, admin funding tabs.
- **Inline expansion instead of new screens:** paragraph comments, quote comments, repost form, reply form, profile edit, confirmation of deactivate/delete, printed-book forms, filter panel.
- **Overlays:** notification dropdown, share dialog, session creation modal, guest sign-up modal, followers modal, quote popup.
- **Native browser dialogs** (`confirm`) for delete chapter, delete comment, delete book, publish, unpublish, complete writing, close session.
- **Paging:** "ÖNCEKİ / Sayfa n / SONRAKİ" (authors, printed, history, admin, publisher); "Daha fazla göster" (recommendations); end marker "Tüm alıntılar yüklendi ✦" (quotes).
