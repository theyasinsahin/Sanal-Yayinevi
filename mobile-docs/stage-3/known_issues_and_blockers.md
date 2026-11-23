# Known issues and blockers

## Blockers (need something outside the repository)

| ID | Blocker | Affects | What unblocks it |
|---|---|---|---|
| BLK-01 | No Google OAuth clients available. Native integration complete and checked up to Google's sign-in screen; no real sign-in has succeeded | F-AUTH-03 | Web client ID (= backend `GOOGLE_CLIENT_ID`), an iOS client ID, Android client(s) for `com.betik.mobile` + SHA-1, a Google test account — exact steps in `google_sign_in_setup.md` |
| BLK-02 | App Store guideline 4.8: Google login on iOS requires an equivalent privacy-focused login; the backend has no Sign in with Apple. Google stays enabled on iOS (product requirement), so an iOS store submission carries review risk | iOS store release | Owner decision on the options in `google_sign_in_setup.md` (recommended: Apple login, which needs a backend mutation) |
| BLK-03 | No Cloudinary cloud name / unsigned preset | Real uploads. **Narrowed in the verification pass:** pick → validate → crop → JPEG → multipart request → URL stored by the server was verified on both platforms against a local stand-in (`BETIK_CLOUDINARY_API_BASE`); only the real account and the system photo picker remain | The values the website uses, passed as dart-defines |
| BLK-04 | Backend has no push-notification support (no device-token API, no sender) | Notifications arrive only while the app is open | Backend work; out of Stage 3 scope |
| BLK-05 | No link-association files on the web host; production host unknown | https links (password reset, newsletter, shared links) open the website, not the app | `apple-app-site-association`, `assetlinks.json`, entitlement and intent filter |
| BLK-06 | iyzico sandbox not configured | The iyzico hosted-checkout path only. **Narrowed:** the server's built-in mock provider (`PRINT_PAYMENTS_MODE=SANDBOX`, the Stage 2 approach) was used to execute checkout, success, failure, cancel, history, refund, settlement and pre-order handling on both platforms; no real payment was started | A configured iyzico sandbox merchant for the hosted page |
| BLK-07 | No signing identities, store accounts, final application id, production endpoints | Release | Owner input (Stage 2 Q-08) |
| ~~BLK-08~~ | Resolved in the verification pass: Android 15 (API 35) emulator `betik_p8`; all suites run on it | — | Physical devices still untested |

## Open questions for the owner

1. Paragraph numbering (D-07): top-level `<p>` only, as the website's code does?
2. Sign in with Apple, or iOS without Google?
3. Final application id and display name.
4. Should the app keep the stricter username rule on profile edit?
5. Legal texts are drafts on the website; the app copies them. Who signs them off before a store listing? A privacy policy URL is mandatory for both stores.

## Known defects and limits in the app

| Area | Issue |
|---|---|
| Reader | Touch selection → "Alıntıla" verified on the iOS simulator and Android emulator (long-press + drag); a physical-device pass is still advisable (handles, magnifier) |
| Reader | Copy protection is best-effort: screenshots are not prevented (neither does the website) |
| Editor | Chapters that do not round-trip open read-only; there is no in-app way to fix them — edit on the website |
| Editor | Only the formats the website's toolbar offers are available; inline colours are not shown |
| Sessions | The creator skips the access gate on the client; if the server ever requires the code for creators, the gate appears as a fallback |
| Registration intent | Only book comments and reading progress are restored automatically after sign-up; other actions return to the screen |
| Lists | Cursor paging of the feed could not be exercised (too little sandbox data) |
| Feedback | A toast (3.5 s, closable) can cover a bottom button while visible — Material default behaviour, noted for the owner |
| Editor | Typing with the real **iOS** soft keyboard could not be driven from the host (simulator); the platform text-input path was tested. Real Android Gboard typing was verified manually |
| Admin | Admin write screens were executed (record editor with reason and optimistic lock, moderation, reviews, print funding, tariffs, maintenance, orders). Reject paths of the printed/claim queues and order SHIPPED/DELIVERED transitions were not driven |
| Layout | Phone portrait only was looked at; tablets get the phone layout stretched |
| Theme | Light theme only |
| Dependency | `flutter_quill` relies on the Material library that Flutter has deprecated (D-06) |
| Android | Namespace `com.betik.betik` differs from the application id `com.betik.mobile`; harmless, but tidy it when the final id is chosen |
| Assets | `assets/images/fox.png` is bundled but unused |

## Defects fixed in the verification pass

V-01 … V-10, see `verification_log.md` (stale form errors, Android idle-connection failure, mention list crash, comment-link scrolling, broken recommendations tab, off-screen create-book errors, iOS editor copy/paste crash, reader blocked by a hidden chapter, Turkish upper-casing, feed controller used after dispose).

## Server behaviour noted (not changed; not app defects)

- Pre-orders can be moved (PACKAGING…) only after the campaign has **succeeded** and production has reached PRINTED; refunds of a succeeded campaign require cancelling production first. The app shows the server's message in both cases.
- The admin data browser's free-text search matched nothing for a comment's text in the sandbox; the list itself and status filters work.

