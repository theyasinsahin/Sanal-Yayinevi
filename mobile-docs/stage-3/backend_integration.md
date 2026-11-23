# Backend integration

The app uses the existing backend unchanged. The contract reference is Stage 1 (`stage-1/` API documents) as corrected by Stage 2.

## Endpoints

| Use | Endpoint |
|---|---|
| Queries and mutations | `POST {BETIK_API_URL}/` |
| Subscriptions | `{BETIK_WS_URL}` — default `ws(s)://<api host>/graphql`, sub-protocol `graphql-transport-ws`, token in `connection_init` |
| Print PDFs | `POST {BETIK_API_URL}/api/print/assets` (bearer token) |
| Share pages | `{BETIK_API_URL}/share/...` URLs returned by `getSocialShare` |
| Images | Cloudinary unsigned upload, then the URL is sent in the mutation |

## Documents

All operations are in `lib/core/api/documents.dart`. `evidence/validate_graphql_documents.cjs` parses that file and validates each document against the server's type definitions: **163 documents valid**, 2 built dynamically (leaderboard variants) skipped by the validator and exercised by the live test instead. Output: `evidence/graphql_validation.txt`.

Subscriptions used: `onNewMessage`, `onNewSessionEntry`, `myScoreUpdated`, `leaderboardUpdated`.

## Rules the client follows

| Backend behaviour | Client handling |
|---|---|
| JWT lasts 24 h; no refresh token | Local `exp` check; expiry → login with `returnTo` |
| Invalid or revoked token is treated as a guest, not an error | `me == null` while holding a token → sign out |
| `logout` revokes every device | Stated in the confirmation text |
| Some mutations report failure as `Status { code: 400, message }` inside a successful response | Mapped to `ApiException` like any other failure |
| Dates arrive as ISO strings, epoch milliseconds as strings, or numbers | One tolerant parser (`utils/format.dart`) |
| Login is limited to 10 attempts per e-mail per 15 minutes | Server message shown; the test suite logs in once per account |
| Chapter HTML is sanitised on the server; void elements come back as `<br />`, `<img … />` | Canonicalised before comparing or loading into the editor |
| Money is in minor units (kuruş) | Converted only for display and input |
| `startPrintCheckout` takes an idempotency key | One key per checkout attempt, reused on retry |
| Polling is the only source for unread counts | Notifications 15 s, messages 30 s, paused in the background |
| No push-notification support | None in the app (BLK-04) |

## What ran against a real backend

Disposable Stage 2 sandbox only (in-memory MongoDB, mail sink, the repository's server code on port 5055). `test/integration/live_api_test.dart`, 10 tests, all passing (`evidence/live_api_test_output.txt`): login and wrong password, feed with sort/filter/search, book and chapter creation with the HTML round trip through the server sanitiser, bookmark, paragraph comments, reading progress, reading-time report, quotes, book comments, conversation with real WebSocket delivery, funding queries, role checks (admin, publisher, member), follow request and cancel, logout revocation.

No request was sent to a production system. No payment was started.
