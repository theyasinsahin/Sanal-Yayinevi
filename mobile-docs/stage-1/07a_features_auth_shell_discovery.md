# 07a — Features: Authentication, App Shell, Discovery

Part of the feature inventory (index: `07_feature_inventory.md`). Static analysis only — **no runtime behaviour has been verified**. Paths are relative to `Client/src/` unless they start with `Server/`.

Field key: **Entry** (where the user starts) · **UI** (page/component) · **Inputs** · **Rules** (business rules) · **API** · **State** · **Validation** · **OK** (success behaviour) · **Fail** (failure behaviour) · **Perm** (permission) · **Src** · **Verify** (needs Stage 2 runtime check) · **Resp** (responsibility: FE = frontend only, BE = backend only, SH = shared, BR = browser API dependent, EXT = external service).

---

## A. Authentication & session

### F-AUTH-01 — E-mail / password login
- **Entry:** `/login` (nav “Giriş Yap”, redirects from protected routes, registration prompt). **UI:** `pages/Auth/Login`.
- **Inputs:** e-mail, password. Optional `?returnTo=<path>` and `?error=<code>` query params.
- **Rules:** on success store session and navigate to the remembered destination (`finishRegistrationIntent`): `returnTo` query → pending registration intent → `/profile`. If already signed in, the page redirects immediately.
- **API:** `login`. **State:** session `{token, user}` persisted (web: `localStorage` keys `token`, `userId`, `user`); Apollo cache cleared when the token changes.
- **Validation:** HTML `required` + `type=email` only (no client password rules on login). Server: `05_authentication_security.md` §4.
- **OK:** redirect to destination. **Fail:** inline alert — `Failed to fetch` → “Geçici bir sorun yaşanıyor olabilir…”, anything else → “Giriş yapılamadı. Bilgilerinizi kontrol edin.” Query `error=google_auth_failed|account_deleted|google_no_credential` shows a specific message.
- **Perm:** guest. **Resp:** SH. **Src:** `pages/Auth/Login/index.jsx`, `context/AuthContext/index.jsx`, `utils/registrationIntent.js`.
- **Verify:** rate-limit message after repeated failures; behaviour for deactivated account (server reactivates silently).

