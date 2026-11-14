# 06 — React Frontend Architecture

Stage 1 static analysis of `Client/src`. Feature-level detail is in `07*.md`. Paths relative to `Client/src/`.

## 1. Application bootstrap

`index.js` renders `<App/>` in `React.StrictMode`, reports web vitals, and registers a service worker. `App.js` builds:

- **Apollo Client**: `createHttpLink({ uri: API_URL })` (POSTs to the bare API origin), `GraphQLWsLink` (`graphql-ws` client on `WS_URL`, `connectionParams.authorization = "Bearer <token>"`, retry ×5 only when a token exists), `split` (subscriptions → WS, everything else → HTTP), preceded by the auth link (`utils/authLink.js`). Cache: `InMemoryCache` with `AdminRecord` un-normalised.
- **Providers** (outer → inner): optional `GoogleOAuthProvider` → `ApolloProvider` → `AuthProvider` → `ReadingPreferencesProvider` → `ToastProvider` → `FiltersProvider` → `RouterProvider`.
- **Root layout**: `RegistrationPrompt` (global modal), `ScrollToTop`, `ScoreUpdates` (global subscription + socket reconnect on user change), `PageBoundary` (Suspense + error boundary), `PersonalFoxes` (decorative), `InstallPrompt` (PWA).

## 2. Routing table (`App.js`)

`createBrowserRouter`; all page components are `React.lazy` except the landing page.

| Path | Screen | Guard | Notes |
|---|---|---|---|
| `/` | Landing | — | |
| `/feed` | Explore feed | — | `?tab=for-you` |
| `/authors` | Authors directory | — | `?page=` |
| `/printed-books` | Printed catalogue | — | `?page&search&formats&genres&tags&features&audiences` |
| `/about`, `/contact`, `/terms`, `/privacy` | Community/legal | — | |
| `/newsletter` | Newsletter confirm/unsubscribe | — | `?token&action` (e-mail deep link) |
| `/yazar/:username` | Profile | public route resolver | canonical |
| `/kitap/:slug` | Book detail | resolver | canonical |
| `/kitap/:slug/oku` | Reader | resolver | canonical |
| `/kitap/:slug/bolum/:chapterSlug` | Reader at chapter | resolver | canonical; `?paragraph=<n>` |
| `/oturum/:slug` | Session detail | resolver | canonical; `#entry-<id>` |
| `/book-detail/:id`, `/book-reader/:bookId`, `/user/:userId`, `/sessions/:sessionId` | legacy id URLs | resolver (`legacy`) | redirected to canonical |
| `/create-book` | Create book | signed-in | |
| `/dashboard/:bookId` | Writing dashboard | signed-in | |
| `/print/:bookId` | Print application | signed-in | |
| `/funding-history` | Funding history | signed-in | iyzico return target |
| `/donate/:bookId` | Support / checkout | signed-in | |
| `/payment/success` (signed-in), `/payment/failure` | legacy result pages | | |
| `/publisher` | Publisher portal | publisher/admin | |
| `/profile` | Own profile + settings | signed-in | |
| `/login`, `/register` | Auth | — | `?returnTo`, `?error` |
| `/auth/callback` | Google callback | — | reads URL **fragment** |
| `/sifremi-unuttum` (`/forgot-password` → redirect) | Forgot password | — | |
| `/reset-password/:token` | Reset password | — | e-mail deep link |
| `/quotes`, `/quotes/:quoteId` | Quotes feed / detail | — | `#quote-comment-<id>` |
| `/leaderboard` | Leaderboard | — | |
| `/messages`, `/messages/:conversationId` | Messaging | signed-in | |
| `/sessions` | Sessions list | — | |
| `/admin`, `/admin/users`, `/admin/books`, `/admin/genres`, `/admin/data`, `/admin/data/:resource`, `/admin/schemas`, `/admin/transactions`, `/admin/printed-books`, `/admin/print-funding`, `/admin/session-access` | Admin | admin | |
| `*` | Not found | — | |

**51 route entries mapping to 35 distinct screen components** (counted from the `createBrowserRouter` table; the six generic admin routes share `AdminData`). URL helpers: `utils/publicPaths.js` prefers the server-provided `publicPath` and falls back to legacy id URLs.

## 3. Layout & navigation patterns

- `components/Layout/MainLayout` wraps most pages (navigation bar + content + footer); the reader uses a slimmer `Layout` (navbar only); admin pages use `components/Admin/AdminLayout` (side navigation).
- Top bar with five primary destinations, conditional publisher link, create-book button, messages (badge), notifications (badge + dropdown), profile; hamburger drawer below 1200 px.
- Modals/dialogs are hand-rolled (focus trap + Escape): registration prompt, share dialog, share-to-chat modal, create-session modal, followers/following modal, notification dropdown (portal), reader chapter drawer.
- Confirmations use `window.confirm` (book delete, publish/draft/complete, chapter delete, comment delete, close session, unsaved changes) and one typed-phrase confirmation (account deletion).

## 4. State management

