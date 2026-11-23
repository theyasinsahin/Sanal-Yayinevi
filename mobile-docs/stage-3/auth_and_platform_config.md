# Authentication and platform configuration

## Build configuration

All values are `--dart-define` (or `--dart-define-from-file`). None is a secret. The table is in `Client/mobile/README.md`. Release builds without `BETIK_API_URL` show a "not configured" screen instead of falling back to a development address.

## E-mail login

`login`, `sendRegistrationCode` → `registerAndLogin`, `forgotPassword`, `resetPassword`, `logout`. Password rules in the app are the server's rules. The token is stored in the Keychain (iOS) / Keystore-backed storage (Android), never in plain preferences.

## Google sign-in

Implemented on Android and iOS on top of the backend's existing `googleAuth(token)`; always shown (product requirement). **Blocked** on OAuth client IDs (BLK-01). The architecture, error handling, exact Google Cloud Console steps, the SHA-1 of this machine's debug key, the build helper and the verification plan are in [google_sign_in_setup.md](google_sign_in_setup.md).

## Sign in with Apple (App Store guideline 4.8)

Not implemented; the backend has no Apple login. Requirement and options are in [google_sign_in_setup.md](google_sign_in_setup.md#sign-in-with-apple-separate-ios-issue-not-implemented). Google is **not** switched off on iOS any more (the former `BETIK_GOOGLE_SIGN_IN_IOS` switch was removed), so this is a store-review risk to decide before an iOS release (BLK-02).

## Deep links

| Kind | State |
|---|---|
| `betik://…` custom scheme | Configured on both platforms; paths are the website's paths |
| `https://<site>/…` Universal Links / App Links | **Not configured** — needs `apple-app-site-association` and `assetlinks.json` on the production web host plus the associated-domains entitlement and an `autoVerify` intent filter (BLK-05). Until then e-mailed links (password reset, newsletter) open the website |

## Permissions

| Platform | Declared |
|---|---|
| iOS | `NSPhotoLibraryUsageDescription`; local networking allowed for development; `LSApplicationQueriesSchemes` for external links |
| Android | `INTERNET`; cleartext HTTP in the debug manifest only; `queries` for external links |

No camera, location, contacts, tracking or notification permission is requested.

## Toolchain notes for this machine

- Flutter was installed at `~/development/flutter` (not on `PATH`).
- `xcode-select` points at the Command Line Tools. iOS builds were run with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` and a small `xcrun` wrapper on `PATH`. The permanent fix is `sudo xcode-select -s /Applications/Xcode.app`.
- Android builds used Homebrew `openjdk@17` and the Android command-line tools at `/opt/homebrew/share/android-commandlinetools` (`JAVA_HOME`, `ANDROID_HOME`).
- iOS deployment target 15.0; Android SDK levels are Flutter's defaults.
