# 07f — Features: Publisher Portal and Administration

Part of the feature inventory (index: `07_feature_inventory.md`; field key in `07a`). Static analysis only. Paths relative to `Client/src/`.

> **Scope question for the product owner (see `11_unknowns_and_risks.md` Q-01):** whether the admin panel and publisher portal must exist in the mobile app. They are role-restricted back-office tools designed for wide screens. They are inventoried here so that the decision can be made with full information; all of them are technically reusable through the same GraphQL API.

---

## T. Publisher portal

### F-PUB-01 — Publisher catalogue (read-only)
- **Entry:** `/publisher` (nav link visible to `PUBLISHER` and `ADMIN`). **UI:** `pages/PublisherPortal`.
- **Shows:** paged list (20 per page; Önceki / Sonraki) of published books with cover, title (link to detail), author name, writing status, publish date and — if a campaign exists — state, accepted/target amounts with a progress bar, supporter count, end date. Search (title/author, ≤100, explicit “Ara” button), funding filter tabs (`ALL` / `HAS_CAMPAIGN` / `ACTIVE` / `SUCCEEDED`), “Yenile”, “Filtreleri temizle”.
- **API:** `publisherCatalog(page, limit, search, funding)`. **Fail:** “Portal verileri alınamadı. Erişiminiz değiştiyse yeniden giriş yapın…”.
- **Perm:** `PUBLISHER` or `ADMIN` (server: `Server/src/services/publisherService.js`). **Resp:** BE. No write actions.
- **Verify:** how a user becomes `PUBLISHER` (only through the admin data editor — INFERRED; no self-service flow exists in the client).

---

## U. Administration (`/admin/*`, role `ADMIN`)

Navigation (`components/Admin/AdminLayout`): Basım/Destek · Panel · Kullanıcılar · Kitaplar · Türler · Veri · Şemalar · İşlemler · Oturum izinleri · Basılı kitaplar.

### F-ADM-01 — Admin overview dashboard
- `/admin` (`pages/Admin/Dashboard/Overview`). Pending-review counters linking to the queues (print applications, printed-book requests, claims, session-access requests, pending books), revenue per currency (“Başarılı ödemeler”), resource counts, latest admin audit entries. **API:** `getAdminOverview`.

### F-ADM-02 — Generic data browser
- `/admin/data`, `/admin/data/:resource`, shortcuts `/admin/users` (User), `/admin/books` (Book), `/admin/genres` (Genre), `/admin/transactions` (Transaction). **UI:** `pages/Admin/Data`.
- Schema-driven: the server describes every resource (fields, types, enums, references, editable flags, sensitive flags, indexes) and the client renders a table with search (≤120 chars), state filter (`ALL/ACTIVE/INACTIVE/DELETED`), paging, relation filter (`relatedField` + `relatedId`), “Yenile”, and “Yeni kayıt ekle” where `canCreate` (e.g. “Yeni tür ekle”).
- **API:** `getAdminResources`, `getAdminRecords`.

### F-ADM-03 — Record editor with audit reason and optimistic locking
- `pages/Admin/Data/RecordEditor.jsx`. Loads one record (`getAdminRecord`), renders inputs per field type (text, number, boolean, enum select, reference pickers with search), tracks changed fields only, requires a **reason (5–500 chars)**, sends `saveAdminRecord(resource, id, revision, changes, reason)`. A `CONFLICT` (stale `revision`) shows a reload action. Unsaved-changes guards (`window.confirm`). Links: “Bölümler ve yayın işlemleri” (book → writing dashboard), record audit history.
- **Server rules (selection):** cannot remove own admin role or deactivate self; at least one active admin must remain; soft-delete (“arşiv”) cascades and restores through `adminArchiveId`; immutable codes (genre slug, term kind/slug); newsletter subscriptions can only be set to `unsubscribed`; sensitive fields (`password`, tokens, access codes…) are masked. **Src:** `Server/src/services/adminService.js`, `adminResources.js`, `adminVisibility.js`.
- **API:** `getAdminRecord`, `saveAdminRecord`. **Destructive potential: high** (edits/archives any content, changes roles, blocks logins).

