# Google sign-in — setup and status

**Status: BLOCKED on OAuth configuration.** The native integration is complete on Android and iOS and is tested up to Google's own sign-in screen. A successful sign-in has **not** happened yet, because this repository has no Android or iOS OAuth client and the sandbox backend has no `GOOGLE_CLIENT_ID`. Google sign-in is a product requirement on both platforms, so the button is always shown; until the client IDs are provided, tapping it explains that this build is not configured.

## How it works (no second auth system)

```
"Google ile devam et"
  → google_sign_in 7 (Android: Credential Manager · iOS: GoogleSignIn SDK)
  → Google ID token, audience = backend web client (serverClientId)
  → existing GraphQL mutation googleAuth(token)               [backend unchanged]
       authenticateWithGoogleCredential (same code as the website):
       verifyIdToken(aud = GOOGLE_CLIENT_ID), email_verified,
       find by googleSubject → else by e-mail (link rules below) → else create
       → backend JWT (1 day)
  → AuthController._acceptPayload: Keychain/Keystore, expiry timers,
    socket reset, then returnTo / registration intent / profile
```

| Piece | File |
|---|---|
| Flow, plugin wrapper, error mapping | `Client/mobile/lib/core/auth/google_sign_in.dart` |
| Button (login and register) | `lib/features/auth/auth_screens.dart` (`GoogleButton`) |
| Session handling (shared with e-mail login) | `lib/core/auth/auth_controller.dart` (`loginWithGoogleIdToken`) |
| Build values | `lib/core/config/app_config.dart` — `BETIK_GOOGLE_SERVER_CLIENT_ID`, `BETIK_GOOGLE_IOS_CLIENT_ID` |
| iOS URL scheme | `ios/Runner/Info.plist` → `$(GOOGLE_REVERSED_CLIENT_ID)` from `ios/Flutter/GoogleSignIn.xcconfig` (generated, git-ignored) |
| iOS crash guard | `ios/Runner/AppDelegate.swift` (`betik/platform_config` channel) — the app refuses to call the GoogleSignIn SDK when the reversed client ID is not a registered URL scheme, because the SDK would raise an uncatchable exception |
| Android release signing | `android/app/build.gradle.kts` reads `android/key.properties` (git-ignored); debug key otherwise |
| Setup helper | `Client/mobile/tool/configure_google_sign_in.sh` |

Backend rules the app inherits (`Server/src/services/userService.js`, read-only):
- The token audience must be exactly the backend's `GOOGLE_CLIENT_ID`. Tokens for the Android or iOS client are refused, which is why the app requests a token for the web client.
- `email_verified` must be true.
- An existing **password** account is linked automatically only for `@gmail.com` addresses or Google Workspace accounts (`hd`). Otherwise the server answers "Bu hesaba mevcut parolanızla giriş yapın; Google bağlantısı ayrıca doğrulanmalıdır." and the app shows that sentence.
- A deleted account's e-mail is refused ("Bu e-posta adresine ait hesap silinmiş.").
- A new user gets username `<e-mail prefix><0–999>` and `isVerified: true`.
- In the Docker dev setup (`BETIK_DOCKER_DEV=true`) Google is off unless `DEV_EXTERNAL_INTEGRATIONS=true`.
- Rate limit: 20 attempts per 15 minutes.

Error handling in the app:

| Situation | User sees |
|---|---|
| User closes Google's sheet or chooser | Nothing; back on the form, not signed in |
| Build without client IDs, or iOS URL scheme missing | "Google ile giriş bu uygulama sürümünde henüz yapılandırılmadı. …" |
| Plugin configuration error, unknown plugin error | Website text "Google ile giriş yapılamadı. Lütfen tekrar deneyin." (details go to the debug log) |
| Flow interrupted | "Google ile giriş yarıda kaldı. …" |
| Google returned no ID token | Website text "Google'dan giriş bilgisi alınamadı. …" |
| Backend refuses the token (wrong audience, expired, forged) | Website text "Google ile giriş yapılamadı. …"; the raw server text (e.g. "Wrong number of segments in token") is never shown |
| Deleted account; password account not linkable | The server's Turkish sentence |
| Too many attempts / no connection | The app's standard rate-limit / network messages |
| Backend JWT expires later | Same as e-mail login: signed out with "Oturum süreniz doldu…"; signing in with Google again works the same way |
| Logout or expiry | The Google account choice is also forgotten, so the next sign-in shows the account chooser |

Known Android caveat (plugin README): some Google Cloud misconfigurations, such as a wrong SHA-1 or package name, come back from Credential Manager as "cancelled". They then look like a user cancel, with no message. If the sheet closes right after you pick an account, check the Android client.

