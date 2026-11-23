# Implementation progress

Final state of Stage 3. Feature-level status is in `feature_parity_matrix.md`.

| Milestone | Outcome |
|---|---|
| 1. Toolchain and project | Flutter 3.50 project `betik` in `Client/mobile/`; fonts and images taken from the website; platform identifiers and manifests set |
| 2. Core | Config, GraphQL HTTP client, WebSocket client, session and secure storage, auth controller, router with guards, theme, shared widgets, models, 165 GraphQL documents |
| 3. Compatibility logic | Sanitiser, paragraph index, page count and Quill HTML ⇄ Delta ported and checked against fixtures generated from the website's JavaScript |
| 4. Auth and shell | Login, two-step registration, forgot/reset password, Google button (blocked on OAuth clients, see google_sign_in_setup.md), tabs, drawer, badges, guest gate with registration intent |
| 5. Discovery and book | Landing, feed with search/filters/sort, recommendations and genre onboarding, authors, book detail, comments with mentions, author controls, classification |
| 6. Reader | Native HTML rendering, resume, chapter list, progress with offline queue, reading-time reporting, bookmarks, paragraph comments, quotes from selection, copy protection, guest gate |
| 7. Authoring | Create book, dashboard, native rich-text editor with autosave, chapter management, publication panel, image upload (unconfigured) |
| 8. Social | Sessions (list, create, private gate, live entries), profile and settings, follow, quotes, messaging with live delivery, notifications, sharing, leaderboard |
| 9. Catalogue and funding | Printed books (catalogue, submission, reviews, claims), funding panel, checkout, history, print application workspace |
| 10. Staff | Admin overview, data browser and record editor, schema, review queues, print-funding administration, publisher catalogue |
| 11. Community | About, contact, legal texts, newsletter, not-found |
| 12. Validation | Analysis clean; 157 unit/widget tests; 10 live API tests; simulator journey with 18 screenshots; Android debug and iOS builds; defects found on device fixed |
| 13. Documentation | This folder |

Counts at the end of the implementation: 171 features tracked — 167 implemented, 2 not started, 2 not applicable; of the implemented, 30 verified, 56 partially verified, 79 not verified, 2 blocked.

| 14. Verification pass (17–23 Nov 2026) | Disposable sandbox; eight integration suites (129 scenarios) on the iOS simulator and the Android emulator; defects V-01…V-10 fixed; matrix updated — see `verification_log.md` |

Counts after the verification pass: of the 167 implemented, 156 verified, 8 partially verified, 2 not verified, 1 blocked, 0 failed.
