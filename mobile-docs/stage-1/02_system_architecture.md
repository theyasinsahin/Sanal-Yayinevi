# 02 — System Architecture

Stage 1 static analysis. See `01_repository_overview.md` for layout and stack.

## 1. Runtime topology

```text
                    ┌──────────────────────────────┐
  Browser (React)   │  Vercel static hosting       │   serves the SPA, rewrites
  ────────────────► │  Client build + vercel.json  │   /auth/google/callback → API
                    └──────────────────────────────┘
        │  HTTPS  POST <API>/            (GraphQL queries + mutations, Bearer JWT)
        │  WSS    <API>/graphql          (GraphQL subscriptions, graphql-transport-ws)
        │  HTTPS  <API>/api/print/*      (PDF upload/download, payment callbacks)
        │  HTTPS  <API>/share/:type/:id  (HTML link previews → redirect to web)
        ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ Node.js process  (Server/index.js)                            │
  │  Express ─ security headers ─ request shield ─ compression    │
  │   ├─ /api/print      printRoutes   (raw bodies, before JSON)  │
  │   ├─ /api/payment    legacy (410)                             │
  │   ├─ /share          socialShareRoutes                        │
  │   ├─ /auth/google    googleAuthRoutes                         │
  │   └─ /               Apollo Server (schema, budget, formatErr)│
  │  ws server on /graphql  → graphql-ws (subscriptions only)     │
  │  in-process PubSub      (graphql-subscriptions)               │
  │  print worker timer     (every 15 s: outbox, reservations,    │
  │                          reconciliation, refunds, settlement) │
  └───────────────────────────────────────────────────────────────┘
        │ Mongoose
        ▼
  MongoDB replica set (transactions)          External: Google Identity · Cloudinary (client-direct)
                                                        SMTP/Gmail · iyzico sandbox · ISBN lookup
```

**Flutter fits in as a second client of the same three API surfaces** (GraphQL HTTP, GraphQL WS, a few REST routes) plus direct Cloudinary uploads. No backend change is required for the core product.

## 2. Backend layering

```text
typedefs/*.graphql ──► schema.js (merge + secureRootFields wrapper)
                           │   every Query/Mutation root field: input checks + rate limit
                           │   every Book field: visibility re-check
resolvers/*.js ───────────►│   thin: authentication check, argument mapping, serialisation
services/*.js ────────────►│   business rules, transactions, notifications, points
utils/*Access.js ─────────►│   pure visibility predicates (book, chapter, profile, quote)
models/*.js ──────────────►│   Mongoose schemas (validation, indexes)
```

- **Context per HTTP request** (`index.js:159-168`): `{ ...models, user, req, currentUserId, pubsub, loaders }`. `user` is a Mongoose `User` document or `null`.
- **DataLoaders** (`graphql/loaders.js`): users (active only), books, chapters (without content), quotes, genres, classification terms, comment counts, first open chapter per book, latest campaign per book.
- **Resolver style is inconsistent** (several generations of code): some domains throw plain `Error`, newer ones throw `GraphQLError` with codes; some return `Status{code}` on failure. This matters for client error handling (`05_authentication_security.md` §9).
- **Transactions:** follow requests, score awards, reading-time reports, admin saves, printed-book review/claims and the entire print-funding domain use MongoDB multi-document transactions.
- **Background work:** only the print worker (`services/print/worker.js`, 15 s interval, in-process). No queue system, no cron, no push service.
- **Real time:** in-memory `PubSub` → events are **not shared between processes**. A horizontally scaled backend would deliver subscription events only to clients connected to the instance that handled the mutation (**INFERRED risk**; deployment topology UNKNOWN).

## 3. Frontend layering

```text
index.js → App.js
  GoogleOAuthProvider? → ApolloProvider → AuthProvider → ReadingPreferencesProvider
    → ToastProvider → FiltersProvider → RouterProvider (createBrowserRouter)
        RootLayout: RegistrationPrompt, ScrollToTop, ScoreUpdates, PageBoundary(<Outlet/>),
                    PersonalFoxes, InstallPrompt
pages/*        route-level screens (lazy loaded)
components/*   feature components + UI kit (components/UI: Button, Input, Textarea, Select, Badge,
               Typography, Toast, ProgressBar, PasswordStrengthIndicator, CompactNumber)
hooks/*        data hooks (book feed, messages, sessions, recommendations) and behaviour hooks
               (reader progress, reading tracker, chapter autosave, registration intent, live score)
graphql/*      gql documents (queries/, mutations/, feature files)
utils/*        pure logic (progress resolution, autosave manager, reading tracker, page splitter,
               rich-text sanitiser, sharing links, notification targets, auth session)
context/*      Auth, Filters, Toast, ReadingPreferences
config/*       API URLs, integration switches
```

