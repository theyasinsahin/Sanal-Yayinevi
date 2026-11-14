# Discrepancies and bugs

Nothing here was fixed in the product. Items are grouped by kind; each says how it was observed.

## A. Application bugs (reproduced in the running site)

| ID | Area | What happens | Expected | Evidence |
|---|---|---|---|---|
| B-01 | Printed book form | "ISBN İLE BUL" with an invalid ISBN: the server answers "Geçerli bir ISBN-10 veya ISBN-13 girin.", but the toast shows the raw JavaScript error `Cannot read properties of undefined (reading 'lookupPrintedBook')` | The server message | Run 44 log |
| B-02 | Sessions | A non-follower opening a followers-only session gets the generic "Sayfa yüklenemedi. Tekrar dene" state | An explanation that the session is for followers | `sessions/followers_only_denied` |
| B-03 | Writing dashboard | A member can open `/dashboard/<id>` of another author's public book and gets the complete authoring interface (publish buttons, editable text). Every save fails with "Bu kitaba içerik eklemek için onaylanmış yazar yetkisi gerekir." and the badge shows "KAYDEDİLEMEDİ" | Redirect or a no-access message. The server does protect the data | `writing/dashboard_as_non_owner` |
| B-04 | Writing dashboard | For another author's draft the same URL stays on "Kitap yükleniyor…" indefinitely | Not-found or no-access state | Run 65 log |
| B-05 | Notifications | Like → unlike → like on a book creates two "Kitabın beğenildi" notifications | One | `notifications/panel_author` |
| B-06 | Reader | Guests are told "Alıntı kaydetmek için giriş yapmalısınız.", yet selecting text still opens the quote form with an active Kaydet button | No form, or a sign-in prompt | Run 14 log |
| B-07 | Reader | Links written in the editor (`target="_blank"`) open in the same tab in the reader and appear in default browser blue | Consistent link behaviour and styling | `reader/reader__mobile` |
| B-08 | Messaging | Deleting a message removes it only for the sender; the other participant keeps seeing it until reload | Live removal, as new messages are live | Run 21 log |
| B-09 | Messaging | The conversation list does not update when a message arrives; only the nav badge changes (polling) | List refresh | Run 20 log |
| B-10 | Sessions | Likes and deletions of entries are not pushed to other viewers, although new entries are | Consistent live updates | Runs 25–26 logs |
| B-11 | Feed | Choosing sort "Hedefe en yakın" switches the support filter to "Desteği açık kitaplar" and leaves it there when another sort is chosen, so the list can stay empty | Filter restored, or the coupling made visible | Run 42 log |
| B-12 | Dashboard | "EKLE" with an empty chapter title does nothing and shows no message; a newly created chapter is not selected | Feedback; arguably auto-select | Run 03 log |
| B-13 | Console | React prop-type warnings on Dashboard, Create Book and Book Detail (`Input.name`, `Toast.type`, `Button.variant/children`) | None | Run 02 log |

B-03 is the most important: it is a missing client guard, not a data leak (hidden chapters are not exposed and writes are refused).

## B. Differences from Stage 1 expectations

| ID | Stage 1 statement | Observed |
|---|---|---|
| S-01 | F-READ-09 copy protection | A synthetic copy and context-menu event were not blocked and text is selectable. Needs a manual check with the real clipboard before deciding whether the mobile app must block copying |
| S-02 | F-READ-01 "resume position" | Resume is per chapter only. Reopening lands on the last chapter at the top; scroll position is not restored. The bookmark is the only paragraph-level return point |
| S-03 | F-FOLLOW-01 privacy combinations | Following is always a request, also for public profiles |
| S-04 | F-SET-01 change e-mail | The address changes immediately; the new address only receives an information mail (no verification step) |
| S-05 | U-08 image format in chapters | The editor's image button embeds the file as a base64 `data:` URI inside the chapter HTML; Cloudinary is not involved |
| S-06 | F-NAV-08 scroll restoration | Navigation starts at the top; browser Back also returned to the top in the test |
| S-07 | F-COMM-05 / F-ADM-13 | Neither the book's author nor an admin has a delete control on other users' comments in the regular screens; admins moderate through the data browser |
| S-08 | Reader URL | The address stays `/kitap/<slug>/oku` for every chapter; chapter URLs exist only as share/deep links |
| S-09 | Error codes | In development mode most business errors arrive with code `INTERNAL_SERVER_ERROR` plus a user-facing Turkish message; only some use `BAD_USER_INPUT` / `UNAUTHENTICATED`. The app should rely on messages and HTTP/GraphQL status, not on fine-grained codes. Production masking was not observable |
| S-10 | Dates | All observed API dates are ISO-8601 UTC strings (U-04) |
| S-11 | Page count | 19,966 characters of text produced `pageCount` 20 (not 17), so the count is not simply text length ÷ 1200; the book total includes hidden chapters |

## C. Environment and seed-data problems

| ID | Problem | Effect | Handling |
|---|---|---|---|
| D-01 | Seeded draft book has no description, but `Book.description` is non-nullable | The author's own profile shows "Profil yüklenemedi" | Description added in the sandbox database (`profile/own_author_error_state` shows the original state) |
| D-02 | Development seed does not create classification terms | "Eser biçimi" has no options, so no book can be created | Ran the application's `seedClassification()` |
| D-03 | Development seed does not create badges | No badges can be earned | Ran `seedBadges.js` |
| D-04 | `./dev` requires Docker and Linux/WSL | Documented path unusable on this Mac | Direct Node run |
| D-05 | API has no bind-address setting in normal mode | Reachable on the LAN while running | Recorded in `environment.md` |
| D-06 | Root `.env` holds live-looking integration values | Not used | — |

## D. Missing test data

Only two public digital books and two printed books existed, so cursor paging, "Daha fazla göster", long lists and ranking order could not be exercised. No campaign reached its goal, so production and delivery states were never produced.

## E. Integration limitations

Google sign-in (not configured), real Cloudinary uploads and cropping (intercepted), iyzico (mock provider used), Open Library ISBN lookup (not called), service worker / install prompt (not present on the dev server).

## F. Unverified behaviour

See `unresolved_scenarios.md`.
