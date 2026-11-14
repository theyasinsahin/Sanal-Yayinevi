# 12 — Coverage Assessment and Stage 2 Preparation

## Part A — Stage 1 coverage

Method: static reading only. No server, build, test, script, migration or database command was executed; no file outside `mobile-docs/` was created or changed in the repository (temporary working files were kept in a session scratch directory outside the project).

Reading depth legend: **Full** = read line by line · **Condensed** = read with imports, styling attributes and blank lines stripped and long lines truncated (logic, handlers, texts and API calls visible; some JSX conditions may be cut) · **Extract** = only rule-bearing lines (exports, throws, limits, queries) were read · **Listed** = identified by name/size/usage, content not read.

### A.1 Backend (`Server/`)

| Area | Files | Depth |
|---|---|---|
| Entry, config (`index.js`, `src/config/*`) | 10 | Full |
| GraphQL typedefs | 28 | Full |
| GraphQL resolvers, schema, loaders | 30 | Full |
| REST routes | 4 | Full |
| Security (`src/security/*`) | 8 | Full |
| Models | 37 files / 52 models | Full |
| Utils | 17 | Full (`auth`, `formatError`, access helpers, catalog/editorial validators) |
| Services: user, follow, book, bookCatalog, bookFollow, bookFunding, bookmark, chapter, comment, community, genre, mention, message, notification, paragraphComment, readingService, sessionAccess, publicUrl, scoreUpdates, writing | 20 | Full |
| Services: quote, session, score, scoreAwards, readingProgress, recommendation, classification, socialShare, publisher, transaction, printedBook, printedReading | 12 | Extract + selected full sections |
| Services: `print/*` (common, paymentConfig, application, campaign, payment, asset, worker, paymentProvider) | 8 | Extract + selected full sections |
| Services: `print/addressCrypto`, `print/iyzicoProvider`, `print/migration`, `printedCatalogImportService`, `printedEditorialService`, `classificationMigration` | 6 | Listed |
| Services: admin (`adminService`, `adminResources`, `adminVisibility`) | 3 | Extract |
| `emails/templates.js`, `data/classification.js` | 2 | Extract (function list) |
| `scripts/*` | 18 | `seedDevelopment.js` Full; others Listed |
| `tests/*` | 59 | Listed (names used as a behaviour index) |

### A.2 Frontend (`Client/src`)