- **State management:** no Redux/Zustand. Server state lives in the Apollo normalized cache; UI state in component state and four small contexts; persistence in `localStorage`/`sessionStorage` (inventory in `06_frontend_architecture.md` §6).
- **Data access:** exclusively GraphQL through Apollo, except four places that use `fetch` directly: reading-progress save and reading-time report on page exit (`keepalive`), PDF upload/download for print assets, Cloudinary upload, and share-image download.

## 4. Key cross-cutting flows

### 4.1 Authenticated request
`AuthContext.login()` stores `{token,user}` → `authLink` adds `Authorization: Bearer` → Express → Apollo context `authenticateUser` (verify JWT, load active user, compare `authVersion`) → resolver → service → Mongo → response → Apollo cache → component re-render. Invalid tokens degrade to guest silently on the server; the client clears the session on `UNAUTHENTICATED`.

### 4.2 Content visibility
Every read path combines: `inactiveUserIds()` (hide content of deleted/deactivated users) → `canReadBook` → `canReadChapter` / registration gate → field-level blanking (`Chapter.content`, `Quote.text`, `User.email`). The client mirrors the result through flags (`canReadContent`, `accessStatus`, `canViewProfile`, `canViewLibrary`, `canViewFollowList`, `canMessage`, `canEditContent`, `followStatus`) — **Flutter should drive its UI from these server-computed flags** rather than re-deriving rules.

### 4.3 Notifications
Services create `Notification` documents synchronously (`notifyUser`, `notifyMentions`, score awards, follow service) or through the print outbox. Delivery to the user is **pull-based**: the client polls `getUnreadNotificationCount` (15 s) and fetches `getNotifications` on demand. There is no push channel.

### 4.4 Points
Content actions call `scoreAwards.awardPoints` (idempotent per `(user, action, sourceId)`), which writes `PointEvent`, increments `UserScore`, creates a `POINTS_EARNED` notification, evaluates badges, and publishes `SCORE_UPDATED:<userId>` + `LEADERBOARD_UPDATED`.

## 5. Module interaction map (domains)

| Domain | Server modules | Client modules |
|---|---|---|
| Auth & account | `resolvers/user.js`, `services/userService.js`, `utils/auth.js`, `routes/googleAuthRoutes.js` | `context/AuthContext`, `utils/authSession.js`, `utils/authLink.js`, `pages/Auth/*`, `components/Settings/*` |
| Catalogue & classification | `bookCatalogService`, `bookService`, `classificationService`, `genreService` | `pages/Feed`, `pages/Landing`, `hooks/useBookFeed.js`, `components/Books/Classification/*`, `context/FiltersContext` |
| Book detail & authoring | `bookService`, `chapterService`, `print/applicationService.updateDigitalStatus`, `security/richText.js` | `pages/BookDetail`, `pages/CreateBookPage`, `pages/BookDashboard`, `utils/chapterAutosave.js`, `utils/htmlPageSplitter` |
| Reading | `utils/chapterAccess.js`, `readingProgressService`, `bookmarkService`, `readingService`, `paragraphCommentService` | `pages/BookReader`, `hooks/useReaderProgress.js`, `hooks/useReadingTracker.js`, `components/ParagraphComment/*`, `components/Quote/QuotePopup` |
| Social | `commentService`, `quoteService`, `followService`, `mentionService`, `notificationService` | `components/Comments/*`, `components/Quote/*`, `components/Follow/*`, `components/Mentions/*`, `components/Notification/*`, `pages/QuotesPage`, `pages/UserProfilePage` |
| Messaging | `messageService`, `resolvers/message.js` | `pages/MessagesPage`, `components/Messaging/*`, `hooks/useMessages.js` |
| Sessions | `sessionService`, `sessionAccessService`, `utils/sessionCover.js` | `pages/SessionsPage`, `pages/SessionDetail`, `hooks/useSessions.js`, `components/Sessions/*` |
| Score | `scoreService`, `scoreAwards`, `scoreUpdates`, `utils/scorePeriod.js` | `pages/LeaderboardPage`, `components/Score/ScoreUpdates`, `hooks/useLiveScoreQuery.js` |
| Printed catalogue | `printedBookService`, `printedReadingService`, `utils/printedBooks.js` | `pages/PrintedBooks`, `components/Books/Printed*` |
| Print funding | `services/print/*`, `models/printFunding.js`, `routes/printRoutes.js` | `pages/PrintApplication`, `pages/PrintCheckout`, `pages/FundingHistory`, `components/PrintFunding/*`, `pages/Admin/PrintFunding` |
| Sharing & URLs | `socialShareService`, `publicUrlService`, `routes/socialShareRoutes.js` | `components/Sharing/*`, `utils/socialSharing.js`, `utils/publicPaths.js`, `components/Route/PublicContentRoute.jsx` |
| Admin / publisher | `adminService`, `adminResources`, `adminVisibility`, `publisherService` | `pages/Admin/*`, `components/Admin/*`, `pages/PublisherPortal` |
| Community | `communityService`, `emails/templates.js` | `pages/Community`, `components/Navigation/Footer/*` |
