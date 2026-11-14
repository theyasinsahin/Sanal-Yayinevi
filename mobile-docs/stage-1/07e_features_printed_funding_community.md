# 07e — Features: Printed-Book Catalogue, Print Funding, Community Pages

Part of the feature inventory (index: `07_feature_inventory.md`; field key in `07a`). Static analysis only. Paths relative to `Client/src/`.

---

## Q. Printed-book catalogue (“Basılı Kitaplar”)

Catalogue of physically published books (`Book.kind = PRINTED`). Readers can rate, comment and quote them; authors can claim them.

### F-PRINTED-01 — Browse the printed catalogue
- **Entry:** `/printed-books`. **UI:** `pages/PrintedBooks`, `components/Books/PrintedBookCard` (cover-only tiles).
- **Rules:** server pagination, **12 per page**, previous/next arrows, “Sayfa X / Y”, total “N basılı eser”; ordered by `recognitionScore`. State lives in the URL query (`page`, `search`, `formats`, `genres`, `tags`, `features`, `audiences`). Search box (≤150 chars; “Kitap, yazar, yayınevi veya ISBN ara”) resets to page 1. Collapsible classification filters (`ClassificationFilters`: single-select per dimension + tag search).
- **API:** `getPrintedBooks(page, search, classification)`. **States:** loading text, error + “Tekrar dene”, empty (“Aramanıza uygun bir eser bulunamadı” / “Raflarımız ilk eserlerini bekliyor”).
- **Perm:** public. **Resp:** SH.

### F-PRINTED-02 — Submit a printed book for review
- **Entry:** “Basılı kitap ekle” on the catalogue (members; guests see a login link). **UI:** `components/Books/PrintedBookSubmissionForm`.
- **Inputs:** ISBN (optional) with **“ISBN ile bul”** auto-fill (title, author, publisher, year, pages, cover URL), title (≤200), printed author (2–300), publisher (2–200), edition year (1400…current), page count (1–50000), cover image **URL** (optional, https), classification (F-WRITE-02), description (20–5000), purchase URL (optional), **publication evidence URL (required)**.
- **API:** `lookupPrintedBook` (server calls an external ISBN source — `09_integrations_realtime.md`), `submitPrintedBook`. **OK:** “İsteğiniz Betik'e iletildi. Onaydan sonra kitabınız burada listelenecek.” **Fail:** server message (e.g. duplicate ISBN → suggests claiming).
- **Perm:** signed-in. Submission ≠ authorship.

### F-PRINTED-03 — “Basılı Kitap Katkılarım” (my submissions)
- Collapsible list of own submissions with status label (`İncelemede` / `Onaylandı` / `Düzenleme gerekiyor`). **API:** `getMyPrintedSubmissions`. Rejected/pending books show the admin's `reviewNote` on their detail page to the submitter.

### F-PRINTED-04 — Printed book detail
- **Entry:** `/kitap/:slug` for a printed book. **UI:** `components/Books/PrintedBookDetail`.
- **Shows:** cover, “Basılı eser” badge, title, printed author, publisher, year, pages, ISBN, “Satın alma sayfası ↗” (external link), reader link when the claimed author added chapters, “Betik'te onaylanan yazar”, classification (+ editor for author/admin/submitter-before-approval), share button, description, review status notice for non-approved entries.
- **Sub-features (approved books only):**
  - **Reader comments** — same comment system as digital books (F-COMM-01…05).
  - **Quote from the printed book** — form: text (10–1000), page number (1…pageCount, required), optional note (mentions), spoiler checkbox, visibility; duplicates → “Bu alıntı seçtiğiniz görünürlükle zaten kaydedilmiş.”; list of the book's quotes below. Guest → intent `quote` with the whole draft. **API:** `createQuote(pageNumber)`, `getQuotesByBook`.
- **API:** `getBookById`. **Perm:** public for approved; pending/rejected only submitter/admin.

### F-PRINTED-05 — “Okudum ve değerlendirdim” (rate & review)
- **UI:** `components/Books/PrintedReadingEditor`. Rating 1–5 (required: “Lütfen 1–5 arasında bir puan seçin.”), optional review ≤3000; buttons “Okudum, kitaplığıma ekle” / “Değerlendirmeyi güncelle” / “Okuduklarımdan kaldır”. Guest → intent `printed-reading`.
- **API:** `myPrintedBookReading`, `savePrintedBookReading`, `removePrintedBookReading`. **Perm:** signed-in.

