# 07 — Feature Inventory (Index)

The inventory is split by domain. Every feature has a **stable identifier** `F-<DOMAIN>-<NN>` intended for Stage 2 verification tracking and Stage 3 implementation tracking. Identifiers must not be renumbered; add new numbers at the end of a domain.

Each entry records: purpose · entry point · page/component · inputs · business rules · API dependencies · state changes · validation · success behaviour · failure behaviour · permissions · source files · items needing runtime verification · responsibility (FE / BE / SH shared / BR browser API / EXT external). Field key: top of `07a`.

> **Nothing in this inventory has been verified at runtime.** Statements describe what the source code does. Stage 2 must confirm them.

## Files and counts

| File | Domains | Features |
|---|---|---|
| `07a_features_auth_shell_discovery.md` | AUTH (10), NAV (11), NOT (3), DISC (6) | 30 |
| `07b_features_books_reading.md` | BOOK (9), COMM (6), READ (13) | 28 |
| `07c_features_writing_sessions.md` | WRITE (8), SESS (13) | 21 |
| `07d_features_social_profile.md` | PROF (7), FOLLOW (4), SET (8), QUOTE (9), MSG (9), SHARE (1), SCORE (4) | 42 |
| `07e_features_printed_funding_community.md` | PRINTED (7), FUND (8), COM (6) | 21 |
| `07f_features_admin_publisher.md` | PUB (1), ADM (13) | 14 |
| **Total** | 21 domains | **156** |

Counting definition: one feature = one `### F-…` entry (a user-visible capability or a client behaviour that the mobile app must consciously reproduce or consciously drop).

## Master list

| ID | Feature | Guest | Member | Role |
|---|---|:-:|:-:|---|
| F-AUTH-01…10 | Login, registration with code, Google sign-in, forgot/reset password, logout, password meter, session lifecycle, route guards, registration-intent replay | ✔ | ✔ | |
| F-NAV-01…11 | Nav bar, mobile menu, footer, readable URLs/legacy redirects, not-found, page boundary, toasts, scroll restore, PWA prompt, decorative mascots, reading font size | ✔ | ✔ | |
| F-NOT-01…03 | Notification bell, notification deep links, follow requests panel | | ✔ | |
| F-DISC-01…06 | Landing, explore feed (search/filter/sort/paging), recommendations tab, genre onboarding, book card, authors directory | ✔ | ✔ | |
| F-BOOK-01…09 | Book detail, card interactions, like, save, follow, read/support, share, author publication controls, classification edit | ✔ (read) | ✔ | author/admin for 08–09 |
| F-COMM-01…06 | Comment list, add, reply, like, delete, mention autocomplete | ✔ (read) | ✔ | |
| F-READ-01…13 | Open/resume, chapter list, navigation/completion, progress sync, reading-time points, bookmark, paragraph comments, quote by selection, copy protection, registration gate/hidden chapters, view count, share chapter, HTML rendering | ✔ (limited) | ✔ | |
| F-WRITE-01…08 | Create book, classification fields, image upload, dashboard chapters, editor + autosave, hide chapter, share chapter, publication panel | | ✔ | author |
| F-SESS-01…13 | Sessions list, access request, create, detail, private gate, post, live updates, like, delete, close, cover edit, entry deep link, share | ✔ (read) | ✔ | approved creator for 03 |
| F-PROF-01…07 | View profile, edit profile, follow lists, message from profile, share, funding shortcut, grouped quotes | ✔ (read) | ✔ | |
| F-FOLLOW-01…04 | Request/cancel/unfollow, accept/reject, follow notifications, remove follower | | ✔ | |
| F-SET-01…08 | Change e-mail, change password, privacy, notifications, author settings, appearance, deactivate, delete account | | ✔ | |
| F-QUOTE-01…09 | Feed, search, card, like, repost, comments, detail, (delete — not in UI), printed-book quote | ✔ (read) | ✔ | |
| F-MSG-01…09 | Conversation list, start conversation, chat, send, real-time, delete, (edit — not in UI), share into chat, attachments | | ✔ | |
| F-SHARE-01 | Share dialog for book/chapter/quote/profile/session | ✔ | ✔ | |
| F-SCORE-01…04 | Leaderboard, point rules, live refresh, badges | ✔ (read) | ✔ | |
| F-PRINTED-01…07 | Catalogue, submit, my submissions, detail (comments + quotes), rate/review, shelf, author claim | ✔ (read) | ✔ | |
| F-FUND-01…08 | Funding panel/interest, campaign card, checkout, payment card, history, author application, legacy result pages, legacy backers | ✔ (view) | ✔ | author for 06 |
| F-COM-01…06 | About, contact, legal, newsletter, authors, footer socials | ✔ | ✔ | |
| F-PUB-01 | Publisher catalogue | | | PUBLISHER/ADMIN |
| F-ADM-01…13 | Overview, data browser, record editor, schema viewer, printed review, session-access review, print application review, campaigns, production, payments/refunds/orders, tariffs, maintenance, in-screen admin powers | | | ADMIN |

## Features defined in code but not reachable in the web UI

| Capability | Status |
|---|---|
| Delete own quote (`deleteQuote`) | backend only (F-QUOTE-08) |
| Edit message (`editMessage`) | backend + unused props (F-MSG-07) |
| Like quote comment / paragraph comment | backend + unused gql documents |
| Edit book title/description/cover (`updateBook`) | backend only |
| Group conversations | model fields only |
| Legacy donation (`initializePayment`) | disabled |

## Frontend/backend responsibility mapping (summary)

| Responsibility | Features (representative) |
|---|---|
| **Entirely frontend** | F-NAV-06/07/08/11, F-SET-06, F-AUTH-07, card-derived values in F-BOOK-02, session search in F-SESS-01, comment threading in F-COMM-01 |
| **Entirely backend** | F-SCORE-02, F-FOLLOW-03, recommendation scoring in F-DISC-03, visibility/privacy enforcement, rate limits, notification creation, print-funding accounting |
| **Shared** | most CRUD features: client validates/optimistically updates, server enforces |
| **Browser-API dependent** | F-AUTH-03/08/10, F-NAV-04/09, F-READ-04/05/08/09, F-WRITE-03/05, F-SHARE-01, F-FUND-03/06 |
| **External-service dependent** | F-AUTH-03 (Google), F-WRITE-03 / F-SESS-03/11 / F-PROF-02 (Cloudinary), F-AUTH-02/04, F-SET-01, F-COM-02/04 (SMTP), F-FUND-04 (iyzico), F-PRINTED-02 (ISBN lookup) |

The complete list of frontend-only algorithms that Flutter must re-implement is in `06_frontend_architecture.md` §9. End-to-end traces for the most important operations are in `08_business_rules.md` §12.
