# 10 — Flutter Compatibility Assessment

Perspective: a new Flutter app for Android and iOS that reuses the existing Node.js backend **unchanged**. Classification: **CONFIRMED** (follows directly from source), **POSSIBLE** (depends on deployment/runtime facts not in the repository). Proposals are recommendations for Stage 3, not implementations.

## 1. Overall verdict

The backend is a token-authenticated GraphQL API with no cookie or browser-session dependency for its core. **All product features except those listed in §9 can be reproduced without backend changes.** The main work is re-implementing the frontend-only logic catalogued in `06_frontend_architecture.md` §9 and replacing browser APIs with native equivalents.

## 2. Authentication

| Topic | Status | Assessment |
|---|---|---|
| E-mail login, registration code, forgot/reset, change e-mail/password, logout, deactivate, delete | CONFIRMED reusable | Plain GraphQL mutations. |
| Token transport | CONFIRMED | `Authorization: Bearer` header (HTTP) and `connectionParams.authorization` (WS). No cookies. |
| Token storage | CONFIRMED requirement | Store JWT in Keychain/Keystore (e.g. `flutter_secure_storage`); never in plain preferences. |
| No refresh token; 24 h lifetime | CONFIRMED limitation | Mobile users must sign in again every 24 hours. Cannot be changed without a backend change. Mitigation that keeps the contract: none that preserves security (storing the password is not acceptable). → raise with product owner (Q-02). |
| Expired token = silent guest | CONFIRMED | App must check `exp` locally and treat `UNAUTHENTICATED` as sign-out; public queries will otherwise appear to “work” while signed out. |
| `logout` signs out every device | CONFIRMED | Same as web; on mobile, consider whether local-only sign-out is desired (would be a behaviour change → Q-03). |
| Password/e-mail change invalidates the current token | CONFIRMED | App must route to login afterwards. |
| Google sign-in | CONFIRMED path exists, POSSIBLE config gap | Use `google_sign_in` with `serverClientId` = backend `GOOGLE_CLIENT_ID`, send the ID token to `googleAuth(token)`. Needs Android (package + SHA-1) and iOS OAuth clients in the **same Google Cloud project**; nonce is not required on this path. The redirect endpoint is unusable natively. |
| Sign in with Apple | CONFIRMED absent | Apple's guideline 4.8 generally requires an equivalent privacy-focused login option when third-party login (Google) is offered on iOS. The backend has no Apple login → either omit Google login on iOS or add backend support (backend change). **Store-policy blocker to decide** (Q-04). |
| Password-reset e-mail link | CONFIRMED web link | `<CLIENT_URL>/reset-password/<token>`. Works in the browser as today. In-app handling requires App Links / Universal Links on the web domain (needs `assetlinks.json` / `apple-app-site-association` on the **web host**, not the backend). |
| Rate limits by IP | POSSIBLE concern | Mobile carrier NAT can put many users behind one IP (login 20 / 15 min per IP; registration code 5 / 15 min per IP). |

## 3. Network layer

| Topic | Status | Guidance |
|---|---|---|
| Endpoint | CONFIRMED | HTTP POST to API origin root (`/`), WS at `/graphql`. Make both configurable per environment. |
| Content type / CSRF prevention | CONFIRMED | Send `Content-Type: application/json`. If a library sends multipart, add `Apollo-Require-Preflight: true`. |
| No query batching | CONFIRMED | Disable batching. |
| Introspection off in production | CONFIRMED | Generate Dart models from `Server/src/graphql/typedefs/*.graphql` in the repo. |
| CORS | CONFIRMED irrelevant for native | Requests without `Origin` are allowed. |
| Request size | CONFIRMED | 2 MB JSON; no compressed request bodies. Matters for chapters with embedded base64 images and for base64 avatars. |
| List limits | CONFIRMED | `limit` 1–100, `offset` 0–10000, feed `limit` ≤48. |
| HTTP 429 / 503 | CONFIRMED | Non-GraphQL JSON bodies; handle with retry/backoff UI. |
| Error handling | CONFIRMED | Branch on `extensions.code`. Uncoded business errors are replaced by a generic message when the server runs in production mode → the app cannot rely on specific Turkish error texts (e.g. `QUOTE_EXISTS:`). Web has the same limitation. |
| Date formats | CONFIRMED mixed (format INFERRED) | Three shapes coexist: ISO strings (`DateTime` scalar and explicitly converted fields), **epoch-millisecond strings** (`String`-typed fields returned straight from Mongoose: e.g. `Notification.createdAt`, `Quote.createdAt`, `QuoteComment.createdAt`, `ParagraphComment.createdAt`, `UserBadge.earnedAt`, `Genre.createdAt`), and the client also tolerates numbers. Write one tolerant parser; confirm each field in Stage 2. |
| WebSocket | CONFIRMED | `graphql-transport-ws`; reconnect with new params on auth change; ≤5 subscriptions per socket. |
| TLS / cleartext | POSSIBLE | Local Stage 2/3 testing uses `http://localhost:5000` (Android emulator: `10.0.2.2`); requires cleartext exceptions in debug builds only. |

