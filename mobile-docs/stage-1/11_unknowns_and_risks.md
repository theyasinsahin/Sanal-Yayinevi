# 11 — Unknowns, Risks and Open Questions

Stage 1 static analysis. Each item states impact and the evidence needed to resolve it.

## 1. Decisions needed from the product owner

| ID | Question | Why it matters | Default assumption if unanswered |
|---|---|---|---|
| Q-01 | Must the **admin panel** (13 features) and **publisher portal** be in the mobile app? | ~9% of the feature inventory; wide-screen back-office tools | Not in the first mobile release; remain web-only |
| Q-02 | Is a **24-hour forced re-login** acceptable on mobile? | Backend has no refresh token; cannot change without backend work | Accept (parity with web) |
| Q-03 | Should mobile “Çıkış Yap” keep signing out **all devices** (current backend behaviour)? | Multi-device users | Keep (parity) |
| Q-04 | Offer **Google sign-in on iOS**? Doing so likely triggers Apple's requirement for Sign in with Apple, which the backend lacks | App Store review | Android: Google + e-mail; iOS: e-mail only until decided |
| Q-05 | How should **copy protection** in the reader translate to native text selection? | Behavioural fidelity vs. platform conventions | Selection toolbar offers “Quote” only; copy places the same notice text |
| Q-06 | Is the **print-funding / checkout** flow (sandbox-only, “no real money”) in mobile scope? | Store payment policies; hosted checkout return flow | Include read-only campaign info + interest toggle; decide checkout separately |
| Q-07 | Can **App Links / Universal Links** association files be published on the web (and/or API) host? | Opening shared, e-mail and payment-return links in the app | No → links open the website |
| Q-08 | Does the Flutter app **replace the Capacitor Android wrapper** and reuse `com.betik.app`? | Application id, signing, store listing continuity | New Flutter project in a separate directory; id decided before Stage 3 |
| Q-09 | Is the **rich-text editor** required in the first mobile release, and is a WebView-hosted Quill acceptable for exact fidelity? | Highest-risk feature for content fidelity | Native editor only if HTML round-trip is proven in Stage 2/3 spikes |

## 2. Unknowns (cannot be determined from the repository)

| ID | Unknown | Impact | Evidence needed |
|---|---|---|---|
| U-01 | Production environment configuration: `NODE_ENV`, `REGISTRATION_GATE_ENABLED`, `PRINT_SYSTEM_ENABLED`, `PRINT_PAYMENTS_MODE`, SMTP, `GOOGLE_CLIENT_ID`, `CORS_ALLOWED_ORIGINS`, proxy settings | Error-message masking, guest reading gate, feature visibility, Google login | Deployment settings (Render) or observation of production responses |
| U-02 | Production API and web hostnames | App configuration, deep links | Confirmation from the team (`vercel.json` shows a Render hostname; `.env.example` shows a Vercel hostname in a comment) |
| U-03 | Whether the production backend runs more than one instance | In-memory PubSub → missed subscription events | Deployment topology |
| U-04 | Exact wire format of `DateTime` and `String` date fields per type | Date parsing | Stage 2 network capture |
| U-05 | Live database contents vs. schema (legacy documents without `digitalStatus`, `visibility`, `urlSlug`, etc.) | Fallback logic (already mirrored in client) | Stage 2 with seeded + legacy-shaped data; production sampling by the team |
| U-06 | Google Cloud project: existence of Android/iOS OAuth clients, ownership | Mobile Google sign-in | Access to the Google Cloud console |
| U-07 | Cloudinary account limits and whether the unsigned preset accepts uploads from non-browser clients / is restricted by folder or format | Image upload from mobile | Test upload in Stage 2/3 with a dev preset |
| U-08 | How images are inserted by the web editor (base64 inline vs. upload) | Editor parity, request size | Stage 2 observation of saved chapter HTML |
| U-09 | Behaviour of `User.draftBooks`, `favouriteAuthors`, `followedBooks` GraphQL fields (no resolver) | Avoid using them | Not needed if unused |
| U-10 | Runtime role of `PersonalFoxes`, `CostCalculatorModal`, `HowItWorks`, `TrustedPublishers`, exact footer links | Minor UI parity | Stage 2 visual pass |
| U-11 | Whether web publish awards the +50 points (UI sends `status:'WRITING'`, award is tied to `'PUBLISHED'`) | Score parity | Stage 2 test |
| U-12 | Where `requestPrintRefund` is exposed in the member UI | Funding parity | Stage 2 |

## 3. Risks

### 3.1 Architectural / backend-contract risks

