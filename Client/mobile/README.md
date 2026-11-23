# Betik mobile (Flutter)

Native Android and iOS client for Betik (Sanal Yayınevi). It talks to the existing GraphQL backend in `Server/`; it contains no backend code and no secrets.

Full documentation: [`mobile-docs/stage-3/`](../../mobile-docs/stage-3/README.md).

## Run

```sh
flutter pub get
flutter run \
  --dart-define=BETIK_API_URL=http://localhost:5000 \
  --dart-define=BETIK_WEB_URL=http://localhost:3000
```

Debug builds default to `http://localhost:5000` (iOS simulator) or `http://10.0.2.2:5000` (Android emulator) when `BETIK_API_URL` is not given. **Release builds have no default**: without `BETIK_API_URL` the app shows a "not configured" screen.

| Define | Purpose |
|---|---|
| `BETIK_API_URL` | GraphQL HTTP origin (required in release) |
| `BETIK_WS_URL` | WebSocket URL; derived from the API URL (`/graphql`) when omitted |
| `BETIK_WEB_URL` | Public website origin (shared links, legal links, relative images) |
| `BETIK_CLOUDINARY_CLOUD_NAME`, `BETIK_CLOUDINARY_UPLOAD_PRESET` | Unsigned image upload; pickers are disabled without them |
| `BETIK_GOOGLE_SERVER_CLIENT_ID` | The backend's `GOOGLE_CLIENT_ID` (web OAuth client); required for Google sign-in on both platforms |
| `BETIK_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client of the same project; also needs the URL scheme. Generate both with `tool/configure_google_sign_in.sh <web id> <ios id>`, then build with `--dart-define-from-file=google_sign_in.json` (see `mobile-docs/stage-3/google_sign_in_setup.md`) |
| `BETIK_DEV_API_PORT`, `BETIK_DEV_WEB_PORT` | Ports of the debug defaults (5000 / 3000) |

## Check

```sh
flutter analyze
flutter test                       # unit + widget tests (live tests skip themselves)
BETIK_TEST_API=http://localhost:5055 BETIK_TEST_PASSWORD=… \
  flutter test test/integration/live_api_test.dart   # against a DISPOSABLE backend only
```

The on-device journey (`integration_test/app_journey_test.dart`) is described in `mobile-docs/stage-3/testing_and_validation.md`. Never point the live tests at a database you care about: they create and delete data.
