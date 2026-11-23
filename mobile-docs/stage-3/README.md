# Stage 3 — Flutter implementation

The Betik mobile application lives in `Client/mobile/` (Flutter 3.50 / Dart 3.14, Android + iOS). It is a native client of the existing GraphQL backend. Nothing outside `Client/mobile/` and `mobile-docs/stage-3/` was changed.

## State in one paragraph

Of the 171 tracked features (156 from Stage 1, 15 discovered in Stage 2), 167 are implemented, 2 are browser-only and do not apply, and 2 small ones were not started. The app builds for both platforms (Android debug APK; iOS simulator debug and an unsigned iOS release compile). A verification pass (`verification_log.md`) then drove 129 scenarios (including setup steps; one skipped and checked manually) through the app on an iPhone 17 simulator (iOS 27.0) and a Pixel 8 emulator (Android 15) against a disposable sandbox backend, checking the backend effect of each action; 10 Flutter defects were found and fixed. After the pass, 156 features are verified, 8 partially verified, 2 not verified, 1 blocked (Google sign-in: no OAuth clients) and none failed (before the pass: 30 / 56 / 79 / 2). The app has not been run on a physical device, real Cloudinary and iyzico were never used (local stand-in and the server's sandbox mock instead), and it is not ready for store release — see `release_readiness.md`.

## Documents

| Document | Content |
|---|---|
| [feature_parity_matrix.md](feature_parity_matrix.md) | Every feature: location, implementation status, verification status, evidence, limits |
| [architecture.md](architecture.md) | Layers, folders, state, navigation, networking |
| [technical_decisions.md](technical_decisions.md) | Decision log, including every deliberate difference from the website |
| [backend_integration.md](backend_integration.md) | How the app uses the GraphQL contract; error and session rules |
| [auth_and_platform_config.md](auth_and_platform_config.md) | Build configuration, deep links, permissions |
| [google_sign_in_setup.md](google_sign_in_setup.md) | Google sign-in: how it works, status, exact Google Cloud steps and values, verification plan, Sign in with Apple options |
| [reader_editor_compatibility.md](reader_editor_compatibility.md) | HTML sanitising, paragraph indexes, page counts, Quill HTML ⇄ editor |
| [testing_and_validation.md](testing_and_validation.md) | What was tested, how to rerun it, what was not tested |
| [verification_log.md](verification_log.md) | Stage 3 verification pass: environment, scenario results per platform, defects V-01…V-10 |
| [known_issues_and_blockers.md](known_issues_and_blockers.md) | Blockers, open questions, known defects |
| [release_readiness.md](release_readiness.md) | Checklist before a store submission |
| [implementation_progress.md](implementation_progress.md) | Milestone log |
| `evidence/` | Test outputs, schema validation, 18 journey screenshots, verification-pass device screenshots (`screenshots_v/`), sandbox scripts (`sandbox/`), the scripts that produced the fixtures |

## Decisions that need the project owner

1. **Paragraph numbering** — the website counts only top-level `<p>` elements for bookmarks and paragraph comments; Stage 2 described it as "every top-level element". The app follows the website's code (decision D-07), confirmed on both devices in the verification pass (bookmark on the 2nd `<p>` after a heading stores index 1). Confirm.
2. **Google OAuth clients** — Google sign-in is implemented and always shown on both platforms but blocked until the web/iOS/Android clients exist (BLK-01); exact steps in `google_sign_in_setup.md`.
3. **Sign in with Apple** — App Store guideline 4.8 expects an equivalent privacy-focused login when Google is offered on iOS; the backend has no Apple login (BLK-02). Options in `google_sign_in_setup.md`.
4. **Application identifier** — `com.betik.mobile` is a placeholder (D-13).
5. **Production endpoints, OAuth clients, Cloudinary preset, link association files** — none are in the repository; all are needed for release (BLK-01, 03, 05).