| Kind | Mechanism |
|---|---|
| Server data | Apollo normalized cache; policies vary per query (`cache-and-network` for detail screens, `network-only`/`no-cache` for auth-sensitive data such as reader, bookmark, progress, profile) |
| Session | `AuthContext` (`user`, `loading`, `login`, `logout`, `ensureSession`) |
| Feed filters | `FiltersContext` (in-memory) |
| Toasts | `ToastContext` (some pages also keep a local `Toast`) |
| Reading font size | `ReadingPreferencesContext` (+ CSS variable `--reading-font-size`) |
| Local component state | `useState`/`useRef`; optimistic UI for likes, saves, follows, reposts, messages |
| External-store pattern | chapter autosave manager via `useSyncExternalStore` |

**Refresh strategies in use** (to be mapped to mobile equivalents): polling with visibility gating (notifications 15 s, score 15 s, unread messages 30 s, session-access 30 s, follow requests 15 s, campaign/payment 15–30 s, admin queues 30 s), refetch on window focus/visibility, GraphQL subscriptions (chat, session entries, score, leaderboard), and custom window events (`betik:auth-session-changed`, `betik:score-updated`, `betik:registration-prompt`).

## 5. Forms and client-side validation (summary)

| Form | Client validation | Where |
|---|---|---|
| Login | required, e-mail type | `pages/Auth/Login` |
| Register | required, terms, 5 password rules, 6-digit code | `pages/Auth/Register`, `utils/PasswordValidation` |
| Reset / change password | 5 rules + confirmation match | `pages/Auth/ResetPassword`, `components/Settings/AccountSettings` |
| Change e-mail | both fields, e-mail regex | `AccountSettings` |
| Create book | cover, title, description, classification | `pages/CreateBookPage` |
| Classification | format required, 1–3 genres, ≤8 tags (2–50 chars, charset) | `ClassificationFields` |
| Create session | title, access code ≥4 for private | `pages/SessionsPage` |
| Session access request | reason 10–1000 | `components/Sessions/SessionAccessRequest` |
| Quote (reader) | selection 10–1000 chars | `components/Quote/QuotePopup` |
| Quote (printed) | text 10–1000, page 1…pageCount | `components/Books/PrintedBookDetail` |
| Printed submission | lengths, year 1400…now, pages 1–50000, URL types | `PrintedBookSubmissionForm` |
| Printed rating | rating required, review ≤3000 | `PrintedReadingEditor` |
| Claim | evidence 20–3000 | `PrintedBookDetail` |
| Author settings | goal integer ≥0, note ≤300 | `components/Settings/AuthorSettings` |
| Checkout | amount format (≤2 decimals), terms, address fields | `pages/PrintCheckout` |
| Print application | numeric ranges, cover PDF, tariff, 3 declarations | `pages/PrintApplication` |
| Contact | field lengths (server enforced), honeypot | `pages/Community` |
| Delete account | exact phrase `hesabımı sil` | `components/Settings/DangerZone` |

Password rules (`utils/PasswordValidation`): ≥8 chars · ≥1 `A-Z` · ≥1 `a-z` · ≥1 digit · ≥1 non-alphanumeric. Identical to the server except that the server additionally limits the password to 72 UTF-8 bytes.

## 6. Browser storage and browser-API inventory

| Key / API | Storage | Purpose | Mobile replacement |
|---|---|---|---|
| `token`, `userId`, `user` | localStorage | session | secure storage (Keychain/Keystore) |
| `book-progress-<userId|guest>-<bookId>` (+ legacy `book-progress-<bookId>`) | localStorage | offline-tolerant reading progress | local DB / key-value store |
| `betik:reading:<userId>:<bookId>:<sessionId>` | localStorage | unsent reading-time buffer | local store |
| `app_font_size` | localStorage | reading font size | shared preferences |
| install-prompt dismissal key | localStorage | PWA banner | n/a |
| `betik:registration-intent` | sessionStorage | deferred action after sign-up (30 min) | in-memory / navigation state |
| `betik:google-login-nonce` | sessionStorage | Google redirect nonce | n/a (native Google sign-in) |
| `betik-checkout:<userId>:<campaignId>` | sessionStorage | checkout idempotency key | in-memory / local store |
| Selection API, `copy` event | DOM | quote creation, copy protection | native text selection |
| `visibilitychange`, `focus`, `pagehide`, `online`, `beforeunload` | DOM events | sync/flush triggers | app lifecycle + connectivity listeners |
| `fetch(..., {keepalive})` | network | flush on page exit | lifecycle flush / background task |
| Canvas, File API, `FormData` | DOM | image crop + upload | image picker/cropper + multipart upload |
| Web Share API, Clipboard, `<a download>` | DOM | sharing | native share sheet, clipboard, file save |
| `IntersectionObserver` | DOM | infinite scroll | list scroll listeners |
| `DOMParser`, `DOMPurify` | DOM | HTML sanitising / paragraph segmentation / page counting | Dart HTML parser + equivalent allow-list |
| `Intl.NumberFormat('tr-TR')`, `toLocaleDateString('tr-TR')` | Intl | compact counts, currency, dates | `intl` package with `tr_TR` |
| Service worker, `beforeinstallprompt`, `<meta robots>`, canonical `<link>` | PWA/SEO | — | not applicable |