## What you need to do in Google Cloud Console

Use **the Google Cloud project that owns the backend's `GOOGLE_CLIENT_ID`** (Google Auth Platform → Clients). The website's code has `620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com` as its legacy fallback (`Client/src/config/integrations.js`). Confirm that this is the value in the production backend's `GOOGLE_CLIENT_ID`. If it is, that client's project (number `620840983651`) is the one to use. All three clients must be in that same project.

1. **Branding and audience** (Google Auth Platform → Branding, Audience):
   - App name, support e-mail, and developer contact must be filled in. Scopes are only `openid`, `email` and `profile` (non-sensitive, so no verification is needed).
   - If the audience is External and the status is **Testing**, only the listed test users can sign in. Add your test Google accounts there, or publish the app.

2. **Web client** — already exists (the backend's `GOOGLE_CLIENT_ID`). Nothing changes for mobile: no redirect URIs or origins are needed for the apps. Never put its client secret in the app.

3. **Android clients** (Create client → Android). Each Android client holds **one** package name + SHA-1 pair, so create one client per signing key:

   | Client | Package name | SHA-1 |
   |---|---|---|
   | Debug, this development Mac | `com.betik.mobile` | `D9:3A:66:DA:A2:F6:B5:67:9B:D4:8C:29:8E:B9:A7:D9:03:0F:FB:96` |
   | Debug, any other developer machine | `com.betik.mobile` | that machine's key: `tool/configure_google_sign_in.sh --fingerprints` |
   | Release upload key | `com.betik.mobile` | from your upload keystore (see "Android release signing") |
   | Play App Signing key (store installs) | `com.betik.mobile` | Play Console → Test and release → App integrity → App signing key certificate |

   The debug key above is `~/.android/debug.keystore`, created 17 Nov 2026 (SHA-256 `00:67:69:E8:83:B3:98:78:49:27:A7:E8:F6:BE:4C:0D:0F:D1:B3:52:CE:5C:EE:04:25:86:5C:49:4A:96:56:1D`). I checked that the built debug APK is signed with it (`apksigner verify --print-certs`).

   The app does not need the Android client IDs. Google matches the installed app by package name and certificate. No `google-services.json` is used.

4. **iOS client** (Create client → iOS):
   - Bundle ID `com.betik.mobile`. Team ID and App Store ID are optional.
   - Copy the **client ID**. The "iOS URL scheme" Google shows is its reversed form, which the setup script derives for you.

5. **Application ID.** `com.betik.mobile` is still a placeholder (decision D-13). The website's Capacitor wrapper uses `com.betik.app`. If you choose another final ID, create the Android and iOS clients for that ID, and change `applicationId` (Android) and the bundle identifier (iOS) to match.

### Values to give me

| Value | Example shape | Where it goes |
|---|---|---|
| Web client ID (= backend `GOOGLE_CLIENT_ID`) | `123…-abc….apps.googleusercontent.com` | `BETIK_GOOGLE_SERVER_CLIENT_ID`; sandbox backend `GOOGLE_CLIENT_ID` for the end-to-end test |
| iOS client ID | `123…-xyz….apps.googleusercontent.com` (same project number) | `BETIK_GOOGLE_IOS_CLIENT_ID` + generated URL scheme |
| Confirmation that the Android client(s) exist for `com.betik.mobile` + the SHA-1 above | — | nothing in the app |
| A Google test account (one you control; listed as a test user if the app is in Testing) | — | signed in on the emulator and in the simulator during the test |

No client secret, API key, `google-services.json` or `GoogleService-Info.plist` is needed. Client IDs are public identifiers; they still are not committed, because they belong to one Google Cloud project.

## Build with the IDs

```sh
cd Client/mobile
tool/configure_google_sign_in.sh <WEB_CLIENT_ID> <IOS_CLIENT_ID>
#   → google_sign_in.json (dart defines) and ios/Flutter/GoogleSignIn.xcconfig (URL scheme)
#   → checks the format and that both IDs are from the same project
flutter run --dart-define-from-file=google_sign_in.json --dart-define=BETIK_API_URL=…
```

### Android release signing

Create an upload keystore once (keep it and its passwords out of the repository), then create `Client/mobile/android/key.properties`:

```
storeFile=../upload-keystore.jks      # relative to android/app
storePassword=…
keyAlias=upload
keyPassword=…
```

Release builds then use it. Without the file they fall back to the debug key, as before. Register the upload key's SHA-1 (`keytool -list -v -keystore … -alias upload`) and, after the first Play upload, the Play App Signing SHA-1.

## Verification once the IDs exist (what I will run)

1. Start the sandbox backend with `GOOGLE_CLIENT_ID=<web client id>`. It still listens on loopback only, but it needs outbound HTTPS to Google to fetch the token-signing certificates.
2. Android emulator (Google APIs image): add the test Google account in Settings. In the app, tap "Google ile devam et", choose the account, and check:
   - a `users` row with `googleSubject`, `isVerified: true`, username `<prefix><n>`;
   - the session in the Keystore;
   - landing on the profile, or `returnTo`.
3. Then: logout → the account chooser appears again; sign in again → the same user, no duplicate; kill and restart the app → still signed in.
4. Error paths: cancel at the chooser; airplane mode; an existing password account with a non-Gmail address → the server's link sentence.
5. iOS simulator: the same flow through Google's web sheet. Also check the URL-scheme redirect back into the app.
6. Repeat 2–4 with a release build signed with the upload key, to check the SHA-1 registration.

Only after step 2 or 5 succeeds will the matrix row F-AUTH-03 change from BLOCKED.

## What was verified without credentials (23 Nov 2026)

| Check | iOS simulator | Android emulator | Evidence |
|---|---|---|---|
| Button on login and register; unconfigured build explains instead of hiding (F-AUTH-03a) | PASS | PASS | `integration_test/v09_google_sign_in_test.dart`; `screenshots_v/*google_*_unconfigured.png` |
| Real sandbox `googleAuth` refuses a token Google never issued; website message; no session, no user row; Google account forgotten (03b) | PASS | PASS | same suite |
| Cancel at Google sends nothing (03c) | PASS | PASS | same suite |
| Real plugin with well-formed but **non-existent** client IDs (03d) | PASS — the URL-scheme guard stopped the call; no SDK crash | Plugin → Credential Manager → Google's own sign-in screen ("Sign in — Use your Google Account"); the emulator has no Google account. The suite passed only after a manual Back press, because the app sits behind Google's screen | `ios_google_google_plugin_nonexistent_client.png`, `android_google_plugin_reaches_google_signin.png` |
| Manual Android debug run, same throwaway server ID: tap the button → Google's sheet opens over the app → Back → returns to the form, button usable, no error, not signed in | — | Observed. Google Play services showed an "isn't responding" dialog once on the emulator during this (the Google side, not the app) | `android_google_button_opens_google_sheet.png`, `android_google_after_cancel.png` |
| Unit and widget tests: config parsing, plugin code mapping, backend message mapping, success into the session store, cancel, not configured, rejected token, deleted account, rate limit, network failure, malformed payload, logout forgets the Google account | 20 tests in `test/google_sign_in_test.dart` | — | `evidence/flutter_test_output.txt` |
| Builds: Android debug APK; iOS simulator debug and release `--no-codesign`; Info.plist carries the Google URL type with an inert placeholder until configured | built | built | — |

Not verified: a real Google account choice, a real ID token, `googleAuth` success, account creation or linking through Google, the iOS redirect back into the app, and release-key SHA-1 matching.

## Sign in with Apple (separate iOS issue, not implemented)

App Store Review Guideline 4.8: an app that uses a third-party login service such as Google must also offer an equivalent login option that:
- limits data collection to name and e-mail;
- lets users keep their e-mail private;
- does not collect interactions for advertising without consent.

Sign in with Apple meets this. The app's own e-mail/password login does not count as that option. The guideline's exceptions (an app that uses only the company's own account system, education/enterprise accounts, government or industry IDs, clients for a specific third-party service) do not apply once Google is offered.

The backend has no Apple login. Google stays enabled on iOS as required, so an iOS store submission carries review risk until one of these is decided:

| Option | Backend change | App change | Notes |
|---|---|---|---|
| A. Add Sign in with Apple (recommended for store release) | New `appleAuth(identityToken, nonce, fullName)` mutation: verify the Apple ID token against Apple's JWKS (`https://appleid.apple.com/auth/keys`), `aud` = bundle ID, nonce check; find by a new `appleSubject` field, link by verified e-mail with the same rules as Google; issue the same JWT | `sign_in_with_apple` package, "Sign in with Apple" capability/entitlement, an Apple button on login and register (iOS; optionally Android via Apple's web flow with a Services ID) | Needs an Apple Developer account. Apple's private-relay e-mails need an e-mail relay setup for outgoing mail. Account deletion must also revoke the Apple token (guideline 5.1.1(v)) |
| B. Another login that meets the three criteria | Depends on provider | Provider SDK | Rarely simpler than A |
| C. Submit with Google only and argue an exception | None | None | Likely rejection; not recommended |

Nothing was changed in the backend; A or B needs your authorisation.
