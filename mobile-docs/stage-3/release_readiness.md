# Release readiness

**Not ready for store submission.** The application is feature-complete in code and was verified on an iOS simulator and an Android emulator (156 of 167 implemented features verified, see `verification_log.md`); it has not run on a physical device, and release identity and credentials are missing.

| Item | State |
|---|---|
| Android debug build | Done |
| Android run on emulator | Done — Pixel 8 emulator, Android 15, all eight verification suites |
| Android / iOS run on a physical device | Not done |
| Android release build, signing, Play App Signing | Not done |
| iOS simulator debug build and run | Done |
| iOS release compile, unsigned | Done |
| iOS signing, provisioning, archive, TestFlight | Not done (BLK-07) |
| Final application id and name | Open (D-13) |
| Production API / WebSocket / website URLs | Unknown; must be supplied at build time |
| Google sign-in | Implemented and always shown; blocked on OAuth clients (BLK-01, steps in `google_sign_in_setup.md`); iOS guideline 4.8 open (BLK-02) |
| Image upload | Request path verified against a local stand-in; real Cloudinary unconfigured (BLK-03) |
| Universal Links / App Links | Not configured (BLK-05) |
| Payments | Whole funding flow verified with the server's SANDBOX mock provider (reservation, success, failure, cancel, refund, settlement); iyzico (even its sandbox) never executed (BLK-06). Also check store rules for the print-funding flow: it sells physical goods, which normally may use an external payment provider, but the owner should confirm against current store policy |
| App icon | One source image applied to the Flutter templates; no adaptive Android icon, no store artwork |
| Splash screen | Template default |
| Privacy policy, data-safety form, App Privacy details, account deletion | Account deletion exists in the app (F-SET-08, verified on both platforms). Policy text is a draft |
| Crash reporting, analytics | None |
| Localisation | Turkish only, as the website |
| Accessibility review | Not done |
| Verification pass of the 79 unexecuted / 56 partial features | Done on simulator and emulator: 156 verified, 8 partial, 2 not verified, 1 blocked |
| Physical-device pass (keyboard, selection, share sheet, file picker) | Not done. Real keyboard typing in the editor checked manually on the Android emulator only |

## Suggested order

1. Answer the open questions (paragraph numbering first — it affects stored data).
2. Supply Cloudinary and Google configuration; run the app on one physical device of each platform (keyboard, selection handles, share sheet, photo and document pickers).
3. Close the remaining partial rows of the matrix (notification targets not tapped, live score refresh, story image share, legacy payment result page).
4. Decide Apple login; configure link association.
5. Release identity, signing, icons, store listings; internal testing tracks before any public release.
