# Mobile behaviour notes

Observations from the responsive website at 393×852 and what they imply for an Android/iOS app. These are inputs for Stage 3, not design decisions.

## How the website behaves on a phone today

| Area | Observation | Usability note |
|---|---|---|
| Navigation | Hamburger slide-out with ten rows; badges inside the menu only | Unread counts are invisible until the menu is opened |
| Feed | The filter panel (four selects, tag search, two radio groups) comes before the first book | A full screen of controls before content |
| Book detail | Long single column: metadata, actions, summary, classification, interest, campaign, comments | Primary actions (read, support) scroll away |
| Reader | Site bar stays; chapter list behind "Bölümler (N)"; help card takes most of the first screen until dismissed; bookmark and comment icons under every paragraph | Reading area is reduced; icon pairs add vertical space |
| Quote creation | Depends on native text selection (long-press, drag handles) and a popup | Not exercised on touch; fragile on the web |
| Editor | Quill toolbar wraps; chapter list in a drawer | Usable, but toolbar and keyboard compete for space |
| Messages | List or chat, one at a time | Works; the list is not live |
| Sessions | Composer hint mentions Ctrl+Enter | Meaningless on a phone |
| Profile | Stacked card, 2×2 stats, full-width buttons, seven tabs in a wrapping row | Tabs wrap to several lines |
| Settings | Six sub-tabs inside the profile tab | Three levels deep (profile → Ayarlar → section) |
| Funding | Long forms; many consent texts | Works without overflow |
| Admin | Dense tables | Desktop-oriented |
| Confirmations | Native `confirm()` dialogs | Need native equivalents |
| Layout | No horizontal overflow on 15 screens checked | — |

## Behaviours the app must reproduce exactly (data compatibility)

1. **Paragraph index** = zero-based index of each top-level HTML element of a chapter. Bookmarks and paragraph comments depend on it.
2. **Chapter HTML** as produced by the editor (see `reader_and_editor.md` §1), including base64 `<img>` and escaped entities.
3. **`pageCount`** is computed on the client and sent with every chapter save.
4. **Quote payload**: text, optional note, visibility, spoiler flag, chapter index/title and `location` offsets; duplicate check before saving.
5. **Reading progress**: `completedChapterIds` + last chapter, with an offline queue.
6. **Reading time**: session start, then a report roughly every 15 s with an increasing sequence number.
7. **Checkout**: client-generated `idempotencyKey`, amounts in minor units.
8. **Mentions**: plain `@username` in text; the server and renderers turn them into links.
9. **Auth**: bearer token; any `UNAUTHENTICATED` answer means sign out locally.
10. **Real time**: `graphql-ws` with the token in `connection_init`; subscriptions for score updates, new messages in an open chat and new session entries. Everything else is polling (unread counts about every 15 s) or reload.

## Desktop-only interactions and their purpose

| Web interaction | Purpose to preserve |
|---|---|
| Mouse text selection → quote popup | Save a passage as a quote with note and visibility |
| Hover styles | None are functionally required (paragraph actions are always visible) |
| Ctrl+Enter in session composer | Quick send |
| Enter in chat and quote-comment inputs | Send |
| `beforeunload` prompt in the editor | Do not lose unsaved text when leaving |
| Browser Back/legacy URL redirects | Deep links from notifications and shared links must resolve (`/book-detail/<id>#comment-<id>`, `/oturum/<slug>#entry-<id>`, `/kitap/<slug>/bolum/<chapter>`, `/quotes/<id>`, `/yazar/<username>`, `/reset-password/<token>`, `/newsletter?token=`) |
| Copy link / download story image in share dialog | Share a public URL (the API `/share/...` address, which serves preview tags and redirects) |
| File chooser for covers, avatars, PDFs, chapter images | Pick media or documents |
| `<details>` menu for chapter actions | Per-chapter actions (hide, share) |

## Things that exist on the web and need a decision for mobile

- **Admin and publisher areas.** Verified working on the web; whether they belong in the app is still open (Stage 1 Q-01).
- **Print application workspace** (PDF uploads, long cost forms) — author-only and document-heavy.
- **Sandbox payment simulation buttons** — a test-mode feature; real checkout through iyzico was not observable.
- **Legal pages** are marked as drafts on the site itself.
- **Reading font size** is stored per device and has three steps; no theme switch exists.
- **Service worker / install prompt** are irrelevant to a native app.

## External dependencies a mobile client will meet

Cloudinary unsigned upload from the client (covers, avatars, session covers); Google sign-in (redirect flow posting to the API); iyzico checkout form (not seen); share targets (WhatsApp, Telegram, X); e-mail links for verification-free flows (reset password, newsletter).

## Performance-related observations

- Opening the reader triggers about a dozen requests (viewer, detail, bookmark, progress, reader data, chapter, comment counts, view increment, session start).
- Unread counters are polled on every page.
- A 20,000-character chapter rendered and scrolled without issues; base64 images inflate chapter payloads.
- The publisher portal states its own 30-second refresh.