## 4. Storage replacements

See `06_frontend_architecture.md` §6. Summary: secure storage for the session; a local key-value/DB store for reading progress (per user + guest), unsent reading-time buffer and font-size preference; in-memory state for registration intent and checkout idempotency key (persist the latter across app restarts within a checkout).

## 5. Feature-by-feature compatibility

| Area | Status | Notes / native approach |
|---|---|---|
| Discovery, feed, filters, search, recommendations, authors | CONFIRMED reusable | Straight GraphQL. |
| Book detail, like/save/follow, comments, mentions | CONFIRMED reusable | — |
| Reader | CONFIRMED reusable, **high effort** | Needs an HTML renderer that (a) honours the Quill class/tag allow-list, (b) renders each top-level `<p>` as an addressable block (paragraph index parity for bookmarks/comments), (c) supports text selection with a custom “quote” action, (d) reports scroll position. `flutter_html`/custom span builder or a locked-down WebView are the two candidate strategies; the choice affects selection and performance (Stage 3 decision). |
| Reading-time points | CONFIRMED reusable | Port `ReadingTracker`; use app-lifecycle (`paused`/`resumed`) instead of `visibilitychange`; flush on pause. The server tolerates gaps but rejects time faster than real time. |
| Progress sync & bookmarks | CONFIRMED reusable | Port resolution algorithm; flush on lifecycle pause. |
| Copy protection | CONFIRMED browser-specific | Native equivalent: remove “Copy” from the selection toolbar or copy the same notice text. Product decision (Q-05). |
| Quote creation | CONFIRMED reusable | `location.startOffset/endOffset` are DOM range offsets; the server only stores them and the web never reads them back → mobile may send text-based offsets or omit them (optional fields). |
| Writing dashboard / editor | CONFIRMED reusable, **high effort / fidelity risk** | Content contract = Quill-flavoured HTML. A Flutter editor must emit HTML within the server allow-list (e.g. `flutter_quill` + Delta→HTML conversion matching Quill's output: `<p>`, `<h1>/<h2>`, `<strong>`, `<em>`, `<u>`, `<s>`, `<blockquote>`, `<ol>/<ul><li>`, `<a>`, `<img>`), and parse existing HTML back for editing. Round-trip differences would alter content created on the web. Alternative that preserves fidelity exactly: embed the Quill editor in a WebView for the editing surface only. Also port autosave and the 1200-char page counter. |
| Images in chapters | POSSIBLE limitation | Web (INFERRED) embeds base64 images in HTML; large photos from phones will exceed the 450k-char per-image and 2 MB request limits → downscale before embedding, or upload to Cloudinary and insert the URL (allowed by the sanitiser: `img src` http/https). |
| Cover / avatar / session-cover upload | CONFIRMED reusable | `image_picker` + crop (2:3, 16:9) + direct unsigned Cloudinary upload. Needs cloud name + preset in app config. Session covers **must** be Cloudinary URLs. |
| Sessions incl. private codes & live entries | CONFIRMED reusable | Subscription with `accessCode` variable. |
| Messaging | CONFIRMED reusable | Live only for the open conversation; unread badge by polling. No message push (see §6). |
| Notifications list & deep links | CONFIRMED reusable | Port `notificationTarget` mapping to in-app routes (ids are provided in `meta`). |
| Follow system, profile, settings | CONFIRMED reusable | — |
| Leaderboard, badges | CONFIRMED reusable | — |
| Printed catalogue, ratings, claims, submissions | CONFIRMED reusable | ISBN lookup is server-side. A barcode scanner would be a mobile enhancement, not parity. |
| Sharing | CONFIRMED reusable | `share_plus` with the same `<API>/share/...` URL; optional image from the web host. |
| Print application (author) | CONFIRMED reusable | PDF pick (`file_picker`) → `POST /api/print/assets` raw body with `Content-Type: application/pdf`, `X-Filename`; download → save/open file. |
| Support checkout (iyzico sandbox) | CONFIRMED reusable with **return-flow limitation** | Hosted page must open in an in-app browser tab; after payment iyzico's callback redirects to the **web** URL `<CLIENT_URL>/funding-history`. Without backend change the app can (a) detect that navigation inside a WebView/Custom Tab and close it, then poll `myFundingPayment`, or (b) rely on Universal/App Links for that path. Both preserve the contract. |
| In-app purchase policy | POSSIBLE store-policy risk | Donations and physical pre-orders are generally outside IAP requirements (physical goods / donations have specific rules, esp. on iOS for non-charity donations). Currently sandbox-only, so no real payments exist. Must be reviewed before any live payment launch (Q-06). |
| Publisher portal, admin panel | CONFIRMED reusable | Scope decision pending (Q-01). |
| Contact, newsletter, legal, about | CONFIRMED reusable | Legal texts are bundled in the web client (`pages/Community/legalDocuments.js`) → copy into the app or link to the website. |
| PWA install prompt, service worker, SEO meta/canonical, robots | CONFIRMED not applicable | Drop. |
| Decorative `PersonalFoxes` | POSSIBLE | Cosmetic; confirm in Stage 2. |

## 6. Capabilities users expect on mobile that the backend cannot provide

| Capability | Status | Detail |
|---|---|---|
| **Push notifications** | CONFIRMED blocker for push | No device-token registration, no FCM/APNs sender. Parity with the web (in-app list + badge by polling) is fully achievable; real push requires backend work. Local notifications from foreground polling are possible but do not work when the app is closed. |
| Background message delivery | CONFIRMED | Same cause. |
| Offline reading | CONFIRMED absent in product | Web has none (service worker caches the shell only — **INFERRED**); not required for parity. |
| Token refresh / long-lived sessions | CONFIRMED | See §2. |

## 7. Deep linking

| Link | Source | Mobile handling |
|---|---|---|
| `/kitap/<slug>`, `/kitap/<slug>/oku`, `/kitap/<slug>/bolum/<chapterSlug>` | shares, notifications | `resolvePublicRoute(type: BOOK, reference, chapter)` → ids → screen |
| `/yazar/<username>` | shares | `resolvePublicRoute(PROFILE)` |
| `/oturum/<slug>` | shares | `resolvePublicRoute(SESSION)` |
| `/quotes/<id>` | shares | direct id |
| Legacy `/book-detail/<id>`, `/book-reader/<id>?chapter=…&paragraph=…`, `/user/<id>`, `/sessions/<id>#entry-<id>` | old links, notification targets | ids directly (or `legacy: true`) |
| `<API>/share/<type>/<key>` | every shared link | This is an **API-host** URL that redirects to the web. To open the app from shared links, either register App/Universal Links for the web domain paths above (after the redirect) or for the API host's `/share/*` path. Requires association files on those hosts — a **hosting change outside the backend code** (Q-07). Without it, shared links open the website (acceptable fallback, same as today). |
| `/reset-password/<token>`, `/newsletter?...` | e-mails | web fallback or App Links |
| `/funding-history` | iyzico return | see §5 |

## 8. Platform permissions and device integrations

| Need | Android | iOS |
|---|---|---|
| Network | `INTERNET` | ATS: HTTPS in production |
| Photo library (covers, avatars) | photo picker (no permission on modern Android) | `NSPhotoLibraryUsageDescription` |
| Camera (optional enhancement) | `CAMERA` | `NSCameraUsageDescription` |
| File pick/save (print PDFs) | SAF | document picker |
| Google sign-in | SHA-1 + OAuth client | URL scheme + OAuth client |
| App/Universal Links (optional) | `assetlinks.json` | `apple-app-site-association` |
| Push (not available) | — | — |

No location, contacts, microphone or Bluetooth needs exist in the product.

## 9. Features that cannot be faithfully reproduced without backend (or hosting) changes

1. **Push notifications** (not a web feature either; expectation gap, not a parity gap).
2. **Sign in with Apple** if Google sign-in is offered on iOS (store requirement, backend change).
3. **Sessions longer than 24 h** without re-login.
4. **Opening the app directly from shared links / e-mail links** (needs association files on web/API hosts).
5. **Payment return into the app** via redirect (work-around exists client-side).

Everything else in the feature inventory is reproducible against the current contract.

## 10. Other observations relevant to mobile

- **Existing Capacitor Android wrapper** (`com.betik.app`): decide whether the Flutter app replaces it and whether it reuses the application id/signing key (Q-08).
- **Language:** Turkish only; Turkish-specific casing (`i/İ/ı/I`) matters for local search/filter (`toLocaleLowerCase('tr-TR')` on web → use Turkish-aware lowering in Dart).
- **Time zone:** leaderboard periods and writing weeks are computed in Europe/Istanbul on the server; the client only displays.
- **`Genre.hexColor`** may contain the CSS expression `var(--primary)` (model default) or `#RRGGBB` → map non-hex values to the app's primary colour.
- **Avatar/cover URLs** may be Cloudinary URLs, arbitrary http(s) URLs (Google profile photos — web sets `referrerPolicy="no-referrer"`), root-relative paths (e.g. `/images/sessions/default-cover.jpg`, served by the **web host**, so prefix with the web origin), or `data:` URIs.
- **Session default cover and social-share images live on the web host**, not the API.
- **Accessibility and compact number/currency formatting** use `tr-TR` Intl rules → `intl` package.
