# Stage 3 verification pass — progress log

Work log of the runtime verification pass (instructions: `mobile-docs/stage-3-verification.md`). The authoritative per-feature status stays in `feature_parity_matrix.md`; this file records environment, batches, scenario results, defects and fixes.

Status: **complete** (23 Nov 2026). Final regression of all eight suites on both platforms: see "Final regression" below. Per-feature results are applied to `feature_parity_matrix.md`.

## Environment (17 Nov 2026)

| Item | Value |
|---|---|
| Sandbox | Fresh copy of the Stage 2 isolated stack in the session scratch directory (`…/scratchpad/sb`): repository `Server/` and `Client/` copied, never edited in place |
| Database | MongoDB 8.0.34 single-node replica set `rs0`, `127.0.0.1:27055`, database `betik_stage2` (new, empty, then seeded) |
| Seed | `seedDevelopment` steps (4 users, 3 books, 4 chapters, 1 tariff), `seedClassification`, `seedBadges`, the Stage 2 draft-description repair |
| API | `node index.js`, port 5055, `NODE_ENV=development`, `PRINT_SYSTEM_ENABLED=true`, `PRINT_PAYMENTS_MODE=SANDBOX` (built-in mock provider), `REGISTRATION_GATE_ENABLED=true` |
| Network exposure | The API binds to all interfaces in its own code. A preload (`--require loopback.cjs`, test tooling only) forces every listening socket of the process onto `127.0.0.1`; confirmed with `lsof` (5055, 27055, 2555 and 5066 all on 127.0.0.1) |
| Mail | Local SMTP sink `127.0.0.1:2555`; stores every mail as JSON, relays nothing |
| Secrets | Generated fresh with `openssl rand` into a mode-0600 env file; the repository `.env` files were not read or used |
| Images | Cloudinary is replaced by a local stand-in (`http://localhost:5066/v1_1/<cloud>/image/upload`) that checks the multipart request (preset, JPEG body), stores the file locally and answers like Cloudinary with a `https://res.cloudinary.com/betik-sandbox-mock/...` URL. The app reaches it through the new `BETIK_CLOUDINARY_API_BASE` define; nothing leaves the machine |
| Payments | Server mock provider only (`SANDBOX`). No iyzico call, no real money |
| Test control | Host-side helper on `127.0.0.1:5066`: mail sink reader, read-only sandbox DB queries (plus resetting rate-limit buckets and two documented fixture resets), device screenshots (`simctl io` / `adb screencap`), `adb input` |
| iOS | iPhone 17 simulator, iOS 27.0 (`9E3DFC6D-…`), Xcode via `DEVELOPER_DIR` |
| Android | New AVD `betik_p8`: Pixel 8 profile, Android 15 (API 35) Google APIs arm64 image, Gboard; `adb reverse` for 5055 and 5066 |
| Flutter | 3.50.0 stable, Dart 3.14 |
| Physical devices | **None.** All results below are simulator/emulator results |

## How the scenarios run

`Client/mobile/integration_test/v0N_*_test.dart` start the real app (`BetikApp`) on the device and drive it through its widgets (taps, text entry through the platform text-input channel, scrolling, long-press and drag gestures). Each scenario checks the UI **and** the backend effect (database row, mail in the sink, upload received). A failed scenario is recorded and the suite continues. Results go to the device log (`SCENARIO|platform|suite|id|PASS/FAIL/SKIP|…`) and to the host log. Screenshots are real device screenshots in `evidence/screenshots_v/<platform>_<suite>_<name>.png`.

Run: `flutter drive --driver=test_driver/integration_test.dart --target=integration_test/v01_auth_nav_test.dart -d <device> --dart-define=BETIK_API_URL=http://localhost:5055 --dart-define=BETIK_WEB_URL=http://localhost:3055 --dart-define=BETIK_TEST_PASSWORD=<seed> --dart-define=BETIK_TEST_CTL=http://localhost:5066 --dart-define=BETIK_CLOUDINARY_CLOUD_NAME=betik-sandbox --dart-define=BETIK_CLOUDINARY_UPLOAD_PRESET=betik-sandbox-preset --dart-define=BETIK_CLOUDINARY_API_BASE=http://localhost:5066`. Disposable backend only.

