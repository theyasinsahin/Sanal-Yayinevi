# 09 — External Integrations and Real-Time Communication

Stage 1 static analysis.

## 1. Real-time: GraphQL subscriptions over WebSocket

| Item | Value | Evidence |
|---|---|---|
| URL | `ws(s)://<API host>/graphql` | `Server/index.js:105-109`, `Client/src/config/api.js` |
| Protocol | `graphql-transport-ws` (library `graphql-ws` v6 on both sides) | `Server/package.json`, `Client/package.json` |
| Auth | `connectionParams: { authorization: "Bearer <jwt>" }` (empty string for guests) | `Client/src/App.js`, `Server/src/security/websocketSecurity.js` |
| Allowed operations | subscriptions only | `websocketSecurity.js:18` |
| Limits | 5 subscriptions/socket, 20 sockets/IP, 60 subscribes/min/IP, 64 KiB frames, init within 5 s | `index.js`, `websocketSecurity.js` |
| Event bus | in-process `PubSub` (not shared across instances) | `Server/src/config/pubsub.js` |

| Subscription | Topic | Published by | Client consumer |
|---|---|---|---|
| `onNewMessage(conversationId)` | `NEW_MESSAGE` | `messageService.sendMessage` | `hooks/useMessages.js` (open chat only) |
| `onNewSessionEntry(sessionId, accessCode)` | `NEW_SESSION_ENTRY` | `sessionService.addSessionEntry` | `hooks/useSessions.js` |
| `myScoreUpdated` | `SCORE_UPDATED:<userId>` | `scoreUpdates.publishScoreUpdate`, called from `scoreAwards.awardPoints` (all point awards) and `readingService` | `components/Score/ScoreUpdates.jsx` |
| `leaderboardUpdated` | `LEADERBOARD_UPDATED` | same | `pages/LeaderboardPage` |

Behaviour to reproduce in Flutter:
- Re-create the socket whenever the signed-in user/token changes (web: `wsClient.terminate()`).
- Streams end **silently** when the token expires or `authVersion` changes; the client must resubscribe after re-login.
- There are **no events for** message edit/delete/read, session entry delete/like, notifications, follow requests, comments or quotes. Those rely on polling/refetch.
- Flutter library must speak `graphql-transport-ws` (not the legacy `subscriptions-transport-ws` protocol).

## 2. Polling inventory (web behaviour)

| Data | Interval | Gate |
|---|---|---|
| Unread notification count; notifications while panel open | 15 s | tab visible |
| Incoming follow requests (panel open) | 15 s | ≤20 loaded |
| Profile while follow request pending | 15 s | — |
| User score, badges, leaderboard, rank | 15 s (+ subscription + focus) | visible |
| Unread message count | 30 s | visible |
| Session-creation access status | 30 s (+ focus) | visible |
| Book funding panel | 30 s | visible |
| Checkout overview, payment status, funding history, admin campaigns | 15 s | visible |
| Admin printed-book queue | 30 s | visible |
| Session validation (`me`) | 60 s (+ focus) | visible |

A mobile app should keep comparable freshness while respecting battery (poll only in foreground, on screen).

## 3. Server-Sent Events / other channels

None. No SSE, no long polling endpoints, **no push-notification service** (no FCM/APNs/web-push code, no device-token storage in any model).

## 4. External services

### 4.1 Google Identity Services — sign-in
- Server: `google-auth-library` `OAuth2Client.verifyIdToken` with audience `GOOGLE_CLIENT_ID` (`Server/src/services/userService.js:281-303`).
- Web: `@react-oauth/google` redirect mode; production relies on a same-origin rewrite (`Client/vercel.json`) so the `g_csrf_token` cookie reaches the API.
- Mobile path: `googleAuth(token)` mutation (see `05_authentication_security.md` §5 and `10_mobile_compatibility.md` §2).
- Disabled in Docker dev unless explicitly enabled.