| Area | Depth |
|---|---|
| `App.js`, `index.js`, `config/*`, `context/*`, `components/Route/*` | Full |
| `utils/`: authSession, authLink, registrationIntent, googleLoginNonce, readerProgress, readingTracker, chapterAutosave, htmlPageSplitter, chapterContent, chapterVisibility, notificationTarget, socialSharing, richText, cropImage, formatCount, publisher, admin, publicPaths, PasswordValidation, ImageUtils, scoreUpdates | Full |
| `utils/`: FilterBooks, genreDisplay, quoteCache | Listed |
| `hooks/`: useReaderProgress, useReadingTracker, useChapterAutosave, useBookFeed, useContentTarget, useLiveScoreQuery, useRegistration, useSessionCreationAccess, useRecommendations, useMessages | Full / Condensed |
| `hooks/useSessions.js` | Listed (behaviour derived from `SessionDetail` and the server) |
| Pages: Auth (5), Landing, Feed, BookDetail, BookReader, BookDashboard, CreateBookPage, SessionsPage, SessionDetail, UserProfilePage, QuotesPage, QuoteDetail, MessagesPage, LeaderboardPage, PrintedBooks, PrintCheckout/DonationPage, PrintApplication, FundingHistory, PaymentResult | Condensed |
| Pages: Admin/* (8), PublisherPortal, Community, NotFoundPage | Extract |
| Components: Navigation (bar, mobile menu), Notification, Registration, Follow, Feed, Landing (Hero, FeaturedBooks), Books (BookCard, BookFollowButton, Classification Fields/Editor/Filters, Printed*, BackersSection), Comments, Mentions (MentionInput), ParagraphComment, Quote (QuotePopup, QuoteCard, ProfileQuoteGroups), Sessions, Settings (all 7), Messaging (all 4), Sharing, Score, PrintFunding (shared, panel, payment card, application details), ImageUpload | Condensed |
| Components: Footer (+Newsletter, SocialLinks), Landing/HowItWorks, Landing/TrustedPublishers, InstallPrompt, PersonalFoxes, ScrollToTop, Layout, Logo, UI kit, Admin (layout/table), Books (BookGrid, BookCarousel, BookShareButton, CatalogBackLink, HiddenChapterNotice, ClassificationSummary, GenrePreferenceChoices, CostCalculatorModal), Mentions/MentionText, Quote/QuoteVisibility, Recommendation/ReasonBadge | Extract or Listed |
| `graphql/**` documents | Parsed programmatically for root-field usage; selected documents read; field selections of each query **not** transcribed |
| CSS (`*.css`), tests (`*.test.jsx`), `e2e/*`, `public/*`, `android/*` | Listed (out of scope: styling, generated code) |

### A.3 Repository-level

`README.md` (Full), `compose.yaml` (most), `dev` (Extract), `docs/docker-development.md` (Extract), `Client/vercel.json`, `capacitor.config.ts`, `.env.example` files (Full; contain no secrets), other `docs/*` (Listed).

### A.4 Explicit coverage gaps

1. **GraphQL selection sets** used by each web screen are not listed per feature (only root fields). Stage 3 should derive Dart queries from `Client/src/graphql/**` directly.
2. **Print-funding internals** (`iyzicoProvider`, `addressCrypto`, settlement/refund algorithms) and **admin per-resource side effects** are covered at rule level, not line level.
3. **Recommendation weights** not transcribed.
4. **Static/marketing components and the UI kit** not read in full; copy and layout are for Stage 2 observation.
5. **Tests** were not read; they may encode edge cases not captured here.
6. **Existing `docs/`** were not reconciled document-by-document against code (only the root README discrepancies are recorded).
7. Some JSX render conditions were truncated in condensed reads (flagged with “verify” in the feature files, e.g. F-BOOK-06, F-FUND-05).

**Assessment:** all application-owned backend contract surfaces (schema, resolvers, routes, security, models) and all route-level screens were inspected; counts in the documentation come from scripts over the source, not estimates. The gaps above do not affect the API inventory, schema or feature identification; they affect depth in the back-office and funding internals and exact UI copy.

### A.5 Count verification

| Count | Value | How obtained |
|---|---|---|
| GraphQL queries / mutations / subscriptions | 104 / 102 / 4 | script over `typedefs/*.graphql` |
| REST/HTML routes | 7 | manual from `src/routes/*` |
| Mongoose models | 52 | `mongoose.model` registrations (35 single-file + 17 in `printFunding.js`) |
| Client-referenced root fields | 184 of 210 | script over `gql` documents |
| Features | 156 | `### F-` headings across `07a–07f` |
| Route entries / screens | 51 / 35 | `App.js` router table |

---

## Part B — Stage 2 preparation (nothing below was executed)

### B.1 Local runtime prerequisites

| Need | Detail |
|---|---|
| Docker-based stack (documented path) | `./dev init` then `./dev up` (`compose.yaml`): MongoDB 8 single-node replica set `rs0`, seed job, API on `127.0.0.1:5000`, web on `localhost:3000`. The `dev` script expects a Linux/WSL-style environment (`stat -c`, local Docker socket) — **verify it runs on macOS** or use the manual path. |
| Manual path | Node 26.x / npm 11.x, MongoDB replica set, `Server/.env` (`MONGO_URI`, `JWT_SECRET` ≥32 bytes, `CLIENT_URL`), `npm ci` in both packages (installs dependencies → requires explicit approval because it writes `node_modules` inside the project). |
| Seed data | 4 users `admin@`, `author@`, `reader@`, `publisher@betik-dev.invalid` (roles ADMIN, USER, USER, PUBLISHER; shared password = `DEV_SEED_PASSWORD` from the local Docker env file), 1 published book with 1 hidden + 3 open chapters, 1 draft, 1 approved printed book, 1 sample tariff. |
| Flags in the dev stack | `REGISTRATION_GATE_ENABLED=true`, `PRINT_SYSTEM_ENABLED=true`, `PRINT_PAYMENTS_MODE=SANDBOX` (mock provider with simulate buttons), `NODE_ENV=development` (error messages **not** masked — differs from production). |
| Disabled by default in the dev stack | SMTP (registration codes, reset mails, contact, newsletter), Google login, Cloudinary uploads. Enabling needs `DEV_EXTERNAL_INTEGRATIONS=true` plus separate development accounts. |

Consequences for Stage 2: **new-account registration, password reset, book creation (cover upload is mandatory), session/ avatar covers** cannot be exercised unless integrations are enabled or test data is prepared another way. Decide before Stage 2 how to cover them.

### B.2 Roles and personas to test

Guest · Member (reader) · Author (owner of books) · Follower vs. non-follower of a private profile · Approved session creator vs. not approved · Publisher · Admin · Second member account for chat/follow/mentions · Deactivated account (re-login).

### B.3 Features requiring runtime verification (priority order)

1. **Wire formats:** date fields (U-04), error shapes in dev vs. production mode, `Status{code}` failures, HTTP 429 body.
2. **Auth lifecycle:** F-AUTH-01/02/04/05/06/08, token invalidation after F-SET-01/02, deactivated login.
3. **Reader:** F-READ-01…13 — resume priority, registration gate with a guest, hidden chapter as author vs. reader, bookmark/paragraph indices, paragraph comments, quote popup (new / duplicate / repost / private), reading points accrual and idle handling, copy behaviour.
4. **Authoring:** F-WRITE-04/05 — HTML emitted by each toolbar action, image insertion format (U-08), `pageCount` values sent, autosave timing, leave-with-unsaved flow; F-BOOK-08 transitions and the +50 award (U-11).
5. **Social:** follow request lifecycle across two accounts and all privacy combinations; mentions and resulting notifications; every notification type → target (F-NOT-02).
6. **Messaging & sessions:** real-time delivery, unread counts, private session code, followers-only access, close session.
7. **Feed:** search folding, filter coupling, cursor paging, recommendations onboarding.
8. **Printed catalogue:** submission → admin approval → rating/quote/claim → claim approval → adding chapters.
9. **Print funding (mock sandbox):** application → admin approval → campaign → checkout → simulate payment → history → refund; idempotent retry.
10. **Sharing:** generated URLs and preview page per type.
11. **Admin/publisher** (if in scope, Q-01).
12. D-items in `11_unknowns_and_risks.md` §3.3.

### B.4 Important state transitions

Book `DRAFT ↔ PUBLISHED/WRITING → COMPLETED`; chapter hidden ↔ visible; follow `NOT_FOLLOWING → PENDING → FOLLOWING / cancelled / rejected`; session active → closed; session access `NONE → PENDING → APPROVED/REJECTED → revoked`; printed book `PENDING → APPROVED/REJECTED`; claim `PENDING → APPROVED/REJECTED`; print application, campaign, payment, reservation, refund, order and production state machines (`08_business_rules.md` §11, `07f`); account active ↔ deactivated → deleted; notification unread → read; reading session started → replaced/expired.

### B.5 Forms and validation scenarios

All forms in `06_frontend_architecture.md` §5 with boundary values (min/max lengths, invalid formats, duplicates: e-mail, username, ISBN, quote, tag), plus server-only rules that the UI does not pre-validate (username format, full-name length, session title/description length, entry length 5000, message content).

### B.6 Error and edge cases

Expired/invalid token mid-session; second device login/logout; network loss during autosave, progress save, reading report and checkout; rate-limit thresholds (login, registration code, access code — use sparingly, windows are 15 minutes); content of deactivated users disappearing; deleted book/chapter targets in notifications and shares; empty states of every list; very long content; opening legacy id URLs.

### B.7 Potentially destructive actions to isolate (use throw-away data only)

| Action | Effect |
|---|---|
| Delete account (F-SET-08) | irreversible soft-delete cascade — use a disposable user, **never** a seeded role account |
| Deactivate account (F-SET-07) | reversible by login |
| Delete book (F-BOOK-08) | cascades to chapters/comments/quotes |
| Delete chapter, comment, paragraph comment (hard delete), message, session entry | content loss |
| Close session (F-SESS-10) | permanent |
| Logout | revokes all sessions of that user |
| Change e-mail / password | invalidates sessions; changes seeded credentials |
| Admin record editor, reviews, role changes, archive/restore (F-ADM-03…) | can lock out admins, hide content |
| Campaign close, production cancel, refunds, maintenance run | financial state (sandbox) |
| Rate-limit exhaustion | blocks the IP/account for the window |
| `./dev down -v` or any volume removal | destroys the local database (do not run without approval) |

Stage 2 must run **only against the isolated local stack**, never against production services, and should snapshot or re-seed the database between destructive scenarios.

### B.8 External dependencies during Stage 2

Local: Docker, MongoDB image, Node image (network pulls). Optional and off by default: SMTP account, Google OAuth client, Cloudinary preset, iyzico sandbox keys. Open Library is contacted by the server only when ISBN lookup is used.