Limits of the method, stated once:

- Text is entered through the platform text-input channel (what a keyboard sends), not by tapping keys. Under `flutter drive` the system keyboard cannot be shown, so **real-keyboard typing was verified separately** on Android in a normal debug run driven by `adb` (see Batch 4).
- System sheets (share sheet, photo library, document picker) cannot be driven. The image and PDF pickers have test seams (`debugPickImageOverride`, `debugPickPdfOverride`); everything after the pick (validation, crop, upload, server) is the production path.

## Batches

Scenario-level results (latest run per platform; a scenario ID names the matrix features it covers).

### Batch 1 — authentication, navigation, community (`v01_auth_nav_test.dart`)

| Scenario | iOS | Android | What was checked (UI + backend) |
|---|---|---|---|
| F-NAV-05 | PASS | PASS | Unknown path → "Bu Sayfa Kitapta Yok"; both buttons navigate |
| F-NAV-02 | PASS | PASS | Guest drawer via the menu button; member-only entries absent |
| F-COM-01 | PASS | PASS | About page sections; "Kitapları keşfet" → feed |
| F-COM-04/07 | PASS | PASS | Newsletter: invalid e-mail and missing consent refused; subscribe → confirmation mail in the sink → link opened in the app → "Aboneliğimi doğrula" → subscription `active` in the DB; malformed link → notice |
| F-COM-02/06 | PASS | PASS | Contact: client rules; send → mail with the message (Turkish letters intact) to the contact address; contact info block |
| F-COM-03 | PASS | PASS | Terms and privacy drafts; "İletişime geçin" → contact |
| F-AUTH-01 | PASS | FAIL→fixed (V-02) | Empty-field messages; wrong password refused, not signed in |
| F-AUTH-02/07 | PASS | PASS | Register: validation, strength meter (Zayıf → Güçlü), terms required, code mail, 60 s resend label, short and wrong code refused (stays on step 2), correct code → signed in → own profile; user row exists |
| F-AUTH-06 | PASS | PASS | Member drawer → Çıkış Yap → login screen; the old token no longer identifies the user on the server |
| F-AUTH-04/05 | PASS | PASS | Forgot: invalid e-mail; reset mail; pasted link; invalid link and mismatch refused; reset → old password refused, new accepted; reused link refused |
| F-AUTH-09 | PASS | PASS | Guest → login with `returnTo` → back on the guarded page; member sent away from `/admin` and `/publisher`; signed-in user sent away from `/login` |
| F-NAV-04 | PASS | PASS | `/kitap/<slug>`, `/kitap/<slug>/oku`, `/yazar/<username>`, legacy `/book-detail/<id>` resolve; unknown slug → not found |

### Batch 2 — discovery, book detail, comments, sharing (`v02_discovery_book_test.dart`)

| Scenario | iOS | Android | What was checked |
|---|---|---|---|
| F-AUTH-10 | PASS | PASS | Guest like / save / follow open the matching sign-up prompt; nothing stored |
| F-DISC-03g | PASS | PASS | Guest "Senin için" → registration card |
| F-DISC-02 | PASS | PASS | Search hit, empty state + "Filtreleri temizle", sort (En Popüler), "Hedefe en yakın" couples the funding filter, reset |
| F-DISC-02c | PASS | PASS | Format filter (Şiir → none, cleared → list back) |
| F-DISC-04/03/07 | PASS after V-05 | PASS | Onboarding → `userpreferences` row (2 genres, completed) → recommendations list → "Tercihlerim" → edit to 3 genres stored |
| F-BOOK-01/02 | PASS | PASS | Card → detail (metadata, Özet); author link → profile |
| F-BOOK-03 | PASS | PASS | Like, persists across reopening, unlike, like — `likedBy` on the server each time |
| F-BOOK-04 | PASS | PASS | Save / unsave with toasts; `savedBooks` on the server |
| F-BOOK-05 | PASS | PASS | Follow / unfollow; `isFollowingBook` from the server |
| F-BOOK-07 / F-SHARE-01 | PASS | PASS | Share sheet: copy link (`/share/book/…?webOrigin=…`) and copy text+link |
| F-COMM-02/06 | PASS after V-03 | PASS | Comment with an @mention chosen from the live suggestion list; stored; author notified |
| F-COMM-04 | PASS | PASS | Like / unlike a comment (`likedBy`) |
| F-COMM-03 | PASS | PASS | Reply prefilled with `@user`; stored with `parentId` |
| F-COMM-05 | PASS | PASS | Delete: cancel keeps, confirm soft-deletes |
| F-NOT-01/02 | PASS after V-04 | PASS | Author's badge rises; mention notification → book at the comment |
| F-BOOK-08/09/10 | PASS | PASS | Author on detail: publish (cancel keeps DRAFT) → WRITING → COMPLETED → DRAFT, delete with confirm → gone; guest/other user then gets "Kitap bulunamadı" |

