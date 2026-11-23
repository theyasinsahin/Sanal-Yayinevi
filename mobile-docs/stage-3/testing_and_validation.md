# Testing and validation

## Results

| Check | Result | Evidence |
|---|---|---|
| `flutter analyze` | No issues | `evidence/flutter_analyze_output.txt` |
| `dart format` | 75 files, 0 changed | — |
| Unit and widget tests | 181 passed, incl. 20 Google sign-in tests (the 10 live tests skip without a backend) | `evidence/flutter_test_output.txt` |
| GraphQL documents against the server schema | 163 valid, 2 dynamic documents checked separately (6 variants valid) | `evidence/graphql_validation.txt`, `evidence/graphql_dynamic_validation.txt` |
| Live API tests (disposable backend) | 10 passed (implementation phase) | `evidence/live_api_test_output.txt` |
| On-device journey, iPhone 17 simulator, iOS 27.0, debug | Passed, 18 screenshots (implementation phase) | `evidence/ios_simulator_journey_output.txt`, `evidence/screenshots/` |
| Verification suites v01–v08, iPhone 17 simulator (iOS 27.0) | 129 scenarios: 128 PASS, 1 SKIP (real-keyboard typing, manual check) | `verification_log.md`, `evidence/verification_runs/` |
| Verification suites v01–v08, Pixel 8 emulator (Android 15, API 35) | 129 scenarios: 128 PASS, 1 SKIP (real-keyboard typing, verified manually on the emulator) | same |
| Android debug APK | Builds | `evidence/build_output.txt` |
| iOS release, unsigned (`--no-codesign`) | Builds, 29.5 MB | `evidence/build_output.txt` |

## Test files (`Client/mobile/`)

| File | Covers |
|---|---|
| `test/richtext_golden_test.dart` (95) | Sanitiser, paragraph index, page count, Quill HTML ⇄ Delta against website fixtures |
| `test/core_logic_test.dart` | Error mapping, session expiry, route guards for every role, formatting, money, notification targets, share URLs, mentions, validation rules, image type and crop arithmetic |
| `test/reader_writer_logic_test.dart` | Resume priority, offline progress queue, reading-time tracker, autosave, WebSocket protocol with a fake server |
| `test/widget_test.dart` (3) | Login form validation and refused login; book card on a 320 px screen at 1.4× text; guest gate |
| `test/integration/live_api_test.dart` (10) | Real HTTP and WebSocket calls against the sandbox |
| `integration_test/app_journey_test.dart` (1) | The whole app on a simulator: guest landing → guarded route → login through the form → create-book form → profile → feed and filters → book detail → reader and chapter list → writing dashboard with the editor → quotes, sessions, leaderboard, printed books, messages, notifications, funding history, authors → role guard → logout → guard |

## How to rerun

```sh
cd Client/mobile
flutter analyze && flutter test

# Disposable backend only — these create and delete data
BETIK_TEST_API=http://localhost:5055 BETIK_TEST_PASSWORD=<seed password> \
  flutter test test/integration/live_api_test.dart

BETIK_SCREENSHOT_DIR=<dir> flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/app_journey_test.dart -d <simulator id> \
  --dart-define=BETIK_API_URL=http://localhost:5055 \
  --dart-define=BETIK_WEB_URL=http://localhost:3055 \
  --dart-define=BETIK_TEST_EMAIL=author@betik-dev.invalid \
  --dart-define=BETIK_TEST_PASSWORD=<seed password>
```

The seed password is not written in any file of the repository; it comes from the sandbox's environment. Do not run the live tests more than about three times in 15 minutes: the login limit (10 per e-mail) will fail them.

## Defects found by the device run and fixed

Using the provider context in `dispose()` on four list screens; a counter row overflowing on book cards; reading router state in the reader's `initState`; a `setState` after dispose in the reader; signed-in users on `/login` ignoring `returnTo`; the funding strip on book cards overflowing on narrow screens with large text; editor paragraph spacing. All have a test or are covered by the journey.

## Visual comparison with Stage 2

The simulator screenshots were reviewed by eye for layout defects and against the Stage 2 description of the mobile website (`stage-2/ui_patterns.md`, screenshots): colours, serif/sans pairing, bordered cards, uppercase buttons and Turkish copy match; navigation differs by design (D-04). This was a manual review of those screens only — not a pixel comparison and not a side-by-side of every screen, and not of the screens the journey does not open.

## Stage 3 verification pass

Eight `flutter drive` suites (`integration_test/v01_auth_nav_test.dart` … `v08_admin_test.dart`, shared helpers in `integration_test/support/`) drive the real app through its widgets on the iPhone 17 simulator (iOS 27.0) and the Pixel 8 emulator (Android 15, API 35) against a disposable sandbox (in-memory MongoDB replica set, local SMTP sink, server on loopback, `PRINT_PAYMENTS_MODE=SANDBOX`, local Cloudinary stand-in). Each scenario checks the screen and the backend effect (DB row, mail, upload). Scripts to rebuild the sandbox: `evidence/sandbox/` (README there). Results per scenario: `verification_log.md`; raw runs: `evidence/verification_runs/`.

## Not tested

- Any physical device; iPad layout; dark mode (the app is light-only like the website); landscape.
- Screen-reader behaviour and minimum touch-target audit. Large text was checked for the book card only.
- A real Google sign-in (no OAuth clients; what was checked without them is in `google_sign_in_setup.md`); real Cloudinary (local stand-in only); iyzico, including its sandbox (server mock provider only).
- The system photo and document pickers (a test seam supplies the file; everything after the pick is real).
- Real keyboard typing under `flutter drive` (the test binding replaces it); checked manually on the Android emulator only.
- Remaining matrix rows not fully verified: F-NOT-02 (some notification types not tapped), F-SCORE-02/03 (point rules, live refresh), F-SHARE-02 (story image), F-FUND-07 (legacy payment result page), F-AUTH-10 (replay after a real sign-up), F-NAV-06 (offline states), F-BOOK-06 / F-PROF-06 (one button each not tapped), F-WRITE-03 (real Cloudinary).
- Natural token expiry, background/foreground socket handling, performance, memory, app size, release-mode run on a device.
