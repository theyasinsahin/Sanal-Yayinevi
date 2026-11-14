# 05 — Authentication & Security

Stage 1 static analysis. All statements **VERIFIED** from source unless marked otherwise. Paths are relative to the repository root.

## 1. Summary for the Flutter team

- Authentication is a **stateless JWT bearer token** sent as `Authorization: Bearer <token>` on every GraphQL HTTP request, and as `connectionParams.authorization` on the GraphQL WebSocket. **No auth cookies, no server sessions, no refresh token.**
- Token lifetime is **24 hours**, hard. There is **no refresh endpoint**; after expiry the user must log in again.
- Email/password login, e-mail-code registration, password reset and logout are all plain GraphQL mutations → **directly reusable by Flutter**.
- Google login has two server paths. The redirect path (`POST /auth/google/callback`) is browser-only (cookie-based CSRF + redirect to the web client). The **GraphQL `googleAuth(token)` mutation accepts a Google ID token directly** and is the mobile-compatible path, subject to an audience constraint (§5).
- CORS is irrelevant to a native Flutter client (requests have no `Origin`; the server explicitly allows origin-less requests). Apollo **CSRF prevention is on**, which constrains request content types (§7).

## 2. Token creation and validation

| Aspect | Detail | Evidence |
|---|---|---|
| Library / algorithm | `jsonwebtoken`, HS256, secret `JWT_SECRET` (≥32 bytes enforced at startup) | `Server/src/utils/auth.js:5-9`, `config/startup.js:7` |
| Claims | `{ userId, version }` + standard `iat`, `exp` | `services/userService.js:345,438,462` |
| Expiry | `expiresIn: '1d'`; verification also enforces `maxAge: '1d'` | same |
| Validation per request | 1) header must start with `Bearer `; 2) verify signature/age; 3) load user where `isDeleted:false`, `isActive≠false`, `loginBlocked≠true`; 4) `claims.version` must equal `user.authVersion` | `Server/index.js:159-168`, `utils/auth.js:12-39` |
| Invalid/expired token behaviour | **Silently treated as guest** (`user = null`). The server does **not** return 401. Protected resolvers then throw `"Giriş yapmalısınız"` which `formatError` maps to `extensions.code = 'UNAUTHENTICATED'` | `utils/auth.js:30-38`, `utils/formatError.js:37-46` |
| Revocation | Incrementing `User.authVersion` invalidates **all** tokens of that user | below |

`authVersion` is incremented by: `logout` (all devices), `changePassword`, `changeEmail`, `resetPassword`, `deactivateAccount`.

**Mobile implication:** a public query sent with an expired token still succeeds as a guest. Flutter must detect expiry itself (decode `exp`, or react to `UNAUTHENTICATED` on a protected operation, or a failing `me` query) — it cannot rely on HTTP 401.

## 3. Registration (two steps)

1. `sendRegistrationCode(email, username)` → validates email and username, rejects if either is taken, generates a 6-digit code, stores a bcrypt hash in `Verification` (TTL 10 min, attempts reset to 0), e-mails the code. Returns `Status{code:200}`; on any failure the resolver returns `Status{code:400, message}` **instead of a GraphQL error** (`graphql/resolvers/user.js:82-89`).
2. `registerAndLogin(username, fullName, email, password, code)` → validates all fields, consumes the code (max 5 attempts, 10-minute window), creates the user with `isVerified:true`, returns `RegistrationPayload{code, message, token, user}`. Failures again come back as `code:400` with a whitelisted message (`resolvers/user.js:8-16`). `register(...)` is the same without issuing a token.

Validation rules (server, `services/userService.js:35-41`, `utils/passwordValidation.js`):

| Field | Rule |
|---|---|
| email | ≤254 chars, regex `^[^\s@<>,;:"\\]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`, lower-cased |
| username | `^[\p{L}\p{N}_][\p{L}\p{N}_.-]{2,49}$` (3–50 chars, Unicode letters/digits/`_`, then also `.`/`-`) |
| fullName | trimmed length ≥2, length ≤120 |
| password | ≤72 UTF-8 bytes, ≥8 chars, ≥1 `A-Z`, ≥1 `a-z`, ≥1 digit, ≥1 non-alphanumeric |
| code | exactly 6 digits |

## 4. Login, logout, recovery