### Batch 3 — reader (`v03_reader_test.dart`)

All scenarios PASS on iOS and on Android (18/18 each; see the final regression for the Android emulator note).

| Scenario | iOS | What was checked |
|---|---|---|
| F-READ-10 | PASS (expectation corrected to the website's J-05) | Guest: chapter 1 readable; bookmark → sign-up prompt; "Tamamla ve Devam Et" → "Hikâyeye devam et" sheet; chapter list marks gated chapters; nothing stored on the server |
| F-READ-13 | PASS | h1/h2, bold/italic/underline/strike/link, blockquote, ol/ul, image paragraph, empty paragraph rendered; exactly 5 bookmark buttons for 5 top-level `<p>` |
| F-READ-06 | PASS | Bookmark on the 2nd `<p>` stores `paragraphIndex` 1 (the h1 before it is not counted); restored on reopen; moved to index 4; removed |
| F-READ-07 | PASS | Paragraph panel; comment stored with `paragraphIndex` 1; count badge; delete; close |
| F-READ-08a/b/c | PASS | Real long-press + drag selection; "Alıntıla" in the selection menu; <10 characters refused; sheet → quote stored with note, spoiler flag, chapter id and index; same passage again → "Bu alıntı zaten kayıtlı." |
| F-READ-09 | PASS | Menu offers only Alıntıla / Kopyala; Kopyala puts the website notice with the book link on the clipboard, not the text |
| F-READ-16 | PASS | 60-paragraph chapter: progress bar 0 → >0.3 → >0.95 |
| F-READ-03/04 | PASS | Complete & continue → `completedChapters` on the server; previous; revisited chapter shows "Sonraki Bölüm"; last chapter "Tamamla" + "✦ SON ✦"; all three completed |
| F-READ-02/15 | PASS | Drawer counts; unchecking a chapter updates the server; select chapter; "Kitap Detayına Dön" |
| F-READ-01 | PASS | Fresh app instance, same account → resumes at chapter 3 |
| F-READ-12 | PASS | Chapter share link `/share/chapter/…` |
| F-READ-11 | PASS | View counter incremented by reader visits |
| F-READ-05 | PASS | Reading session created for the book; heartbeat `sequence` advances while reading (reports accepted) |
| F-READ-03h | PASS after V-08 | Hidden chapter in the middle: notice, then "Sonraki Bölüm" continues |
| F-READ-10h | PASS | Hidden chapter: reader gets no text; author sees it with "Okuyuculara kapalı" and no share button |

### Batch 4 — authoring and the native editor (`v04_authoring_test.dart`)

| Scenario | iOS | Android | What was checked |
|---|---|---|---|
| F-WRITE-01/02/03 | PASS after V-06 | PASS | Validation summary; cover picked → centre-cropped → JPEG → multipart upload with preset to the sandbox stand-in; format + 2 genres; draft saved; DB row (DRAFT, cover URL, genres) |
| F-WRITE-04/09 | PASS | PASS | Empty state; publish disabled with the website's notice; empty title refused; new chapter opens at once (deliberate difference D-x); hidden chapter created hidden |
| F-WRITE-05a | PASS | PASS | Toolbar H1 / normal / bold / italic / bullet list + keyboard-channel typing → autosave → stored HTML `<h1>Açılış</h1><p>Düz metin <strong>kalın</strong> ve <em>italik</em> çğıöşü.</p><ul><li>madde bir</li><li>madde iki</li></ul>`, pageCount 1 |
| F-WRITE-05b | PASS | PASS | Undo removes the edit, redo restores it, undo again; saved state without it |
| F-WRITE-05k | SKIP (iOS: simctl cannot type) | SKIP in the suite; **PASS manually** | Normal Android debug run, adb touches only: real tap on the editor opens Gboard (`mInputShown=true`); typed text and Enter reach the editor; autosave stored `…<li>Gercek klavyeyle yazildi</li><li>ikinci satir</li></ul>` (Enter inside a list makes a new item, as Quill does). Evidence `android_manual_editor_real_keyboard.png` |
| F-WRITE-05c | PASS after V-07 | PASS | Word selected by double-tap (iOS) / long-press (Android); toolbar "Kopyala" → clipboard = word; caret at end → "Yapıştır" → text inserted; saved |
| F-WRITE-05d | PASS | PASS | Reader shows the formatted text; reopening the editor does not rewrite the stored HTML |
| F-WRITE-05e | PASS | PASS | Website-shaped chapter (h1, h2, inline formats, link, blockquote, ol, ul, base64 image, empty paragraph) opens editable; appended paragraph saved; all original markup kept |
| F-WRITE-05f | PASS | PASS | Markup the editor cannot write (h4, span, pre) → read-only notice, no toolbar, stored HTML unchanged |
| F-WRITE-06/08/07 | PASS | PASS | Hide / show from the chapter menu (`isHidden` on the server); publish from the bar; share chapter link; complete |
| F-WRITE-04d | PASS | PASS | Delete chapter: cancel keeps, confirm deletes, "Bölüm silindi" |
| F-BOOK-09 / F-WRITE-02e | PASS | PASS | Classification editor in the dashboard drawer: 3rd genre added, saved, stored |
| F-WRITE-10 | PASS | PASS | "Okuyucu Modu" opens the reader |
| F-WRITE-guard | PASS | PASS | Another member opening the dashboard gets an access message, no editor (stricter than the website, which shows the editor and fails on save — Stage 2) |

### Batch 5 — profile, settings, follow, messaging, quotes, notifications (`v05_social_test.dart`)

Two disposable members (A, B) registered through the mail code; every scenario PASS on iOS and Android (26/26 each).

| Scenario | What was checked |
|---|---|
| F-PROF-01/02 | Own profile: name, bio, avatar upload (stand-in) stored; username rule enforced |
| F-PROF-05 | Share profile → `/share/profile/…` link on the clipboard |
| F-PROF-07 | Profile quotes tab groups quotes by book |
| F-SET-03 | Private profile + messages closed stored; another member sees the restricted profile |
| F-SET-04 | Notification preference toggled and stored; save button only when changed |
| F-SET-05 | Invalid weekly goal refused; valid values stored |
| F-SET-06 / F-NAV-11 | Large reading size kept on the device and used by the reader |
| F-FOLLOW-01 | Follow request sent, withdrawn, sent again (request rows) |
| F-NOT-03 / F-FOLLOW-02 | A rejects in the notifications panel; B asks again; A accepts → follow stored |
| F-FOLLOW-03 | B notified of the acceptance; tap opens A's profile |
| F-PROF-04 / F-MSG-02/03/04 | Message from the profile: chat opens, message stored, A sees unread |
| F-MSG-05 | Message sent elsewhere arrives in B's open chat over the WebSocket |
| F-MSG-06 | Delete own message from the bubble menu |
| F-MSG-01/08/09 | Book shared into the conversation; bubble opens the book; list preview |
| F-QUOTE-02/03/07 | Quote search, card, detail |
| F-QUOTE-04 | Like / unlike stored |
| F-QUOTE-06 | Quote comment added, counted, deleted |
| F-QUOTE-05/10 | Repost with comment shown in the feed; undo |
| F-PROF-03 / F-FOLLOW-04 | Followers list; A removes B |
| F-NOT-01/02 | List, opening marks read, quote-like opens the quote |
| F-SET-02 | Change password: wrong current refused, mismatch caught, success signs out, new password works |
| F-SET-01 | Change e-mail: info mail in the sink, signed out, sign-in with the new address |
| F-SET-07 | Deactivate: confirm, signed out, profile hidden, sign-in reactivates |
| F-SET-08 | Delete account: phrase required, deleted, sign-in refused |
| F-AUTH-08 | Session kept in Keychain / Keystore across an app restart; logout clears it |

### Batch 6 — writing sessions (`v06_sessions_test.dart`)

Every scenario PASS on iOS and Android (15/15 each).

| Scenario | What was checked |
|---|---|
| F-SESS-02 | Creation-access request: short reason refused; PENDING row |
| F-ADM-06 | Admin approves A, rejects B with a note |
| F-SESS-14/02r | A sees the approval; B sees the rejection note and can re-apply |
| F-SESS-03/01 | Open session with tags created and listed |
| F-SESS-04/06 | Detail; entry with a mention of B stored |
| F-SESS-07 | Entry posted elsewhere appears live in the open session |
| F-SESS-08 / 09 | Like and undo; delete own entry |
| F-SESS-13 | `/share/session/…` link |
| F-SESS-11 | Cover upload (stand-in) stored |
| F-SESS-12 / F-NOT-02 | Mention notification opens the session at the entry |
| F-SESS-05 | Private session: code rule, code required for others, wrong code refused |
| F-SESS-10 | Close: cancel keeps it, confirm closes; closed session takes no entries |
| F-SESS-guest | Guest: list and open session read-only with a sign-in prompt |

### Batch 7 — printed catalogue, print application, funding, admin print workflow (`v07_commerce_test.dart`)

Sandbox payments only (`PRINT_PAYMENTS_MODE=SANDBOX`, server mock provider; no iyzico, no money). Every scenario PASS on iOS and Android (19/19 each).

| Scenario | What was checked |
|---|---|
| F-PRINTED-02/03 | Printed-book submission: client rules, invalid ISBN, PENDING row, "under review" |
| F-ADM-05a | Admin approves the printed book |
| F-PRINTED-01/04/05 | Catalogue, detail, rate + review, update, remove, add again (rows) |
| F-QUOTE-09 | Quote with page number (range checked) |
| F-PRINTED-06 | Printed shelf on the profile |
| F-PRINTED-07 / F-ADM-05b | Author claim: validation, submit, admin approval, claimant gets chapter tools |
| F-FUND-06/11 | Print application: form, cover PDF uploaded to `/api/print/assets`, frozen version with hash, submitted |
| F-ADM-07 | Admin approves with quote, confirmed pages, two PDFs and amounts |
| F-ADM-08 | Admin opens the campaign (confirmation required) |
| F-FUND-01/02 | Campaign card + support link on the book page; free interest toggled |
| F-FUND-03/04/09 | Checkout: 1 copy + 100 TL, address, consents → reservation in kuruş with idempotency key → simulated success (captured) |
| F-FUND-04f/10 | Simulated failure; another basket cancelled from history |
| F-FUND-05 | History shows captured, failed, cancelled payments |
| F-ADM-10a/12 | Full refund while the campaign is ACTIVE; maintenance run; supporter sees "İade edildi" |
| F-ADM-09/10b | Target reached by a second disposable supporter → maintenance settles to SUCCEEDED → production stepped to PRINTED in the admin UI → pre-order CONFIRMED → PACKAGING |
| F-ADM-11 | New sample tariff version |
| F-ADM-08a | Campaign audit trail: CAMPAIGN_SETTLED, PRODUCTION_UPDATED |
| F-PUB-01 | Publisher catalogue and campaign filter; member redirected |

### Batch 8 — admin console (`v08_admin_test.dart`)

Every scenario PASS on iOS and Android (8/8 each).

| Scenario | What was checked |
|---|---|
| F-ADM-guard | Member and publisher kept out of admin screens; server refuses their admin queries |
| F-ADM-01 | Overview counts |
| F-ADM-02/04 | Data browser: comments list, search, status filter; schema view |
| F-ADM-03 / J-14 | Record editor: reason rule; hide a comment (gone from the book page); restore |
| F-ADM-03c | Stale revision → conflict message, nothing applied, reload shows the other change |
| F-ADM-14 | Audit trail lists the moderation actions with reasons |
| F-ADM-13 | Admin delete + classification on another author's book; author dashboard opens |

### Batch 9 — Google sign-in without OAuth credentials (`v09_google_sign_in_test.dart`, 23 Nov 2026)

Done after the main pass, at the owner's request to complete Google sign-in. iOS 4/4, Android 4/4. F-AUTH-03 stays **BLOCKED**: no real Google sign-in has happened. Details and the setup steps are in `google_sign_in_setup.md`.

| Scenario | iOS | Android | What was checked |
|---|---|---|---|
| F-AUTH-03a | PASS | PASS | Button on login and register in an unconfigured build; tap explains the missing configuration; not signed in |
| F-AUTH-03b | PASS | PASS | The real sandbox `googleAuth` refuses a token Google never issued; the app shows the website's message; no session; user count unchanged; Google account forgotten |
| F-AUTH-03c | PASS | PASS | Cancel at Google: no backend request |
| F-AUTH-03d | PASS (URL-scheme guard stops the SDK call; no crash) | PASS after a manual Back: the real plugin opened Google's own sign-in screen (the emulator has no Google account) | Native wiring with well-formed but non-existent client IDs |

Changes: Google flow moved to `core/auth/google_sign_in.dart` (injectable token source, error mapping matching the website, Google account forgotten on logout/expiry); button always shown; iOS URL scheme from a generated xcconfig plus a native scheme check (the SDK would otherwise crash the app); Android release signing from `key.properties`; `tool/configure_google_sign_in.sh`. Unit/widget tests 161 → 181.

## Final regression (23 Nov 2026)

| Suite | iOS | Android |
|---|---|---|
| v01 auth, navigation, community | 12/12 | 12/12 |
| v02 discovery, book, comments | 17/17 | 17/17 |
| v03 reader | 18/18 | 18/18 (after an emulator reboot, see below) |
| v04 authoring, editor | 13/13 + 1 SKIP | 13/13 + 1 SKIP (manual PASS) |
| v05 social | 26/26 | 26/26 |
| v06 sessions | 15/15 | 15/15 |
| v07 commerce (sandbox payments) | 19/19 | 19/19 |
| v08 admin | 8/8 | 8/8 |

Android failures seen during the regression and how each was settled (details in `evidence/verification_runs/README.md`):

- v03 on an emulator up for ~3 h (load ≈ 5): clipboard reads empty and one success toast missed, while the backend effect was present (the next scenario found the saved quote as a duplicate). After an emulator reboot the same build passed 18/18.
- v08 F-ADM-03: the save button left the lazy list's built range during the keyboard-closing relayout between the harness's lookup and its tap. Harness `tap` now looks the target up again; no assertion changed.
- v07 F-ADM-08 (and the funding scenarios that depend on its campaign): this run's application card was below the scroll limit because approved applications from earlier runs accumulate in the sandbox list. Limit raised for that card.

After these test-side changes v03, v07 and v08 were rerun on both platforms (all pass) and the remaining suites on Android (all pass).

Static checks at the end: `flutter analyze` no issues; `dart format` 0 changed; 161 unit/widget tests pass; Android debug APK and unsigned iOS release build.

## Defects found and fixed (Flutter, `Client/mobile/` only)

| ID | Found by (platform) | Defect | Cause | Fix | Regression check |
|---|---|---|---|---|---|
| V-01 | Register form (iOS) | After a failed submit, field errors stayed on screen after the user corrected the value (e.g. "En az 8 karakter" under a strong password) | `Form` validated only on submit | Switch to `AutovalidateMode.onUserInteraction` after the first failed submit (login, register, contact forms) | v01 F-AUTH-02/07 asserts the stale error is gone |
| V-02 | Login on Android after a pause | First request after ~5 s idle failed as a network error ("Geçici bir sorun yaşanıyor olabilir…") | Node closes idle keep-alive sockets after 5 s; `http.Client` reused the closed socket | `IOClient(HttpClient()..idleTimeout = 3 s)` in `GraphQLClient` | v01 rerun on Android |
| V-03 | @mention suggestions (iOS) | Opening the suggestion list threw a framework assertion; tap ink/background invisible in release | `ListTile`s without a `Material` ancestor | Suggestion panel wrapped in `Material` | v02 F-COMM-02/06 |
| V-04 | Mention notification → book (iOS) | A link to a comment (`/book/<id>?comment=…`) did not scroll to the comment section | Book detail used a lazy `ListView`; the comments widget below the fold was never built, so `ensureVisible` had nothing to scroll to | Book detail body is a `SingleChildScrollView` | v02 F-NOT-01/02 |
| V-05 | "Senin için" after onboarding (iOS) | Whole recommendations tab failed: "Cannot return null for non-nullable field Book.pageCount." | App asked for `pageCount`, which the recommendation resolver does not load (its projection omits it); the website's fragment does not ask for it. Static schema validation cannot see this | Dedicated `recommendationBookFields` without `pageCount`; book card hides the page badge and reading time when the count is unknown (website: `pageCount && …`, `estimatedReadTime > 0 && …`) | v02 F-DISC-04/03/07; unit + widget tests |
| V-06 | Create book (iOS) | After "Taslak olarak kaydet" with missing fields, the error summary was off-screen above the form; only a toast appeared | Summary at the top of a long list, button at the bottom | Scroll to the summary after a failed submit | v04 F-WRITE-01/02/03 |
| V-07 | Editor long-press / double-tap (iOS) | Every selection gesture in the chapter editor threw "No CupertinoLocalizations found" (16×) and no copy/paste menu appeared | `flutter_quill` builds its iOS selection toolbar from the SDK's legacy Cupertino widgets; the bridge registered only the legacy Material localisations | Add legacy `GlobalCupertinoLocalizations.delegate` to the bridge | v04 F-WRITE-05c (copy → paste through the toolbar); unit test |
| V-08 | Reader (iOS, compared with `BookReader/index.jsx`) | The "next" button looked at the *next* chapter: before a hidden chapter it showed a disabled "Okuyuculara kapalı", so readers could not move past a hidden chapter; labels differed from the website | Port used the wrong chapter | Exact port of the website rule (current chapter decides label and disabled state); locked chapters show the notice and "Sonraki Bölüm" | v03 F-READ-03h; unit tests |
| V-09 | Profile edit (iOS) | Upload button read "RESIM YÜKLE" (dotless I) | `String.toUpperCase()` is not Turkish-aware | `trUpper` in the image field and the social-link buttons | v05 F-PROF-01/02 |
| V-10 | Commerce suite (Android) | "A BookFeedController was used after being disposed" when the feed was left while a feed request was still loading (here: sign-in changed the session and rebuilt the screen) | The controller notified listeners after `dispose()` when a late response arrived | Controller ignores notifications after dispose and invalidates pending generations | Unit test (late response after dispose); commerce rerun on Android |

Testability additions (no behaviour change in production builds): `BETIK_CLOUDINARY_API_BASE` define (default `https://api.cloudinary.com`), `debugPickImageOverride`, `debugPickPdfOverride` (`@visibleForTesting`).

## Observations that are not app defects

- Under `flutter drive` the OS keyboard is never shown once the test text-input channel has been used; this is the test binding, not the app. In a normal run the Android keyboard opens on a tap in the editor and typed text is saved (Batch 4 manual check).
- A toast (SnackBar, 3.5 s, closable) can cover a bottom button for its lifetime. Minor UX point, same as Material default; noted for the owner, not changed.
- Covers and avatars uploaded in the sandbox point at `res.cloudinary.com/betik-sandbox-mock/…`, which does not exist, so the app shows its placeholder cover. Expected in the sandbox.
- Earlier failed attempts in the iOS editor (lost text, undo "not working") were test-helper mistakes (stale simulated keyboard state; undo button scrolled off-screen in the horizontal toolbar). Both were rechecked and pass.