## 7. Loading, error, empty states; i18n; responsiveness

- **Loading:** skeleton placeholders on feed/detail/sessions/chat/leaderboard; text status lines elsewhere; button `isLoading`.
- **Errors:** inline alert + retry button on most data screens; toasts for action failures; a few actions fail silently (`console.error` only — quote comment add/delete, message delete, repost).
- **Empty states:** dedicated Turkish copy per list (recorded in the feature files).
- **Internationalisation:** none. All strings are hard-coded **Turkish**; dates/numbers use `tr-TR`. Server messages are Turkish too. A Flutter app should centralise strings but only Turkish content exists.
- **Responsive behaviour:** CSS breakpoints (not analysed in detail — styling is out of scope); behavioural breakpoints: nav drawer ≤1200 px, reader chapter drawer ≤1100 px, quote popup docks to bottom ≤768 px, messages list/chat switch on small screens.
- **Accessibility affordances** present throughout (`aria-*`, focus management, `role="alert"/"status"`); useful as semantics hints for Flutter.

## 8. GraphQL operations used by the web client

Computed by parsing every `gql` document in `Client/src` (non-test files) against the server schema: **184 of 210** root fields appear in client documents.

**Not referenced by the client (26)** — no Flutter counterpart needed for parity:
- Queries: `getAllChapters`, `getAllComments`, `getBookByTitle`, `getBookTransactions`, `getBooksByAuthorId`, `getChaptersByAuthorId`, `getChaptersByBookId`, `getCommentsByUserId`, `getFollowersByUserId`, `getFollowingByUserId`, `getGenreBySlug`, `getMyTransactions`, `getSavedBooksByUserId`, `getUserByEmail`, `getUserByUsername`, `getUserReadingHistory`, `getUsersBooksByUserId`, `healthCheck`, `myPrintOrders`, `searchBooks`.
- Mutations: `createGenre`, `deleteGenre`, `deleteUserById`, `ping`, `updateBook`, `updateGenre`.

**Referenced in a document but the document is never imported/used** (dead client code, VERIFIED by search): `googleAuth`, `initializePayment`, `deleteQuote`, `toggleQuoteCommentLike`, `toggleParagraphCommentLike`, `addReadingMinutes`, `editMessage`, `getChapterById`, `getCommentById`; `register` and `markChapterAsRead` are defined/wrapped but the screens use `registerAndLogin` and `saveReadingProgress` (**INFERRED unused at runtime**). `toggleFollowUser`, `getAllBooks`, `getAllUsers`, `getAllTransactions`, `getBookBackers` are legacy/admin-era documents whose live usage should be confirmed in Stage 2.

Notable consequence: **the web UI cannot edit a book's title/description/cover after creation** (`updateBook` unused; only classification and status are editable) — admins can through the data editor.

## 9. Frontend-only logic that Flutter must re-implement

| Logic | Source | Why it matters |
|---|---|---|
| Session validation / expiry / revocation handling | `context/AuthContext`, `utils/authSession.js`, `utils/authLink.js` | server never returns 401 |
| Registration-intent replay | `utils/registrationIntent.js` | conversion flow parity |
| Reader start-position resolution | `utils/readerProgress.js` | resume behaviour |
| Progress sync writer (debounce, pending flag, retry) | `hooks/useReaderProgress.js` | offline tolerance |
| Reading-time tracker (ticks, idle, sequence, replay) | `utils/readingTracker.js`, `hooks/useReadingTracker.js` | points; server rejects malformed reports |
| Paragraph indexing of chapter HTML | `components/ParagraphComment/ParagraphRenderer` | bookmark & paragraph-comment addressing |
| Page counting (1200 chars/page) | `utils/htmlPageSplitter` | `pageCount` sent on save |
| Chapter autosave manager | `utils/chapterAutosave.js` | data-loss protection |
| HTML sanitising allow-list | `utils/richText.js` | safe rendering |
| Comment threading from flat list | `components/Comments/CommentList` | server returns flat list |
| Reversing lists (messages, session entries) | hooks | server ordering differs from display |
| Image crop + Cloudinary upload | `components/ImageUpload` | covers/avatars |
| Share URL construction | `utils/socialSharing.js` | link previews |
| Notification → destination mapping | `utils/notificationTarget.js` | navigation |
| Mention token detection/insertion | `components/Mentions/MentionInput.jsx` | composer UX |
| Classification form rules | `components/Books/Classification/ClassificationFields.jsx` | mirrors server limits |
| Feed filter coupling (sort ↔ funding) | `context/FiltersContext`, `hooks/useBookFeed.js` | server would otherwise reject |
| Derived display values (read time, “Popüler”, totals on profile, compact numbers, relative times, money) | `BookCard`, `UserProfilePage`, `utils/formatCount.js`, `components/PrintFunding/shared.jsx` | visual parity |
| Checkout idempotency key lifecycle | `pages/PrintCheckout` | safe retries |