- **`login(email, password)`** → `AuthPayload{token, user}`. Generic error `"Giriş bilgileri geçersiz."` for unknown user, wrong password, deleted or blocked account (constant-time dummy hash compare). **Logging in reactivates a deactivated account** (`isActive=true`) (`userService.js:448-464`).
- **`logout`** → requires auth; increments `authVersion` → signs the user out **on every device** (`resolvers/user.js:64-68`).
- **`forgotPassword(email)`** → always returns the same neutral `Status` message. If the account exists, stores SHA-256 of a random 32-byte hex token (1 h expiry) and e-mails `${CLIENT_URL}/reset-password/<token>` (`userService.js:83-115`).
- **`resetPassword(token, newPassword)`** → token must be 64 hex chars; password rules as above; clears token, increments `authVersion`.
- **`changePassword(currentPassword, newPassword)`**, **`changeEmail(newEmail, currentPassword)`** → require the current password; both increment `authVersion` (the current token becomes invalid → client must re-login). `changeEmail` also sets `isVerified=false` and e-mails the new address (bcc the old one).
- **`deactivateAccount`** → `isActive=false`, `authVersion++`. **`deleteAccount`** → soft-delete cascade (see `04_database_schema.md` §5).

**Mobile deep-link note:** the reset link points at the web client (`/reset-password/:token`). A Flutter app can only complete the flow in-app if it registers that URL as an App Link / Universal Link, or lets the browser handle it (INFERRED recommendation; no backend change needed).

## 5. Google sign-in

### 5.1 Redirect path — browser only
`POST /auth/google/callback` (`Server/src/routes/googleAuthRoutes.js`):
- Expects an `application/x-www-form-urlencoded` body with `credential` and `g_csrf_token`, **plus a `g_csrf_token` cookie** that must match (double-submit CSRF from Google Identity Services redirect mode).
- Requires the ID token to carry a 64-hex `nonce` (`requireNonce:true`).
- Rate limit: 20 / 15 min per IP.
- On success **redirects** to `${CLIENT_URL}/auth/callback#token=…&user=…&nonce=…&newAccount=…`; on failure redirects to `${CLIENT_URL}/login?error=google_auth_failed` / `google_no_credential`.
- → Not usable from native Flutter (cookie + browser redirect to the web origin).

### 5.2 GraphQL path — mobile compatible
`googleAuth(token: String!): AuthPayload!` → `UserService.googleAuth` → `authenticateWithGoogleCredential(token)` with **no nonce requirement** (`userService.js:288-353`).
- Verifies the ID token with `google-auth-library` against **audience = `GOOGLE_CLIENT_ID`** (a single web client ID).
- Requires `email_verified === true`.
- Matching: by `googleSubject`; else by e-mail. Linking an existing password account by e-mail is only allowed if the address is `@gmail.com` or the token has an `hd` (Workspace) claim and the account is not linked to another subject; otherwise error `"Bu hesaba mevcut parolanızla giriş yapın; Google bağlantısı ayrıca doğrulanmalıdır."`.
- New account: `username = <email local part> + random 0–999`, random password, `isVerified:true`, `profilePicture` from Google.
- A soft-deleted account with the same e-mail blocks sign-up (`"Bu e-posta adresine ait hesap silinmiş."`).
- Rate limit: 20 / 15 min per IP.

**Mobile constraint (VERIFIED from code, runtime UNKNOWN):** the ID token's `aud` must equal the server's `GOOGLE_CLIENT_ID`. With `google_sign_in` this means configuring the **web client ID as `serverClientId`** so the returned `idToken` has the web client as audience. Android/iOS OAuth client IDs must exist in the same Google Cloud project. Whether the production project has those clients is **UNKNOWN** → see `11_unknowns_and_risks.md`.
In Docker development Google login is disabled unless `DEV_EXTERNAL_INTEGRATIONS=true` and `GOOGLE_CLIENT_ID` are set.

## 6. Roles and authorization

Roles (`User.role`): `USER` (default), `PUBLISHER`, `ADMIN`.

- There is **no declarative permission layer**; every resolver/service checks `context.user` itself. Admin checks go through `requireAdmin` (`utils/adminAccess.js`), which re-reads the user from the DB (`role:'ADMIN'`, active, not deleted) and throws `FORBIDDEN`.
- `PUBLISHER` gates the publisher portal (`publisherCatalog`); see `03_backend_api.md`.
- Session creation is gated by a per-user approval (`sessionCreationAccess.status === 'APPROVED'`), not by role; `isPremium` is deprecated.
- Ownership checks: book author / chapter author / comment owner / quote owner / message sender / session creator — detailed per operation in `03_backend_api.md` and `08_business_rules.md`.