### F-AUTH-02 — Registration with e-mail verification code (2 steps)
- **Entry:** `/register`. **UI:** `pages/Auth/Register`.
- **Inputs:** step 1 — full name, username, e-mail, password, terms checkbox; step 2 — 6-digit code.
- **Rules:** step 1 calls `sendRegistrationCode`; only `code === 200` advances. Step 2 calls `registerAndLogin`; on `code === 200` with token the user is logged in and redirected (`isNewAccount: true` → guest reading progress for the intent's book is migrated to the new account). “Kodu yeniden gönder” has a **60-second client cooldown**; “Bilgileri Düzenle” returns to step 1. Code validity text: 10 minutes.
- **API:** `sendRegistrationCode`, `registerAndLogin`. **State:** `step`, `resendCooldown`, form data.
- **Validation (client):** all fields required; terms must be checked (browser `alert` otherwise); password must satisfy `utils/PasswordValidation` (see F-AUTH-07); code input `pattern=[0-9]{6}`, `maxLength=6`, numeric keyboard, `autocomplete=one-time-code`. Server rules: `05_authentication_security.md` §3.
- **OK:** success text “… Yönlendiriliyorsunuz...” then redirect. **Fail:** server message shown inline (failures arrive as `code:400`, not GraphQL errors); network error → “Sunucuya ulaşılamadı…”.
- **Perm:** guest. **Resp:** SH (code generation/e-mail BE; cooldown + password meter FE). **Src:** `pages/Auth/Register/index.jsx`.
- **Verify:** e-mail delivery in the local environment (SMTP disabled in Docker dev → how codes are obtained); the terms link points to `/kullanim-kosullari`, **which is not a defined route** (routes are `/terms`, `/privacy`) → appears to be a web bug (VERIFIED from `App.js` route table; runtime result UNKNOWN).

### F-AUTH-03 — Google sign-in / sign-up
- **Entry:** Google button on `/login` and `/register` (only when `GOOGLE_LOGIN_ENABLED`). **UI:** `@react-oauth/google` `<GoogleLogin ux_mode="redirect" login_uri=… nonce=…>`, then `pages/Auth/GoogleCallback` at `/auth/callback`.
- **Rules:** web flow = full-page redirect: Google POSTs the credential to the backend callback (through a same-origin Vercel rewrite in production), backend redirects to `/auth/callback#token=…&user=…&nonce=…&newAccount=…`. The client verifies the nonce stored in `sessionStorage` (10-minute TTL), wipes the URL fragment, stores the session and redirects like F-AUTH-01.
- **API:** `POST /auth/google/callback` (web). GraphQL `googleAuth` exists and is defined client-side in `graphql/mutations/user.js` but the pages use the redirect flow. **Flutter must use `googleAuth(token)`** — see `10_mobile_compatibility.md`.
- **OK:** signed in. **Fail:** redirect to `/login?error=google_auth_failed`.
- **Perm:** guest. **Resp:** EXT + SH + BR (cookies, redirect, sessionStorage). **Src:** `pages/Auth/GoogleCallback/index.jsx`, `utils/googleLoginNonce.js`, `config/api.js`, `config/integrations.js`, `Client/vercel.json`, `Server/src/routes/googleAuthRoutes.js`.
- **Verify:** whether Google sign-in is configured in the Stage 2 environment (disabled by default in Docker dev).

### F-AUTH-04 — Forgot password
- **Entry:** “Şifremi Unuttum” on login → `/sifremi-unuttum` (`/forgot-password` redirects there). **UI:** `pages/Auth/ForgotPassword`.
- **Inputs:** e-mail. **API:** `forgotPassword`.
- **OK:** neutral confirmation (“… Bağlantı **1 saat** geçerlidir.”), “Yeniden dene”, link back to login. **Fail:** “Bağlantı gönderilemedi. Lütfen biraz sonra tekrar deneyin.”
- **Perm:** guest. **Resp:** SH. **Src:** `pages/Auth/ForgotPassword/index.jsx`. **Verify:** e-mail content/link in local env.

### F-AUTH-05 — Reset password from e-mailed link
- **Entry:** `/reset-password/:token` (link in e-mail → **deep link**). **UI:** `pages/Auth/ResetPassword`.
- **Inputs:** new password, confirmation. **Validation:** password rules (F-AUTH-07) and equality (“Şifreler eşleşmiyor.”).
- **API:** `resetPassword`. **OK:** success text, automatic redirect to `/login` after 3 s. **Fail:** server message inline.
- **Perm:** guest with valid token. **Resp:** SH. **Src:** `pages/Auth/ResetPassword/index.jsx`.

### F-AUTH-06 — Logout
- **Entry:** “Çıkış Yap” in the mobile menu and in profile/settings (see 07d). **Rules:** calls `logout` (server revokes **all** sessions), then always clears local session and hard-navigates to `/login`, even if the server call fails.
- **API:** `logout`. **Resp:** SH. **Src:** `context/AuthContext/index.jsx:109-113`.
- **Verify:** that other devices are signed out (important parity note for multi-device mobile users).

### F-AUTH-07 — Password strength indicator
- **UI:** `components/UI/PasswordStrengthIndicator`, `utils/PasswordValidation`. Live checklist under password fields (register, reset, change password).
- **Rules:** mirrors server rules (≥8 chars, upper, lower, digit, special). **Resp:** FE (duplicated BE rule). Labels: “En az 8 karakter”, “En az 1 büyük harf”, “En az 1 küçük harf”, “En az 1 rakam”, “En az 1 özel karakter (!@#$...)” (`utils/PasswordValidation/index.js`).

### F-AUTH-08 — Session persistence, validation and expiry handling
- **Rules (all FE logic Flutter must reproduce natively):**
  - On app start, read the stored session; discard if JWT `exp` has passed; validate with `me` (`no-cache`). If `me.id` differs or the call returns `UNAUTHENTICATED`, clear the session. The user's `role` is refreshed from `me`.
  - Re-validate on window focus / page show / tab visible, and every 60 s while visible. A timer fires exactly at token expiry to sign the user out.
  - Cross-tab sync through the `storage` event and a custom `betik:auth-session-changed` event.
  - Every request attaches `Authorization: Bearer`; an expired token is dropped before sending; any `UNAUTHENTICATED` GraphQL error, HTTP 401 or WS close 4401 invalidates the session.
  - When the token changes, the Apollo store is cleared and the WebSocket is terminated/reconnected (`ScoreUpdates` → `reconnectSubscriptions`).
- **API:** `me`. **Resp:** FE + BR (`localStorage`, visibility events). **Src:** `context/AuthContext/index.jsx`, `utils/authSession.js`, `utils/authLink.js`, `App.js`.
- **Verify:** behaviour at the 24 h boundary; behaviour after password change on another device.

### F-AUTH-09 — Route guards
- `ProtectedRoute` (signed-in): `/create-book`, `/dashboard/:bookId`, `/print/:bookId`, `/funding-history`, `/profile`, `/donate/:bookId`, `/payment/success`, `/messages`, `/messages/:conversationId` → redirect to `/login`.
- `AdminRoute` (`role === 'ADMIN'`): all `/admin/*` → redirect to `/`.
- `PublisherRoute` (`PUBLISHER` or `ADMIN`): `/publisher` → `/login` for guests, `/` otherwise.
- **Resp:** FE convenience only; the backend enforces every permission again. **Src:** `App.js`, `components/Route/*`.

### F-AUTH-10 — “Registration intent” (deferred action after sign-up)
- **Purpose:** a guest attempting a member-only action (read next chapter, save, follow, like, comment, reply, paragraph comment, quote, quote comment, repost, bookmark, recommendations, printed-reading) sees a modal (“Ücretsiz hesap oluştur” / “Zaten hesabım var — Giriş yap” / “Şimdilik geri dön”) with action-specific copy. The intent (action, return path, optional draft text/selection, ids) is stored for 30 minutes and **replayed after authentication** on the originating screen (`useRestoredRegistration`), bound to the account that completed sign-in.
- **Rules:** `returnTo` is restricted to an allow-list of in-app paths; drafts ≤20,000 chars; selections 10–1000 chars.
- **Resp:** FE + BR (`sessionStorage`). **Src:** `utils/registrationIntent.js`, `components/Registration/RegistrationPrompt.jsx`, `hooks/useRegistration.js`.
- **Verify:** each action's replay behaviour (drafts restored? action auto-executed?) — exercised per feature in Stage 2.

---

## B. App shell & navigation

### F-NAV-01 — Top navigation bar
- **UI:** `components/Navigation/NavigationBar`. Links: Keşfet `/feed`, Alıntılar `/quotes`, Basılı Kitaplar `/printed-books`, Aktiflik Tablosu `/leaderboard`, Oturumlar `/sessions`; “Yayınevi Portalı” for publisher/admin; signed in: “Kitap Oluştur”, messages icon with unread badge (`99+` cap), notification bell, profile icon; guest: “Giriş Yap”. Hamburger toggles the mobile menu (breakpoint 1200 px).
- **API:** `getUnreadMessageCount` (hook `useUnreadMessageCount`, see 07c), notification count.
- **Resp:** FE. **Mobile note:** maps naturally to a bottom navigation bar / drawer; preserve destinations and badges, not the layout.

### F-NAV-02 — Mobile slide-out menu
- **UI:** `components/Navigation/MobileMenu`. Same destinations + Profilim, Kitap Oluştur, Mesajlar (badge), Bildirimler, **Çıkış Yap**; guest: Giriş Yap, Kayıt Ol. Backdrop tap closes.

### F-NAV-03 — Footer
- **UI:** `components/Navigation/Footer` (+ `SocialLinks`, `Newsletter`). Links to about/contact/terms/privacy/authors, social links from `getCommunityConfig`, newsletter sign-up (F-COM-04 in 07e). **Verify:** exact link list at runtime.

### F-NAV-04 — Readable URLs and legacy URL redirection
- **Rules:** canonical public URLs are slug based: `/yazar/:username`, `/kitap/:slug`, `/kitap/:slug/oku`, `/kitap/:slug/bolum/:chapterSlug`, `/oturum/:slug`. Legacy id URLs (`/book-detail/:id`, `/book-reader/:bookId?chapter=<id>`, `/user/:userId`, `/sessions/:sessionId`) are resolved through `resolvePublicRoute(legacy:true)` and **redirected** to the canonical path (query string and hash preserved). Unknown/inaccessible → Not Found page. The resolved **id** is passed to the page (`resolvedId`, `resolvedChapterId`); pages then work with ids.
- **API:** `resolvePublicRoute`. **Resp:** SH + BR (canonical `<link>` tag). **Src:** `components/Route/PublicContentRoute.jsx`, `utils/publicPaths.js`, `Server/src/services/publicUrlService.js`.
- **Mobile note:** Flutter needs this resolver only for **incoming deep links / shared URLs**; internal navigation can use ids directly.

### F-NAV-05 — Not Found page
- **UI:** `pages/NotFoundPage` (catch-all `*`). **Verify:** content/actions.

### F-NAV-06 — Page-level loading and crash boundary
- Lazy-loaded pages show “Sayfa yükleniyor...”; a render crash shows “Sayfa yüklenemedi” with a “Yeniden yükle” button. **Src:** `components/Route/PageBoundary.jsx`.

### F-NAV-07 — Toast notifications
- Global stacked toasts, types `info/success/error`, default 3.5 s. **Src:** `context/ToastContext.jsx`, `components/UI/Toast`.

### F-NAV-08 — Scroll restoration / scroll-to-top
- **Src:** `components/ScrollToTop`. Browser-specific; native navigation stacks replace it. **Verify:** not needed for parity.

### F-NAV-09 — PWA install prompt & service worker
- “Ana ekrana ekle” banner (`components/InstallPrompt`), `serviceWorkerRegistration.js`. **Resp:** BR. **Not applicable to a native app** (documented in `10_mobile_compatibility.md`).

### F-NAV-10 — Decorative “personal foxes”
- `components/PersonalFoxes` renders decorative mascots globally. **Verify:** whether they carry any function (tests exist: `PersonalFoxes.test.jsx`); treated as cosmetic (**INFERRED**).

### F-NAV-11 — Reading font-size preference & theme
- `ReadingPreferencesContext`: font size `sm/md/lg` = 16/18/20 px stored in `localStorage['app_font_size']`; theme is forced to `light`; document language `tr`. Editable in settings (07d). **Resp:** FE + BR storage.

---

## C. Notifications (in-app)

### F-NOT-01 — Notification bell with unread badge
- **Entry:** bell in nav bar / mobile menu. **UI:** `components/Notification/NotificationBell`.
- **Rules:** unread count polled every 15 s (paused when the tab is hidden), also refreshed on focus, visibility change and on the local “score updated” event. Opening the panel loads the latest 20 notifications and, if any are unread, **marks all as read immediately** and refetches. Relative time labels: “Az önce”, `Ndk`, `Nsa`, `Ng`.
- **API:** `getUnreadNotificationCount`, `getNotifications`, `markNotificationsRead`.
- **Resp:** SH (polling cadence FE). **Src:** `components/Notification/NotificationBell/index.jsx`, `hooks/useLiveScoreQuery.js`.
- **Verify:** `createdAt` wire format — the client parses it with `new Date(Number(value))`, i.e. it expects an **epoch-milliseconds string** (see `03_backend_api.md` date note).
- **Mobile note:** there is **no push-notification infrastructure** in the backend (no device tokens, no FCM/APNs). In-app polling is the only mechanism → `10_mobile_compatibility.md`.

### F-NOT-02 — Notification deep-link targets
- Each notification row links according to `type` + `meta` (`utils/notificationTarget.js`):

| Type | Target |
|---|---|
| `POINTS_EARNED` | none (not tappable) |
| `BADGE_EARNED` | own profile |
| `NEW_CHAPTER` | reader of `meta.bookId` at `meta.chapterId` |
| `BOOK_LIKED` | book detail |
| `COMMENT_RECEIVED`, `COMMENT_MENTION` | book detail, anchored to `#comment-<id>` (or `#comments`) |
| `PARAGRAPH_MENTION` | reader at chapter + `paragraph=<index>`, anchored to the paragraph comment |
| `QUOTE_MENTION`, `QUOTE_LIKED` | quote detail (`#quote-comment-<id>` for mentions) |
| `SESSION_MENTION`, `SESSION_REPLY` | session detail anchored to `#entry-<id>` |
| `FOLLOW_REQUEST`, `FOLLOW_REQUEST_ACCEPTED`, `NEW_FOLLOWER` | the other user's profile |
| `BOOK_REVIEW` | admin → printed-book review queue; else book detail / printed list |
| `PRINT_UPDATE` | author → print application page for the book; supporter → book detail; no book → admin print-funding / funding history |
| `FUNDING_RECEIVED` | print application page / funding history |

- **Resp:** FE mapping over BE-provided `meta`. **Verify:** each type end-to-end.

### F-NOT-03 — Follow requests inside the notification panel
- **UI:** `components/Follow/FollowRequests` (top of the panel). Lists pending incoming requests (20 per page, “Diğer İstekler” loads more; polling every 15 s while ≤20 loaded), each with **Kabul Et / Reddet**; shows server message; refreshes notification queries and open profiles.
- **API:** `getIncomingFollowRequests`, `respondToFollowRequest`. **Perm:** signed-in. **Resp:** SH.

---

## D. Landing & discovery

### F-DISC-01 — Landing page
- **Entry:** `/`. **UI:** `pages/Landing` → `HeroSection`, `FeaturedBooks`, `HowItWorks`, `TrustedPublishers`.
- **Rules:** hero search box (≤100 chars) filters the “En Popüler Kitaplar” section in place (title becomes “Arama Sonuçları”); 10 books per page sorted `POPULAR`; “Daha Fazla Kitap Göster” paginates; “Tüm Kitapları Gör →” opens `/feed`; clear button resets. `HowItWorks` and `TrustedPublishers` are static marketing content (publisher logos in `Client/public/images/publishers`).
- **API:** `getBookFeed(limit:10, sort:POPULAR, search)`.
- **OK/empty/error states:** skeleton cards; “Henüz yayımlanmış kitap bulunmuyor.” / “Aramanızla eşleşen kitap bulunamadı…” + “Popüler Kitaplara Dön”; error with “Yeniden Dene”.
- **Perm:** public. **Resp:** SH (search debounce 250 ms FE). **Src:** `components/Landing/*`, `hooks/useBookFeed.js`.

### F-DISC-02 — Explore feed (“Keşfet”) with search, filters, sort, pagination
- **Entry:** `/feed`. **UI:** `pages/Feed`, `components/Feed/FeedSearch`, `FeedFilters`, `components/Books/Classification/ClassificationFilters`, `BookGrid`, `BookCard`.
- **Inputs:** search text (≤100, debounced 250 ms; matches book title, author, quote text); classification filters (formats, genres, tags, features, audiences — by slug); funding radio (`Tüm kitaplar` / `Desteği açık kitaplar` / `Hedefini tamamlayan kitaplar`); sort radio (`En Yeni`, `En Popüler`, `En Eski`, `En Son Güncellenen`, `Hedefe en yakın`).
- **Rules:** choosing “Hedefe en yakın” forces funding = ACTIVE; changing funding away from ACTIVE while that sort is active resets sort to “En Yeni” (`context/FiltersContext`). Page title changes with the filter. 24 books per page, cursor pagination through “Daha fazla göster”; results de-duplicated by id; a stale page response for a changed filter is discarded. Filter state is in-memory (lost on reload) and **shared with other pages using `FiltersContext`**.
- **API:** `getBookFeed`, `getClassificationOptions`.
- **States:** loading skeleton (9), error with “Yenile” / “Ana Sayfaya Dön”, empty “Aramanızla eşleşen kitap bulunamadı.”
- **Perm:** public. **Resp:** SH. **Src:** `pages/Feed/index.jsx`, `hooks/useBookFeed.js`, `context/FiltersContext/index.jsx`, `Server/src/services/bookCatalogService.js`.
- **Verify:** Turkish-character search folding; cursor behaviour when the list changes between pages.

### F-DISC-03 — “Senin için” personalised recommendations tab
- **Entry:** `/feed?tab=for-you`. **Rules:** guest → registration card (intent `recommendations`). Signed-in without onboarding → genre picker (F-DISC-04). Otherwise a grid of recommended books with a reason badge per card (`components/Recommendation/ReasonBadge`: liked/saved/commented/quoted genre, onboarding genre, social, new, popular); “Daha fazla göster” loads the next 10 by offset. Empty: “Henüz öneri yok…”.
- **API:** `getRecommendations(limit:10, offset)`, `getUserPreference`.
- **Perm:** signed-in. **Resp:** BE (scoring in `Server/src/services/recommendationService.js`). **Verify:** reason labels; ordering stability across pages.

### F-DISC-04 — Genre-preference onboarding / edit
- **UI:** `FeedOnboarding` + `GenrePreferenceChoices`; sidebar “Tercihlerim” box with “Düzenle”.
- **Rules:** at least one genre; button label reflects the count. Saving refetches recommendations and preference.
- **API:** `getAllGenres`, `saveUserPreference`. **Fail:** toast with server message. **Perm:** signed-in. **Resp:** SH.

### F-DISC-05 — Book card
- **UI:** `components/Books/BookCard` (+ `BookFundingProgress`, `CompactNumber`), used in every grid/carousel. Shows cover, title, author, classification summary, like/view counts in compact Turkish notation (`Intl.NumberFormat('tr-TR', {notation:'compact'})`), and a funding progress bar when `fundingSummary` exists. Detailed interactions (save/like from the card, navigation target) → 07b F-BOOK-02.

### F-DISC-06 — Authors directory
- **Entry:** `/authors`. **UI:** `pages/Community` (`AuthorsPage`). Paginated list of public authors (12 per page) with book and page counts, linking to profiles. **API:** `getAuthors`. **Perm:** public. **Verify:** pagination control behaviour.