### F-PRINTED-06 — “Okuduğum Basılı Kitaplar” shelf on profiles
- **UI:** `components/Books/PrintedReadingLibrary`. 12 per page (Önceki / Sonraki), star display, review, read date; owner can edit (link to book) or remove. Privacy: “Bu kullanıcının kitaplığı gizli.” when `canView` is false.
- **API:** `getPrintedReadings(userId, page)`, `removePrintedBookReading`.

### F-PRINTED-07 — Author claim on a printed book
- On approved books without an author, members see “Bu kitabın yazarı mısınız? Hak talebinde bulunun”: evidence text (20–3000, required), optional supporting URL. Pending → “Yazar hak talebiniz inceleniyor…”. A previous rejection note is shown. After approval the member becomes `authorId` and may add chapters through the writing dashboard.
- **API:** `requestBookClaim`; `Book.myClaim`. **Perm:** signed-in. Admin review → 07f.

---

## R. Print funding (crowdfunded printing) — **sandbox/test only**

Every screen states that this is a test environment and no real money is collected. The backend has **no live payment mode** (`environment` enum is only `SANDBOX`; iyzico is restricted to its sandbox host). Feature visibility depends on `printPaymentMode` (`DISABLED` / `SANDBOX` / `IYZICO_SANDBOX`).

### F-FUND-01 — Funding panel on the book detail page
- **UI:** `components/PrintFunding/BookFundingPanel`. “Bu kitabın basılmasını istiyorum”: shows `interestCount` and a toggle for members (free “interest” flag; disabled unless the book is published). If a campaign exists: campaign card (F-FUND-02) and, when `ACTIVE` and payments are enabled, a link to the checkout. Polls every 30 s.
- **API:** `printOverview`, `printPaymentMode`, `setPrintInterest`.

### F-FUND-02 — Campaign card
- Title, state label, “SANDBOX · Gerçek para alınmaz”, progress bar `accepted / target` with percentage, reserved and remaining amounts, supporter count, date range, production state, finance-issue warning, collapsible list of campaign updates. Amounts formatted with `Intl.NumberFormat('tr-TR', {currency:'TRY'})` from kuruş. **Src:** `components/PrintFunding/shared.jsx` (also the Turkish label map for every state enum).

### F-FUND-03 — Support / pre-order checkout
- **Entry:** `/donate/:bookId` (protected; “Destek Ol” and campaign links). **UI:** `pages/PrintCheckout` (`pages/DonationPage` re-exports it).
- **Inputs:** number of physical copies (0…`policy.maxOrderQuantity`), additional donation in TL (≤2 decimals → kuruş; quick-amount buttons from the tariff policy), shipping address when copies > 0 (`fullName`, `phone`, `city`, `district`, `postalCode`, `line`, data-processing `consent`), mandatory terms checkbox.
- **Rules:** total = `unitPriceMinor × quantity + donation`; “Kesin toplam sunucuda hesaplanır”; the basket must fit the remaining target entirely. An **idempotency key** (UUID) is generated once, stored in `sessionStorage['betik-checkout:<userId>:<campaignId>']` and reused on retry (“Aynı işlemi güvenle yeniden sorgula”). After starting, the basket is locked and the payment card (F-FUND-04) is shown and polled.
- **API:** `printOverview`, `printPaymentMode`, `startPrintCheckout`, `myFundingPayment`. **Errors:** `CAPACITY_EXCEEDED`, `PAYMENTS_DISABLED`, validation messages.
- **Perm:** signed-in. **Resp:** SH (pricing/limits BE) + BR (crypto UUID, sessionStorage).

### F-FUND-04 — Payment card & completing a payment
- **UI:** `components/PrintFunding/PaymentCard`. Shows amount, state, id, donation/order split, reservation state + expiry, order state with carrier/tracking, refund state.
- **`IYZICO_SANDBOX`:** link “iyzico ile test kartıyla öde” → **external hosted checkout page** (only `https://sandbox-cpp.iyzipay.com` / `sandbox-api.iyzipay.com` URLs are accepted). After paying, iyzico POSTs to the backend callback, which redirects the browser to `<CLIENT_URL>/funding-history`. Buttons: “Ödeme durumunu güncelle”, “Ödemeyi iptal et”.
- **`SANDBOX` (local mock):** buttons “Test ödemesini başarılı sonuçlandır” / “Başarısız ödeme dene” / “Ödemeyi iptal et”.
- **API:** `simulatePrintPayment`, `cancelPrintPayment`, `myFundingPayment`. **Resp:** EXT (iyzico) + BE.
- **Mobile note:** hosted checkout must open in an in-app browser / custom tab; the return redirect targets the **web** client → see `10_mobile_compatibility.md`.