### Visibility rules enforced server-side
| Rule | Function | File |
|---|---|---|
| Book readable: not deleted; DIGITAL → not DRAFT unless author/admin; PRINTED → `APPROVED` unless author/admin/submitter | `canReadBook` | `utils/bookAccess.js` |
| **Every field of `Book`** re-checks `canReadBook` and that the author is active → nested book references cannot leak (throws `FORBIDDEN`) | `secureRootFields` | `security/graphqlSecurity.js:79-89` |
| Chapter readable: book readable and (not hidden or author/admin). Guests see only the **first non-hidden chapter** when `REGISTRATION_GATE_ENABLED=true` | `chapterAccessStatus`, `canReadChapter` | `utils/chapterAccess.js` |
| `Chapter.content` is returned as `''` unless status is `READABLE`; content is re-sanitised on read | `Chapter.content` resolver | `graphql/resolvers/chapter.js:108` |
| Profile visible: self, admin, public profile, or viewer is a follower | `canViewProfile` | `utils/profileAccess.js` |
| Library / follow lists: profile visible **and** the specific privacy flag | `canViewLibrary`, `canViewFollowList` | same |
| Messaging: recipient's `allowMessages` (`everyone`/`followers`/`none`) | `canReceiveMessage` | same |
| Quotes: PUBLIC, or PRIVATE and owner; hidden-chapter quotes blank | `canReadQuote`, `requireQuote` | `utils/quoteAccess.js` |
| `User.email` returned only to self/admin (else `''`); settings objects only to self/admin (else `null`) | field resolvers | `graphql/resolvers/user.js:194,228-241` |

## 7. Transport-level controls

| Control | Detail | Evidence | Flutter impact |
|---|---|---|---|
| CORS | Allow-list: `capacitor://localhost`, `https://localhost`, `http://localhost`, `CLIENT_URL`, `CORS_ALLOWED_ORIGINS`, plus `http://localhost:3000` outside production. **Requests without `Origin` are allowed.** `credentials:true`. | `security/httpSecurity.js:3-12`, `index.js:68-73` | None for native apps (no Origin header). Flutter **web** would be blocked unless its origin is configured — out of scope (Android/iOS only). |
| Apollo CSRF prevention | `csrfPrevention: true` | `index.js:129` | Requests must be non-“simple”: send `Content-Type: application/json` (standard for `graphql_flutter`/`ferry`/`http`). `multipart/form-data` or `text/plain` bodies need an `Apollo-Require-Preflight` header. |
| Batching | `allowBatchedHttpRequests: false` | `index.js:130` | Do not enable HTTP query batching in the Flutter GraphQL client. |
| Introspection | Disabled when `NODE_ENV=production` | `index.js:128` | Generate Dart types from the repo's `.graphql` files, not from the live endpoint. |
| Body limits | JSON 2 MB; urlencoded 16 kB; compressed request bodies rejected (`inflate:false`) | `index.js:77-78` | Base64 images sent through GraphQL must keep the whole request under 2 MB; do not gzip request bodies. |
| Query budget | depth ≤12, fields ≤400, aliases ≤40, cost ≤20000, query ≤64 KiB, variables ≤1 MiB, ≤10000 tokens | `security/graphqlSecurity.js:7` | Keep generated operations within budget. |
| List arguments | any `limit`/`first` must be an integer 1–100; `offset` 0–10000 | `graphqlSecurity.js:36,59-60`, `security/pagination.js` | Validate client-side paging values. |
| String limits | `content` ≤500,000 chars; password/token-like keys ≤8192; all other strings ≤20,000; arrays ≤500 items; nesting ≤12 | `graphqlSecurity.js:48-64` | |
| Per-process shield | 900 requests / 60 s per IP → HTTP 429 `{error:'RATE_LIMITED'}` + `Retry-After` | `httpSecurity.js:39-52` | Handle HTTP 429 (non-GraphQL JSON body). |
| Operation rate limits (Mongo-backed, shared) | every root field: 600/min per IP; any mutation: 120/min per user (or IP); specific: `login` 20/15 min per IP + 10 per e-mail; `googleAuth` 20/15 min; `sendRegistrationCode` 5/15 min per IP + 3 per e-mail; `register`/`registerAndLogin` 15/15 min + 5 per e-mail; `forgotPassword` 5/15 min + 3 per e-mail; `resetPassword`, `changePassword`, `changeEmail` 10/15 min; `verifySessionAccessCode` 10/15 min; `startPrintCheckout` 15/min; `runPrintMaintenance` 2/min. Error: GraphQL `extensions.code='RATE_LIMITED'`, HTTP 429 | `security/rateLimit.js:31-51` | Many users behind one carrier NAT share an IP bucket (possible concern, **INFERRED**). |
| Contact/newsletter limiter | in-memory 10 / 15 min per IP → `TOO_MANY_REQUESTS` | `services/communityService.js:13-24` | |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, strict CSP, `Cache-Control: no-store`, HSTS in production | `httpSecurity.js:19-26` | `no-store` → do not rely on HTTP caching; cache in the GraphQL client. |
| Trust proxy | only explicit `TRUSTED_PROXY_CIDRS` | `httpSecurity.js:17` | — |
| HTTP timeouts | request 30 s, headers 15 s, keep-alive 5 s | `index.js:172-175` | Short keep-alive: expect connection re-establishment. |