### 4.2 Cloudinary — image hosting
- **Client-direct unsigned upload** to `https://api.cloudinary.com/v1_1/<cloudName>/image/upload` with `upload_preset`; the backend only stores the returned URL (`Client/src/components/ImageUpload/index.jsx`). Cloud name and preset come from client build config (`Client/src/config/integrations.js`).
- Used for: book covers (required at creation), session covers (server **requires** a `res.cloudinary.com/.../image/upload/...` URL), profile pictures.
- Display: `utils/ImageUtils.getOptimizedImage(url, w, h)` inserts `c_fill,w_<w>,h_<h>,q_auto,f_auto` after `/upload/` for Cloudinary URLs and leaves other URLs untouched.
- Disabled in Docker dev by default → image upload features are unavailable there unless a preset is configured (Stage 2 prerequisite).
- Other image sources accepted by the backend: any `http(s)` URL or root-relative path (book cover, avatar); `data:image/(png|jpeg|webp);base64` inside chapter HTML.

### 4.3 E-mail (SMTP via nodemailer)
- Transport: Gmail service by default, or custom `SMTP_HOST/PORT/SECURE`; 12-second hard deadline; no retry (`Server/src/config/smtp.js`).
- Messages (`Server/src/emails/templates.js`): registration code, password reset link, e-mail-changed notice, contact-form relay, newsletter confirmation. Samples in `email-previews/`.
- Links inside e-mails point to the **web client** (`CLIENT_URL`): `/reset-password/<token>`, `/newsletter?token=…&action=…`.
- Failure surfaces as GraphQL code `EMAIL_DELIVERY_FAILED` or a `Status{code:400}`.

### 4.4 iyzico — payments (sandbox only)
- Provider abstraction `Server/src/services/print/paymentProvider.js` with two providers: internal `SANDBOX` mock (dev/test only, signed webhook) and `IYZICO_SANDBOX` (`iyzicoProvider.js`, hosted checkout form). The config explicitly accepts only `https://sandbox-api.iyzipay.com` (`paymentConfig.js`); **no live mode exists in code**.
- Flow: server creates a checkout form → client opens `checkoutUrl` (iyzico-hosted) → iyzico POSTs to `/api/print/iyzico/callback/:reference` → server reconciles → redirects browser to `${CLIENT_URL}/funding-history`.
- Legacy `Server/src/config/iyzico.js` + `Transaction` flow is disabled.

### 4.5 ISBN lookup
- `lookupPrintedBook` performs a **server-side** HTTP request to an external bibliographic API and maps title, authors, publisher, year, pages, cover (`Server/src/services/printedBookService.js:83-100`; response field names `number_of_pages`, `publishers`, `authors` — **Open Library**: `https://openlibrary.org/isbn/<isbn>.json`, author records, covers from `covers.openlibrary.org`). Requires sign-in. Failure → `found:false`.

### 4.6 Hosting-level integrations (INFERRED)
- Vercel (frontend hosting, rewrite for Google callback), Render (backend; `RENDER_GIT_COMMIT` → `X-App-Revision` header). Not required by a mobile client.

### 4.7 Capacitor (existing Android wrapper)
- `Client/capacitor.config.ts`: `appId com.betik.app`, `androidScheme: 'http'`, cleartext allowed; origins `capacitor://localhost`, `http(s)://localhost` are pre-allowed in server CORS for it. Build tooling in `docker/android.sh`, `.github/workflows/android-build.yml`. Only `@capacitor/core` and `@capacitor/android` are installed — **no native plugins** (no push, camera, share or deep-link plugins).
- Relevance: application id `com.betik.app` is already in use by the wrapper build → coordinate the Flutter application id / signing (see risks).

## 5. Share-preview endpoint
`GET <API>/share/:type/:id?webOrigin=<origin>` — documented in `03_backend_api.md` §14. `webOrigin` must equal `CLIENT_URL` in production (dev also allows localhost and `SHARE_ALLOWED_WEB_ORIGINS`). Preview images are static files on the **web host**: `/social-share/link-preview.jpg`, `/social-share/<type>.jpg`, `/social-share/default.jpg` (`Client/public/social-share/`), or the session cover.
