# Technical decisions

Stage 2 bug and open-question identifiers are written "Stage 2 B-nn / Q-nn". Stage 3 blockers are "BLK-nn" (`known_issues_and_blockers.md`).

## Foundation

| ID | Decision | Reason |
|---|---|---|
| D-01 | `provider` + `ChangeNotifier`; screen data local through `Loader<T>` | Little global state; fewer moving parts than a store or code generation |
| D-02 | Own thin GraphQL HTTP client and own `graphql-transport-ws` client, no GraphQL package | The backend returns failures three ways (transport, GraphQL errors, in-band `Status`); one small client maps them in one place. No normalised cache is needed |
| D-03 | Id-based internal routes; website slug URLs resolved on entry | Every API takes ids; slugs change |
| D-04 | Bottom navigation (5 tabs) + drawer + app-bar badges instead of the website's top bar and footer | Mobile convention; all destinations stay reachable |
| D-05 | Editor: `flutter_quill` 11.6 with our own HTML ⇄ Delta conversion | Native editor as required (no WebView). The package's own HTML export does not match Quill 1.3.7 output, so the conversion is ours and golden-tested |
| D-06 | `package:material_ui` for the app; the deprecated `package:flutter/material.dart` only in `features/writing/quill_bridge.dart` | Flutter 3.50 moved Material out of the SDK; `flutter_quill` still uses the old library. One bridge file supplies the legacy theme and localisations. Remove when the package migrates |
| D-11 | All configuration through `--dart-define`; release builds have no endpoint default | Production hosts are not in the repository; a development address must not ship as a default |
| D-13 | Application id `com.betik.mobile` (Android namespace remains `com.betik.betik`) | Placeholder; Stage 2 Q-08 is unanswered. Change before the first store upload — it cannot change afterwards |
| D-18 | One lint disabled (`use_null_aware_elements`), formatter width 140 | Readability of widget trees |

## Compatibility

| ID | Decision | Reason |
|---|---|---|
| D-07 | Paragraph index = ordinal of top-level `<p>` elements only | This is what the website's `ParagraphRenderer` does. Stage 2 text and the Stage 3 brief say "every top-level element"; following that would shift every bookmark and paragraph comment after the first heading, list or quote. **Needs owner confirmation** |
| D-08 | Page count is an exact port of the website's `htmlPageSplitter` (1,200 characters per page, block filling) | `pageCount` is written by the client on save; both clients must agree |
| D-09 | Copy protection: "Kopyala" in the reader puts the website's notice text on the clipboard; the selection menu offers "Alıntıla" | Same behaviour as the website's copy handler |
| D-16 | A chapter whose HTML would not survive the editor round trip opens read-only with a warning | Never silently damage content written on the website |

## Session and platform

| ID | Decision | Reason |
|---|---|---|
| D-10 | Token in Keychain/Keystore; `exp` checked locally; null `me` or `UNAUTHENTICATED` = signed out; no refresh | Backend has a 24 h JWT, no refresh token, and treats bad tokens as guests |
| D-14 | ~~Google sign-in on iOS behind `BETIK_GOOGLE_SIGN_IN_IOS`~~ **Superseded 23 Nov 2026:** Google sign-in is a product requirement on both platforms; the switch was removed and the button is always shown (unconfigured builds explain instead of hiding it). Guideline 4.8 stays an open owner decision (BLK-02) | Owner instruction; `google_sign_in_setup.md` |
| D-15 | Password reset inside the app: paste the e-mailed link, or open it through a deep link | The e-mail links to the website; no backend change allowed |

## Deliberate differences from the website

Each one fixes a defect recorded in Stage 2 or adapts a browser behaviour. None changes what is sent to the backend except where stated.

| Ref | Website | App |
|---|---|---|
| Stage 2 B-01 | ISBN lookup failure shows a raw script error | Shows the server's message |
| Stage 2 B-02 | Followers-only content fails without explanation | Explains that the content is for followers |
| Stage 2 B-03 / B-04 | A non-owner can open the writing dashboard and sees errors | Non-owners are turned away |
| Stage 2 B-06 | Guest quote attempt fails silently | Sign-up prompt |
| Stage 2 B-07 | Links in chapters are unstyled | Styled; open in the external browser |
| Stage 2 B-09 | Conversation list is stale until reload | Refreshes when the unread count changes |
| Stage 2 B-11 | Funding filter is lost after sorting by "closest to target" | Restored |
| Stage 2 B-12 | Empty chapter title is accepted silently; new chapter not selected | Message shown; new chapter selected |
| D-12 | Session creator sees the access-code gate of their own private session | Gate skipped for the creator unless the server refuses |
| — | Terms link on registration goes nowhere | Opens the terms page |
| — | Avatar crop is free-form | 1:1 crop |
| — | Several failures are swallowed | Errors are shown as toasts |
| — | Leaderboard has no empty state | Empty state added |
| — | Profile username is not validated on edit | Validated with the registration rule (stricter than the server on edit) |
| — | Change e-mail leaves a dead session | Signs out at once (the server has already revoked the token) |
| — | Feed filters are a side column | Bottom sheet |
| — | Session like shows a toast | Kept |

## Not implemented by decision

- F-NAV-10 decorative mascots (cosmetic).
- F-FUND-08 legacy backers avatars (admin-only and not visible on the website).
- F-NAV-08, F-NAV-09 are browser mechanisms (scroll restoration, PWA install).