## 8. WebSocket security (`security/websocketSecurity.js`, `index.js:105-122`)

- Endpoint: same host/port, path `/graphql`, protocol `graphql-transport-ws` (library `graphql-ws` v6).
- `connectionInitWaitTimeout` 5 s; max payload 64 KiB; no per-message deflate; ≤20 concurrent sockets per IP; `Origin`, if present, must be allow-listed (native clients send none).
- **Only subscriptions** are accepted over the socket (queries/mutations rejected); ≤5 concurrent subscriptions per socket; 60 subscribe operations/min per IP.
- Auth: optional `connectionParams.authorization = "Bearer <jwt>"`. It is read **at subscribe time**, and re-validated (user active, `authVersion` unchanged, token not expired) before each event is delivered; on failure the stream ends silently.
- All failures collapse into a single error: `"Abonelik isteği veya oturumu geçersiz."` (`code: BAD_REQUEST`).

**Mobile implication:** after the 24 h token expires or after login/logout, the Flutter client must close and reopen the socket with new `connectionParams`.

## 9. Error contract

`utils/formatError.js` shapes every GraphQL error:

| Situation | `message` | `extensions.code` |
|---|---|---|
| Mongoose validation error | `Validasyon Hatası` | `BAD_USER_INPUT` + `details: string[]` |
| Duplicate key | `Bu <field> adresi zaten kullanımda.` | `BAD_USER_INPUT` + `argumentName` |
| Message contains `Giriş yapmalısınız` or `Unauthorized` | original | `UNAUTHENTICATED` |
| Cast error (bad ObjectId) | `Geçerli bir kayıt kimliği veya alan değeri girin.` | `BAD_USER_INPUT` |
| Admin check | `Bu işlem için aktif yönetici yetkisi gerekiyor.` | `FORBIDDEN` |
| Rate limit | `Çok fazla deneme yapıldı…` | `RATE_LIMITED` (HTTP 429) |
| Any other uncoded error in **production** | `İşlem tamamlanamadı. Lütfen tekrar deneyin.` | `INTERNAL_SERVER_ERROR` |
| Any other error outside production | original Turkish message | `INTERNAL_SERVER_ERROR` |

**Important:** most business-rule errors are thrown as plain `new Error('<Turkish text>')` without a code. In production these are **masked** by the generic message above (`formatError.js:51`). Only errors created as `GraphQLError` with an explicit code (`BAD_USER_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `PAYMENTS_DISABLED`, `EMAIL_DELIVERY_FAILED`, `TOO_MANY_REQUESTS`, …) keep their message in production. → Flutter should branch on `extensions.code`, and cannot depend on message text for uncoded errors. Whether production really runs with `NODE_ENV=production` is **UNKNOWN** (deployment config is outside the repo) — verify in Stage 2.

Non-GraphQL JSON errors: `{error:'BAD_REQUEST'|'INTERNAL_SERVER_ERROR', message}` with 400/413/415/500 (`httpSecurity.js:54-58`); `{error:'SERVICE_BUSY'}` 503; print REST routes return `{error:<code>, message}` with 400/401/403/500/503.

## 10. Sensitive data handling

- Passwords: bcrypt cost 12. Reset tokens and newsletter tokens: SHA-256 hashes only. Registration codes: bcrypt.
- Session access codes are hashed (see `08_business_rules.md`).
- Shipping addresses for print orders are encrypted at rest with `PRINT_ADDRESS_ENCRYPTION_KEY` and only decrypted for the owner/admin (`graphql/resolvers/printFunding.js:76-81`).
- The web client stores the JWT in `localStorage` (see `06_frontend_architecture.md`). **Flutter must use platform secure storage** (Keychain / Keystore) instead.

## 11. Environment variables (names only)

`NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `CORS_ALLOWED_ORIGINS`, `TRUSTED_PROXY_CIDRS`, `GOOGLE_CLIENT_ID`, `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `CONTACT_EMAIL`, `CONTACT_PHONE`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_X_URL`, `SOCIAL_LINKEDIN_URL`, `SOCIAL_TIKTOK_URL`, `SHARE_ALLOWED_WEB_ORIGINS`, `REGISTRATION_GATE_ENABLED`, `PRINT_SYSTEM_ENABLED`, `PRINT_PAYMENTS_MODE`, `IYZICO_BASE_URL`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `PRINT_ADDRESS_ENCRYPTION_KEY`, `PRINT_SANDBOX_WEBHOOK_SECRET`, `API_URL`, `RENDER_GIT_COMMIT`, `BETIK_DOCKER_DEV`, `BETIK_ISOLATED_PRINT_SANDBOX`, `DEV_EXTERNAL_INTEGRATIONS`. Sources: `Server/.env.example`, `Server/.env.print.example`, `Server/src/config/*`. No values are recorded in this documentation.