### F-ADM-04 — Schema viewer
- `/admin/schemas` — read-only view of resource schemas and indexes from `getAdminResources`.

### F-ADM-05 — Printed-book review queue
- `/admin/printed-books` (`pages/Admin/PrintedBooks`). Two lists polled every 30 s: “Kitap ekleme istekleri” and “Yazar hak talepleri”. Each item: details + note (≤1000; required for rejection — **verify**) + approve/reject.
- **API:** `getPrintedBookReviews`, `getBookClaimReviews`, `reviewPrintedBook`, `reviewBookClaim`. Approving a claim assigns the claimant as the book's author.

### F-ADM-06 — Session-creation access review
- `/admin/session-access` (`pages/Admin/SessionAccess`). Status filter (PENDING / APPROVED / REJECTED), 20 per page, per request: user, e-mail, reason, note field (≤500; ≥5 chars required to reject or revoke), **Onayla**, **Reddet** / **İzni kaldır**; “Listeyi yenile”. Stale revision → `CONFLICT` message.
- **API:** `sessionAccessRequests`, `reviewSessionCreationAccess`.

### F-ADM-07 — Print applications review
- `/admin/print-funding` tab “applications”. Per application: details (F-FUND-06 view), decision `APPROVED` / `REVISION_REQUESTED` / `REJECTED` with reason; approval requires a verified quote: source, confirmed pages, cost components, target and unit price, uploads “Onaylanacak son mizanpaj PDF” and “Matbaa teklif PDF”, preflight confirmation. An admin cannot approve their own application.
- **API:** `adminPrintApplications`, `reviewPrintApplication`, `POST /api/print/assets`.

### F-ADM-08 — Open / close funding campaigns
- From an approved application: “Onaylı sandbox kampanyasını aç” (optional duration in days; default from tariff policy = 30). Campaign list (polled 15 s) with campaign card, audit log toggle, **close** with a reason (≥5 chars) for `ACTIVE`/`CLOSING` campaigns.
- **API:** `openFundingCampaign`, `adminFundingCampaigns`, `closeFundingCampaign`, `printCampaignAudit`.

### F-ADM-09 — Production tracking
- Admin updates the production state of a succeeded campaign along the fixed chain `PREPARATION → PRINTER_APPROVED → STARTED → PRINTING → PRINTED → PACKAGING → SHIPPING → DELIVERED → COMPLETED` (plus `ISSUE` and return, `CANCELLED` → refunds), each with a public message (≥5 chars). Supporters and the author are notified.
- **API:** `updatePrintProduction`.

### F-ADM-10 — Payments, refunds, pre-orders
- Tab “operations”: refunds list with retry for failed ones, payments, pre-orders with state transitions `CONFIRMED → PACKAGING → SHIPPED (carrier + tracking number) → DELIVERED` (+ `ISSUE`), each with a reason (≥5 chars). Shipping addresses are visible to admins.
- **API:** `adminFundingRefunds`, `adminFundingPayments`, `adminPrintOrders`, `retryPrintRefund`, `updatePrintOrder`, `requestPrintRefund`.

### F-ADM-11 — Tariffs
- Tab “tariffs”: list of immutable sample tariffs; form to create a new version (page rates per paper, cover rates, dimension/colour multipliers in basis points, setup/packaging/shipping/service amounts, tax and fee bps, policy limits).
- **API:** `printTariffs`, `createPrintTariff`.

### F-ADM-12 — Manual maintenance run
- “Uzlaştırma ve iade işlerini şimdi çalıştır” → `runPrintMaintenance` (the same job runs every 15 s on the server).

### F-ADM-13 — Admin powers inside regular screens
- Delete any book (F-BOOK-08), edit classification of any book (F-BOOK-09), edit any session cover (F-SESS-11), see drafts and hidden chapters, see review notes/evidence on printed books, view any user's e-mail and settings objects through the API.
