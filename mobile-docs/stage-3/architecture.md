# Architecture

Package name `betik`, about 23,000 lines of Dart in `lib/` and 2,000 in tests.

## Layers

```
features/<domain>/     screens and widgets of one domain; own their GraphQL calls
        │
core/widgets, theme    shared UI (Loader, toasts, cards, avatars, guest gate)
core/models, api       typed models (tolerant fromJson) and all GraphQL documents
core/richtext          sanitiser, paragraph index, page count, Quill HTML ⇄ Delta
core/auth              session, secure storage, AuthController
core/network           GraphQLClient (HTTP), SubscriptionClient (WebSocket), ApiException
core/config            AppConfig from --dart-define
```

`AppServices` (`core/app_services.dart`) is the composition root: it builds the config, clients, `AuthController`, `BadgeController`, reading preferences and the registration-intent store once, and is provided to the tree with `provider`. Screens reach it through `context.services`.

## State

`provider` with `ChangeNotifier` for the few pieces of global state (session, badges, reading preferences). Screen data is local: the `Loader<T>` widget runs a future, shows loading / error-with-retry / data, and can poll or refresh when a listenable changes. There is no global cache; a "data epoch" counter in `AppServices` tells list screens to reload after a mutation elsewhere.

## Navigation

`go_router`. A `StatefulShellRoute` holds the five tabs (Ana Sayfa, Keşfet, Alıntılar, Oturumlar, Profilim); everything else is pushed above the shell. The drawer carries the remaining website navigation and the role-specific entries; the app bar carries the message and notification badges.

- Internal routes use ids: `/book/:id`, `/reader/:bookId`, `/user/:id`, `/session/:id`, `/quotes/:id`.
- Website paths (slugs and legacy forms) are accepted and resolved with `resolvePublicRoute`, then replaced by the id route.
- `guardRedirect` (`router.dart`) is one pure function for all access rules: guest → `/login?returnTo=…`, missing role → `/`, signed-in user on `/login` → `returnTo`.

## Networking

- `GraphQLClient`: one POST per operation, bearer token from the session, maps transport errors, GraphQL errors and the backend's in-band `Status { code: 400 }` failures to `ApiException` kinds. `UNAUTHENTICATED` triggers sign-out.
- `SubscriptionClient`: `graphql-transport-ws` over `web_socket_channel`, one socket, lazy connect, reconnect with back-off and resubscribe, at most five subscriptions, suspended in the background.
- Uploads: Cloudinary unsigned upload (images) and `POST /api/print/assets` (print PDFs) with the same bearer token.

## Session

The JWT and the user snapshot are stored with `flutter_secure_storage` (Keychain / Keystore). On start the token's `exp` is checked locally, then `me` is called; the backend treats an invalid token as a silent guest, so a null `me` with a token means "signed out". There is no refresh token; expiry returns the user to the login form with `returnTo`.

## Rich text

The reader renders sanitised HTML with native widgets (`features/reader/html_view.dart`), one widget per top-level block so paragraphs can carry bookmark and comment controls. The editor is `flutter_quill`; `core/richtext/quill_html.dart` converts stored HTML to a Delta and back in the exact form Quill 1.3.7 produces on the website. See `reader_editor_compatibility.md`.

## Platform folders

`android/` and `ios/` are the Flutter templates plus: application id, display name, `betik://` scheme, photo-library usage text, query schemes for `url_launcher`, cleartext allowed in Android debug only and local-network loads allowed on iOS for development.