| ID | Risk | Likelihood | Impact | Mitigation within constraints |
|---|---|---|---|---|
| K-01 | **Uncoded business errors are masked in production** (`formatError.js:51`); features depending on message text (duplicate quote `QUOTE_EXISTS:`, access-code errors detected by the substring `kodu`, form error texts) degrade to a generic message | High if production uses `NODE_ENV=production` | UX | Rely on pre-checks (`checkQuoteExists`, `verifySessionAccessCode`) and error codes; generic fallback copy |
| K-02 | Invalid/expired tokens silently become guest requests | Certain | Subtle bugs (empty private data) | Client-side expiry check + `me` validation |
| K-03 | No refresh token | Certain | Daily re-login | Product decision (Q-02) |
| K-04 | In-memory PubSub; no events for edits/deletes/reads | Certain / topology-dependent | Stale chat/session UI | Refetch on resume/focus, polling |
| K-05 | Mixed error conventions (`Status{code:400}` vs GraphQL errors vs HTTP JSON errors) | Certain | Client complexity | One error-normalising layer |
| K-06 | Mixed date encodings | Certain | Parsing bugs | Tolerant parser, per-field tests |
| K-07 | Mixed pagination styles; some lists unpaginated (`getConversations`, `getCommentsByBookId`, `getQuotesByUser`, followers arrays in profile, `getNotifications` fixed 20) | Certain | Performance on large accounts | Client-side virtualization; accept limits |
| K-08 | IP-based rate limits behind mobile carrier NAT | Possible | Login/registration failures at scale | Surface `RATE_LIMITED` clearly; raise with backend team |
| K-09 | Weak server validation on `updateProfile` and message content | Certain | Data quality | Validate in the app at least as strictly as registration rules |
| K-10 | `getOrCreateConversation` is a mutating **query**; clients/libraries that auto-retry or prefetch queries may create conversations | Low | Stray empty conversations | Call explicitly, never prefetch |
| K-11 | No API versioning; web and mobile share one evolving schema | Certain | Breaking changes for installed app versions | Tolerant decoding, feature flags by `printPaymentMode`-style probes; agree change process |

### 3.2 Mobile-specific risks

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| M-01 | Reader HTML fidelity (Quill classes, images, paragraph addressing, selection) | Core experience | Early technical spike; golden tests against chapters created on the web |
| M-02 | Editor round-trip fidelity | Content corruption for web-authored books | WebView Quill fallback or strict converter with tests (Q-09) |
| M-03 | Paragraph index mismatch | Bookmarks/comments attach to wrong paragraph across platforms | Port the exact segmentation rule; cross-platform tests |
| M-04 | Page-count algorithm mismatch | Different `pageCount` when saving from mobile | Port `htmlPageSplitter` exactly, test with shared fixtures |
| M-05 | Reading-time reports rejected (`READING_TOO_FAST`, sequence errors) after backgrounding | Lost points, error banners | Port tracker state machine; lifecycle handling |
| M-06 | No push notifications | Engagement expectations | Communicate; foreground polling only |
| M-07 | App Store: Google login without Apple login; account deletion (available ✔); payments policy | Review rejection | Q-04, Q-06 |
| M-08 | Large images vs. 2 MB request / 450k-char data-URI limits | Failed saves | Downscale/Cloudinary URLs |
| M-09 | Assets served by the web host (default session cover, share images, relative avatar paths) | Broken images | Prefix with configured web origin |
| M-10 | Turkish locale handling (case folding, formatting) | Search/format differences | `tr_TR` everywhere |
| M-11 | Existing wrapper app id collision | Release logistics | Q-08 |

### 3.3 Observed defects / inconsistencies in the existing product (do not “fix” silently)

| ID | Observation | Evidence |
|---|---|---|
| D-01 | Register page links terms to `/kullanim-kosullari`, which has no route (→ Not Found) | `pages/Auth/Register`, `App.js` |
| D-02 | Quotes cannot be deleted from the UI although the API exists | repository search |
| D-03 | Message edit, quote-comment like and paragraph-comment like exist in API but not in UI | component sources |
| D-04 | Book title/description/cover cannot be edited after creation (web) | `updateBook` unused |
| D-05 | Profile avatar upload uses the 2:3 book-cover crop | `pages/UserProfilePage` → `ImageUpload` defaults |
| D-06 | `ShareModal` logs props to the console; several actions swallow errors silently | `components/Messaging/ShareModal`, `QuoteCard` |
| D-07 | Private-session gate is shown to the creator as well | `pages/SessionDetail` |
| D-08 | Session entry like for guests shows a toast instead of the registration prompt used elsewhere | `pages/SessionDetail` |
| D-09 | `updateAuthorSettings` ignores `defaultLanguage` / `publishingVisible`; 5 notification flags are not editable | `services/userService.js:176-181`, `NotificationSettings` |
| D-10 | README describes a page-flip reader and chart-based admin that do not exist | `01_repository_overview.md` §7 |

For each D-item the Flutter app should **reproduce the functional behaviour** (per the fidelity requirement) unless the product owner approves a correction; they are listed so that deviations are explicit decisions.

## 4. Blockers

There is **no blocker for Stage 2**. For Stage 3, items Q-01, Q-04, Q-06, Q-08 and Q-09 should be decided before implementation planning; U-01/U-02/U-06/U-07 need information from the team that owns deployment and third-party accounts.