### F-FUND-05 — “Desteklerim ve ön siparişlerim” (funding history)
- **Entry:** `/funding-history` (protected; also the target of `/payment/success` and of the iyzico return). Paged list (20) of the member's payments as payment cards, polling every 15 s. Empty: “Henüz destek veya ön sipariş işleminiz yok.”
- **API:** `myFundingPayments(page)`, `printPaymentMode`. Refund request UI: `requestPrintRefund` is used by the client (exact placement inside the payment card was elided in the condensed read — **verify**).

### F-FUND-06 — Author: print application workspace
- **Entry:** `/print/:bookId` (protected; from detail/dashboard once the book is published **and** completed). **UI:** `pages/PrintApplication`, `components/PrintFunding/ApplicationDetails`.
- **Flow:** choose book size (13,5×21 / 16×24 cm), cover type, paper, B/W or colour, print run (1–100000), cover DPI (300–2400), bleed (3–20 mm), sample tariff, upload **cover PDF** (≤10 MB, `POST /api/print/assets`), notes (≤2000), three mandatory declarations → “Basım sürümünü sabitle ve başvuruyu kaydet” (snapshots the manuscript into an immutable print version) → “Başvuruyu incelemeye gönder”. States: `PREPARING → SUBMITTED → APPROVED | REJECTED | REVISION_REQUESTED`, plus cancel with reason (while no campaign exists) and “Yeni başvuru hazırla” after rejection/cancellation.
- **Details view:** word count, estimated pages, version id + SHA-256, download cover PDF (`GET /api/print/assets/:id` → saved as `baski-belgesi.pdf`), specification JSON, estimated cost breakdown, verified quote and approved target, review note, version history and audit log.
- **API:** `myPrintApplicationForBook`, `printOverview`, `printTariffs`, `savePrintApplication`, `submitPrintApplication`, `cancelPrintApplication`, `printApplication`, `printApplicationVersions`, `printApplicationHistory`.
- **Perm:** author. **Resp:** SH + BR (file input, blob download).
- **Mobile note:** needs a document picker (PDF) and file save/open for the download.

### F-FUND-07 — Legacy payment result pages
- `/payment/failure` shows “Ödeme Başarısız” with an optional `reason` query string and a link to `/feed`; `/payment/success` re-exports the funding history. Legacy flow; the legacy backend callback is disabled (410).

### F-FUND-08 — Legacy backers avatars
- `components/Books/BackersSection` + `getBookBackers` (admin-only on the server; returns `[]` for everyone else) → effectively invisible to normal users. **INFERRED legacy.** `components/Books/CostCalculatorModal` also exists (not referenced by the pages read; **UNKNOWN** usage).

---

## S. Community & static pages

### F-COM-01 — About page
- `/about` (`pages/Community` `AboutPage`). Static content. **Verify** copy at runtime.

### F-COM-02 — Contact form
- `/contact` (`ContactPage`). Inputs: name (2–100), e-mail, subject (3–150), message (10–5000) + hidden honeypot `website`. Shows contact e-mail/phone/social links from `getCommunityConfig`. **API:** `sendContactMessage`, `getCommunityConfig`. Rate limited 10/15 min per IP; requires SMTP on the server.

### F-COM-03 — Legal pages
- `/terms`, `/privacy` (`LegalPage` + `pages/Community/legalDocuments.js`): static legal texts bundled in the client. **Mobile note:** texts must be bundled in the app or loaded from the website; app stores require a privacy-policy URL.

### F-COM-04 — Newsletter subscription
- Footer form (`components/Navigation/Footer/Newsletter.jsx`): e-mail + consent → `subscribeNewsletter` (double opt-in e-mail).
- `/newsletter?token=…&action=confirm|unsubscribe` (`NewsletterPage`) — landing page for the e-mailed links → `manageNewsletter`. **Deep-link target on the web**; can remain web-only.

### F-COM-05 — Authors directory
- See 07a F-DISC-06.

### F-COM-06 — Footer social links
- From `getCommunityConfig.socials` (instagram, x, linkedin, tiktok; only configured ones).

> **Coverage note:** `pages/Community/index.jsx` (95 lines), `legalDocuments.js`, `Footer`, `Newsletter`, `SocialLinks`, `HowItWorks`, `TrustedPublishers`, `NotFoundPage` were identified through routes, GraphQL usage and file listing but **not read line by line**; their behaviour above is derived from the operations they call and from the server contract (**INFERRED** where it concerns exact UI copy).
