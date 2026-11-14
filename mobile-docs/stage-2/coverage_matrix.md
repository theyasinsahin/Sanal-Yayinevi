# Coverage matrix — Stage 1 features

Status is based only on interactions with the running sandbox. Evidence paths are relative to `screenshots/` (files end in `__desktop.png`, `__mobile.png` or `__tablet.png`); "—" means the evidence is the logged network/DOM output of the run scripts.

**Totals (156 features):** VERIFIED 114 · BLOCKED 2 · PARTIAL 35 · NOT TESTED 5

| ID | Feature | Role | Tested scenario / observed | Status | Evidence | Limitation |
|---|---|---|---|---|---|---|
| F-AUTH-01 | E-mail / password login | guest | Empty, wrong password, correct login for 4 seeded roles + new user | **VERIFIED** | auth/login_error | No show-password toggle exists |
| F-AUTH-02 | Registration with e-mail verification code (2 steps) | guest | 2-step registration with mailed 6-digit code (local mail sink); meter; terms; resend countdown | **VERIFIED** | auth/register_code_step, auth/after_register | Wrong-code and duplicate-identity messages not captured |
| F-AUTH-03 | Google sign-in / sign-up | guest | Google button not rendered (no client id in sandbox) | **BLOCKED** | — | Needs a real Google OAuth client; not simulated |
| F-AUTH-04 | Forgot password | guest | Unknown and known e-mail give same neutral confirmation; mail captured | **VERIFIED** | auth/forgot_sent |  |
| F-AUTH-05 | Reset password from e-mailed link | guest | Invalid token, mismatch, success, reused link | **VERIFIED** | auth/reset_done |  |
| F-AUTH-06 | Logout | member | Logout mutation, storage cleared, → /login | **VERIFIED** | — | "Revokes all sessions" not checked on a 2nd device |
| F-AUTH-07 | Password strength indicator | guest | Çok Zayıf / İyi / Güçlü with 5 rules | **VERIFIED** | auth/register_password_meter |  |
| F-AUTH-08 | Session persistence, validation and expiry handling | member | Persisted across reloads; corrupted token and post-reset/-change sessions → /login | **PARTIAL** | — | Natural token expiry and expiry timer not observed |
| F-AUTH-09 | Route guards | all | Guest, member, publisher, admin redirects on protected routes | **VERIFIED** | guards/* | Dashboard of another author's public book is NOT guarded client-side (D-04) |
| F-AUTH-10 | “Registration intent” (deferred action after sign-up) | guest | Intent modals for like and next chapter shown | **PARTIAL** | auth/guest_action_prompt, reader/guest_gate_after_next | Replay of the deferred action after sign-up not exercised |
| F-NAV-01 | Top navigation bar | all | Role-dependent items, badges | **VERIFIED** | discovery/* |  |
| F-NAV-02 | Mobile slide-out menu | member | Hamburger slide-out with badges, logout | **VERIFIED** | nav/mobile_menu_member |  |
| F-NAV-03 | Footer | all | Footer links, newsletter form, socials | **VERIFIED** | discovery/landing_guest |  |
| F-NAV-04 | Readable URLs and legacy URL redirection | all | /book-detail, /user, /sessions/:id legacy ids redirect to readable URLs | **VERIFIED** | — |  |
| F-NAV-05 | Not Found page | all | Unknown route, unknown slugs, hidden chapter, deactivated user → 404 page | **VERIFIED** | nav/notfound_guest |  |
| F-NAV-06 | Page-level loading and crash boundary | all | "Sayfa yüklenemedi" offline state with reload button; same generic state for followers-only session | **PARTIAL** | nav/offline_feed, sessions/followers_only_denied | Lazy-chunk loading state not captured |
| F-NAV-07 | Toast notifications | all | Success/error toasts, auto-dismiss, "Bildirimi kapat" | **VERIFIED** | — |  |
| F-NAV-08 | Scroll restoration / scroll-to-top | all | New navigation starts at top | **PARTIAL** | — | Back navigation returned to top (no position restore) in the test |
| F-NAV-09 | PWA install prompt & service worker | all | manifest.json linked; no service worker registered in dev server; no install UI | **BLOCKED** | — | Requires production build/HTTPS |
| F-NAV-10 | Decorative “personal foxes” | all | Decorative mascots visible in screenshots | **PARTIAL** | discovery/landing_guest | Behaviour not analysed |
| F-NAV-11 | Reading font-size preference & theme | member | Küçük/Orta/Büyük = 16/18/20 px, stored locally | **VERIFIED** | reader/font_large, settings/font_large | No theme switch found |
| F-NOT-01 | Notification bell with unread badge | member | Badge, ~15 s polling, panel marks all read | **VERIFIED** | notifications/panel_author |  |
| F-NOT-02 | Notification deep-link targets | member | Comment-mention link → book detail #comment anchor | **PARTIAL** | — | Other notification types not clicked one by one |
| F-NOT-03 | Follow requests inside the notification panel | member | Request shown with KABUL ET / REDDET; accept verified | **VERIFIED** | notifications/follow_request_in_panel | Reject not exercised |
| F-DISC-01 | Landing page | all | Hero, in-place search, popular books, how-it-works, partner | **VERIFIED** | discovery/landing_guest |  |
| F-DISC-02 | Explore feed (“Keşfet”) with search, filters, sort, pagination | all | Search debounce, filters, sorts, support filter, empty state | **PARTIAL** | discovery/feed_* | Cursor paging not exercisable with 2 books |
| F-DISC-03 | “Senin için” personalised recommendations tab | member, guest | Recommendations with reason badge; guest CTA | **VERIFIED** | discovery/for_you |  |
| F-DISC-04 | Genre-preference onboarding / edit | member | Onboarding picker shown without preferences; preferences saved via settings | **PARTIAL** | discovery/genre_onboarding | Submitting from the onboarding panel itself not exercised |
| F-DISC-05 | Book card | all | Cover, page badge, classification chips, counters, share, campaign strip | **VERIFIED** | discovery/feed_open_campaign |  |
| F-DISC-06 | Authors directory | all | Authors list with counts and paging controls | **VERIFIED** | discovery/authors_guest | Single page of data |
| F-BOOK-01 | Book detail page (digital book) | all | Digital book detail incl. classification, interest, campaign, comments | **VERIFIED** | books/detail_reader |  |
| F-BOOK-02 | Book card interactions | all | Card opens detail/author; share button present | **PARTIAL** | — | Card share dialog not opened separately |
| F-BOOK-03 | Like a book | member | Like toggle; guest → intent modal | **VERIFIED** | books/detail_after_interactions | Unlike/like again creates a second notification (D-07) |
| F-BOOK-04 | Save book to library | member | Save toggle + toast; appears under Dijital Kitaplık | **VERIFIED** | — |  |
| F-BOOK-05 | Follow a book (new-chapter notifications) | member | Follow toggle label change | **VERIFIED** | — | New-chapter notification not waited for |
| F-BOOK-06 | Read / Support buttons | member | KİTABI OKU → reader; DESTEK OL → checkout | **VERIFIED** | funding/donate_no_campaign |  |
| F-BOOK-07 | Share book | all | Share dialog and link | **VERIFIED** | share/book_share_dialog | External targets not opened |
| F-BOOK-08 | Author publication controls | author | Draft ↔ Writing → Completed, confirms, delete book | **VERIFIED** | writing/after_publish, writing/after_complete | +50 award not isolated |
| F-BOOK-09 | Edit classification inline | author | Inline classification editor saved | **VERIFIED** | writing/classification_editor |  |
| F-COMM-01 | List comments with one-level replies | all | List with one-level replies | **VERIFIED** | comments/thread_with_reply |  |
| F-COMM-02 | Add comment | member | Add comment, toast | **VERIFIED** | — |  |
| F-COMM-03 | Reply to comment | member | Reply with prefilled @user | **VERIFIED** | comments/reply_box |  |
| F-COMM-04 | Like comment | member | Like toggle | **VERIFIED** | — |  |
| F-COMM-05 | Delete own comment | member | Delete own with confirm | **VERIFIED** | — | Book author/admin cannot delete others' comments in UI |
| F-COMM-06 | `@mention` autocomplete (shared component) | member | Autocomplete list, insert, rendered link; private users excluded | **VERIFIED** | comments/mention_autocomplete |  |
| F-READ-01 | Open reader and resume position | member | Opens first/last chapter; resume to last chapter | **VERIFIED** | reader/open_first | Scroll position is not restored |
| F-READ-02 | Chapter list / table of contents | member | Sidebar list, read checkboxes, word/page counts | **VERIFIED** | reader/reader_sidebar_open |  |
| F-READ-03 | Chapter navigation and completion | member | Prev/next, complete & continue, last chapter Tamamla | **VERIFIED** | reader/book_finished |  |
| F-READ-04 | Reading-progress sync (offline tolerant) | member | Server save + local queue; offline change synced after reconnect | **VERIFIED** | — |  |
| F-READ-05 | Verified reading-time tracking → points | member | Session start, 15 s reports, +1 point per minute notification | **PARTIAL** | — | Idle/blur handling not measured |
| F-READ-06 | Bookmark (“ayraç”) on a paragraph | member | Set, move, remove, persist | **VERIFIED** | reader/bookmark_set |  |
| F-READ-07 | Paragraph comments | member | Open panel, add, delete, mention | **VERIFIED** | reader/paragraph_comment_added |  |
| F-READ-08 | Create a quote by selecting text | member | Too short, valid save with note, duplicate notice | **PARTIAL** | reader/quote_popup, reader/quote_duplicate | Private, spoiler, >1000 chars and touch selection not exercised |
| F-READ-09 | Copy protection | member | Copy/context-menu were not blocked in a synthetic test | **PARTIAL** | — | Needs manual confirmation with real clipboard |
| F-READ-10 | Registration gate and hidden chapters | guest, member | Guest sees chapter 1 only; hidden chapter invisible / 404 | **VERIFIED** | reader/guest_gate, reader/guest_gate_after_next |  |
| F-READ-11 | View counting | member | IncrementBookViews on open; counter grew | **VERIFIED** | — |  |
| F-READ-12 | Share chapter | member | Share dialog with chapter link | **VERIFIED** | share/chapter_share_dialog_reader |  |
| F-READ-13 | Chapter HTML rendering | member | All editor formats, link, base64 image, special characters render | **VERIFIED** | reader/long_chapter_scrolled, reader/reader__mobile | Links lose target=_blank and show default blue style |
| F-WRITE-01 | Create a new book (draft) | author | Validation, classification, cover, draft created | **VERIFIED** | writing/create_book_* | Needs classification seed (D-02) |
| F-WRITE-02 | Work classification fields | author | Format, ≤3 genres, tags, audience | **VERIFIED** | writing/cover_crop_modal | Tag add path only partly driven |
| F-WRITE-03 | Image upload (covers, session covers, avatars) | author | File chooser + upload with intercepted Cloudinary | **PARTIAL** | writing/cover_crop_modal | Real upload, crop UI, avatar and session cover not exercised |
| F-WRITE-04 | Writing dashboard: chapter list and management | author | Add (normal/hidden), select, delete with confirm | **VERIFIED** | writing/dashboard_seed_story | New chapter is not auto-selected |
| F-WRITE-05 | Rich-text chapter editor with autosave | author | Every toolbar action, autosave, flush on leave, beforeunload, offline failure/recovery, long text | **VERIFIED** | editor/* | Rich paste could not be simulated |
| F-WRITE-06 | Hide / show chapter | author | Hide/show from ⋯ menu | **VERIFIED** | editor/chapter_more_menu |  |
| F-WRITE-07 | Share chapter from the dashboard | author | Share dialog from dashboard | **VERIFIED** | share/chapter_share_dialog_dashboard |  |
| F-WRITE-08 | Publication status panel in the dashboard | author | All three states and their buttons | **VERIFIED** | writing/after_publish, writing/after_complete |  |
| F-SESS-01 | Sessions list | all | List, type badges, client search, empty state | **VERIFIED** | sessions/list_three_types |  |
| F-SESS-02 | Request permission to create sessions | member | Request with reason → pending state | **VERIFIED** | sessions/access_requested |  |
| F-SESS-03 | Create session | approved author | Open, followers-only, private with code; validation | **VERIFIED** | sessions/create_modal, sessions/create_private | Cover upload not used |
| F-SESS-04 | Session detail and entry feed | all | Detail, entries newest first, guest read-only | **VERIFIED** | sessions/detail_author, sessions/detail_guest |  |
| F-SESS-05 | Private session access-code gate | member | Wrong and right code | **VERIFIED** | sessions/private_gate |  |
| F-SESS-06 | Post an entry | member | Post by button and Ctrl+Enter, mention | **VERIFIED** | sessions/detail_reader_entries |  |
| F-SESS-07 | Live updates | member | New entries pushed instantly | **PARTIAL** | — | Likes and deletions are not pushed live |
| F-SESS-08 | Like an entry | member | Like toggle | **VERIFIED** | — |  |
| F-SESS-09 | Delete own entry | member | Own entry menu → delete (no confirm) | **VERIFIED** | — |  |
| F-SESS-10 | Close session | owner | Confirm, close, removed from list | **VERIFIED** | sessions/closed |  |
| F-SESS-11 | Edit session cover | owner | Editor opens; save sent empty cover | **PARTIAL** | sessions/cover_edit | Image selection not completed |
| F-SESS-12 | Deep link to an entry | member | #entry-id focuses entry | **VERIFIED** | — |  |
| F-SESS-13 | Share session | member | Share dialog link | **VERIFIED** | — |  |
| F-PROF-01 | View a profile (own or other) | all | Own, other, private, deactivated | **VERIFIED** | profile/* |  |
| F-PROF-02 | Edit own profile | member | Inline edit of name and bio | **PARTIAL** | profile/edit_mode | Avatar upload and username change not exercised |
| F-PROF-03 | Followers / following lists | member | Followers modal; hidden as "Gizli" when private | **VERIFIED** | profile/followers_modal |  |
| F-PROF-04 | Message a user from their profile | member | Opens/creates conversation; disabled when messages closed | **VERIFIED** | messaging/chat_opened_from_profile |  |
| F-PROF-05 | Share profile | member | Button present | **PARTIAL** | — | Profile share dialog not opened |
| F-PROF-06 | “Desteklerim” shortcut | member | DESTEKLERİM → /funding-history | **VERIFIED** | — |  |
| F-PROF-07 | Grouped quotes on profile | member | Quotes grouped by book | **VERIFIED** | profile/quotes_tab |  |
| F-FOLLOW-01 | Send follow request / cancel / unfollow | member | Send, cancel, resend; state becomes TAKİBİ BIRAK | **PARTIAL** | — | Unfollow click not exercised |
| F-FOLLOW-02 | Incoming requests: accept / reject | member | Accept from bell | **PARTIAL** | notifications/follow_request_in_panel | Reject not exercised |
| F-FOLLOW-03 | Notifications for follow events | member | "Yeni takipçin var", "Takip isteğin kabul edildi" | **VERIFIED** | — |  |
| F-FOLLOW-04 | Remove a follower | member | — | **NOT TESTED** | — | Remove-follower control not exercised |
| F-SET-01 | Change e-mail | member | Wrong password, success, info mail, session invalidated | **VERIFIED** | — |  |
| F-SET-02 | Change password | member | Mismatch, success, session invalidated | **VERIFIED** | — |  |
| F-SET-03 | Privacy settings | member | All toggles + message audience; effects seen from 2nd account | **VERIFIED** | profile/private_profile_as_non_follower |  |
| F-SET-04 | Notification settings | member | Toggle saved | **VERIFIED** | settings/bi_ld_r_mler | Suppression of the notification itself not re-tested |
| F-SET-05 | Author settings | member | Word goal and preferred genres saved | **VERIFIED** | settings/yazar |  |
| F-SET-06 | Appearance (reading font size) | member | Live preview + save, applied in reader | **VERIFIED** | settings/font_large |  |
| F-SET-07 | Deactivate account | disposable user | Inline confirm, logout, 404 for others, login reactivates | **VERIFIED** | settings/deactivate_confirm |  |
| F-SET-08 | Delete account permanently | disposable user | Typed phrase, delete, login refused | **VERIFIED** | settings/delete_confirm |  |
| F-QUOTE-01 | Quotes feed | all | Feed, sort tabs, end marker | **VERIFIED** | quotes/feed_one_quote |  |
| F-QUOTE-02 | Search quotes | all | Debounced search, empty state | **VERIFIED** | — |  |
| F-QUOTE-03 | Quote card | all | Card anatomy | **VERIFIED** | quotes/feed_one_quote |  |
| F-QUOTE-04 | Like quote | member | Like toggle + notification to owner | **VERIFIED** | — |  |
| F-QUOTE-05 | Repost / undo repost | member | Repost with comment, undo | **VERIFIED** | — |  |
| F-QUOTE-06 | Quote comments | member | Inline comments, add | **VERIFIED** | quotes/card_comments |  |
| F-QUOTE-07 | Quote detail | all | Detail page and missing-quote message | **VERIFIED** | quotes/detail |  |
| F-QUOTE-08 | Delete own quote | member | Confirmed: no delete control for own quote | **VERIFIED** | — | Backend-only, as Stage 1 stated |
| F-QUOTE-09 | Add a quote from a printed book | member | Printed-book quote form | **VERIFIED** | printed/detail_with_review_quote |  |
| F-MSG-01 | Conversation list | member | List, empty state, unread badge | **VERIFIED** | messaging/list_author | List does not refresh live |
| F-MSG-02 | Start a conversation | member | Started from profile | **PARTIAL** | messaging/chat_opened_from_profile | Starting via recipient search not completed |
| F-MSG-03 | Chat window | member | Chat window, bubbles, time/date labels | **VERIFIED** | messaging/chat_reader |  |
| F-MSG-04 | Send text message | member | Enter/button, empty blocked, 3000 chars accepted | **VERIFIED** | — |  |
| F-MSG-05 | Real-time incoming messages | member | Instant when chat is open | **PARTIAL** | — | No live update on list view; deletions not pushed |
| F-MSG-06 | Delete own message | member | Own bubble menu → Sil (no confirm) | **VERIFIED** | messaging/bubble_menu |  |
| F-MSG-07 | Edit message | member | Confirmed: no edit control | **VERIFIED** | — |  |
| F-MSG-08 | Share a book or quote into a chat | member | — | **NOT TESTED** | — | Sharing a book/quote into a chat not exercised |
| F-MSG-09 | Attachment bubbles | member | — | **NOT TESTED** | — | Attachment bubbles not produced |
| F-SHARE-01 | Share dialog (book, chapter, quote, profile, session) | all | Dialogs for book, chapter, quote, session; preview page with OG tags and redirect | **PARTIAL** | share/* | Profile dialog, native share, image download not exercised |
| F-SCORE-01 | Leaderboard (“Aktiflik Tablosu”) | all | Podium + ranked list with data | **PARTIAL** | score/leaderboard_data | Period tabs not switched with differing data |
| F-SCORE-02 | Earning points (server-side rules) | member | Seen: +15 chapter, +5 comment, +5 session entry, +1 per reading minute, badge award | **PARTIAL** | — | Other rules not isolated |
| F-SCORE-03 | Live score refresh | member | MyScoreUpdated subscription opened on every page | **PARTIAL** | — | Live UI refresh not asserted |
| F-SCORE-04 | Badges on profile | member | Badge emojis on profile after seeding badges | **VERIFIED** | profile/own__mobile | Badges are empty in a fresh dev DB (D-03) |
| F-PRINTED-01 | Browse the printed catalogue | all | List, search, filters, paging | **VERIFIED** | printed/catalogue_* |  |
| F-PRINTED-02 | Submit a printed book for review | member | Form validation and submission | **PARTIAL** | printed/submit_form, printed/after_submit | Valid ISBN lookup (Open Library) not called; invalid lookup shows raw error (B-01) |
| F-PRINTED-03 | “Basılı Kitap Katkılarım” (my submissions) | member | "Basılı Kitap Katkılarım" with status | **VERIFIED** | printed/my_submissions |  |
| F-PRINTED-04 | Printed book detail | all | Detail with comments and quotes | **VERIFIED** | printed/detail_member |  |
| F-PRINTED-05 | “Okudum ve değerlendirdim” (rate & review) | member | Rate, review, update/remove controls | **VERIFIED** | printed/detail_with_review_quote |  |
| F-PRINTED-06 | “Okuduğum Basılı Kitaplar” shelf on profiles | member | Shelf tab with rating | **VERIFIED** | profile/printed_shelf |  |
| F-PRINTED-07 | Author claim on a printed book | author, admin | Claim → approval → author gains chapter access | **VERIFIED** | admin/printed_review |  |
| F-FUND-01 | Funding panel on the book detail page | all | Interest button and campaign panel | **VERIFIED** | funding/detail_campaign_card | Interest click itself not confirmed |
| F-FUND-02 | Campaign card | all | Campaign card in 4 places | **VERIFIED** | discovery/feed_open_campaign |  |
| F-FUND-03 | Support / pre-order checkout | member | Donation and pre-order carts, validation, idempotent retry controls | **VERIFIED** | funding/checkout, funding/checkout_preorder |  |
| F-FUND-04 | Payment card & completing a payment | member | Mock provider: success, failure, cancel | **VERIFIED** | funding/payment_success, funding/payment_failed | iyzico sandbox not used |
| F-FUND-05 | “Desteklerim ve ön siparişlerim” (funding history) | member | History with states incl. refund | **VERIFIED** | funding/history, funding/history_after_refund |  |
| F-FUND-06 | Author: print application workspace | author | Create, freeze version, submit | **PARTIAL** | funding/print_application_* | Revision request, cancel, re-edit not exercised |
| F-FUND-07 | Legacy payment result pages | guest | /payment/failure page; /payment/success guarded | **PARTIAL** | funding/legacy-failure_guest | Legacy flow is disabled |
| F-FUND-08 | Legacy backers avatars | all | — | **NOT TESTED** | — | No legacy backers data |
| F-COM-01 | About page | all | About page | **VERIFIED** | community/about_guest |  |
| F-COM-02 | Contact form | guest | Validation, send, mail captured | **VERIFIED** | community/contact_sent |  |
| F-COM-03 | Legal pages | all | Terms and privacy (marked as drafts) | **VERIFIED** | community/terms_guest |  |
| F-COM-04 | Newsletter subscription | guest | Consent, confirmation mail, confirm page | **VERIFIED** | community/newsletter_* | Unsubscribe link not followed |
| F-COM-05 | Authors directory | all | Same screen as DISC-06 | **VERIFIED** | discovery/authors_guest |  |
| F-COM-06 | Footer social links | all | Four social links present | **PARTIAL** | — | External links not followed |
| F-PUB-01 | Publisher catalogue (read-only) | publisher | Portal list, filter, auto-refresh note | **VERIFIED** | publisher/portal |  |
| F-ADM-01 | Admin overview dashboard | admin | Overview counters, queues, audit feed | **VERIFIED** | admin/overview |  |
| F-ADM-02 | Generic data browser | admin | Resource picker, search, status filter, table | **VERIFIED** | admin/data_comments |  |
| F-ADM-03 | Record editor with audit reason and optimistic locking | admin | Reason required, archive/restore with revision hash | **VERIFIED** | admin/record_editor | Conflict (stale revision) not provoked |
| F-ADM-04 | Schema viewer | admin | Schema table | **VERIFIED** | admin/schema_comment |  |
| F-ADM-05 | Printed-book review queue | admin | Approve submission and claim | **VERIFIED** | admin/printed_review | Reject not exercised |
| F-ADM-06 | Session-creation access review | admin | Approve | **PARTIAL** | admin/session_access_queue | Reject/revoke not exercised |
| F-ADM-07 | Print applications review | admin | Approve with full quote form | **PARTIAL** | admin/print_application_approve_form | Revision/reject not exercised |
| F-ADM-08 | Open / close funding campaigns | admin | Open campaign | **PARTIAL** | admin/print_funding_campaigns | Close not executed |
| F-ADM-09 | Production tracking | admin | — | **NOT TESTED** | — | Needs a campaign that reached its goal |
| F-ADM-10 | Payments, refunds, pre-orders | admin | Payments list, full refund, pre-order card | **PARTIAL** | admin/print_funding_payments | Delivery states not exercised |
| F-ADM-11 | Tariffs | admin | Tariff form viewed | **PARTIAL** | admin/print_funding_tariffs | No new tariff created |
| F-ADM-12 | Manual maintenance run | admin | Manual maintenance run completed refund | **VERIFIED** | — |  |
| F-ADM-13 | Admin powers inside regular screens | admin | Delete + classification on others' books, any dashboard | **PARTIAL** | — | Admin delete of a book not executed |

## Newly discovered features (not in the Stage 1 inventory)

Identifiers continue after the last Stage 1 number of each domain.

| ID | Feature | Role | Observed behaviour | Status | Evidence |
|---|---|---|---|---|---|
| F-READ-14 | "Alıntı nasıl eklenir?" help card | all | Dismissible instruction card at the top of the reader with a toggle button; guests get an extra login hint | VERIFIED | reader/open_first |
| F-READ-15 | Manual "read" checkbox per chapter | member | Sidebar checkbox toggles a chapter's completed state independently of navigation and updates "N bölümden M tanesi okundu" | VERIFIED | reader/reader_sidebar_open |
| F-READ-16 | Scroll progress bar | all | Thin bar at the top of the reader shows scroll percentage of the current chapter | VERIFIED | reader/long_chapter_scrolled |
| F-WRITE-09 | "Yeni bölümü gizli oluştur" | author | Checkbox creates the chapter already hidden | VERIFIED | writing/dashboard_seed_story |
| F-WRITE-10 | "OKUYUCU MODU" shortcut | author | Dashboard link opens the reader for the same book | VERIFIED | writing/dashboard_seed_story |
| F-BOOK-10 | Delete book from detail page | author, admin | SİL with native confirm → book removed → profile | VERIFIED | — |
| F-DISC-07 | "Tercihlerim" strip on the feed | member | Shows chosen genres with Düzenle next to the tabs | VERIFIED | discovery/for_you |
| F-SESS-14 | "Durumu yenile" for pending access | member | Pending applicants see a status line and refresh button | VERIFIED | sessions/access_requested |
| F-QUOTE-10 | Repost comment | member | Repost opens an inline form with an optional comment | VERIFIED | — |
| F-FUND-09 | Idempotent retry controls | member | After a failed checkout call: "Aynı işlemi güvenle yeniden sorgula" / "Yeni sepet hazırla" | VERIFIED | — |
| F-FUND-10 | Pending payment actions inside history | member | Pending reservations can be completed, failed or cancelled from the history list | VERIFIED | funding/history |
| F-FUND-11 | Frozen print version with hash | author | Saved application shows version id, SHA-256, downloadable cover PDF, cost estimate | VERIFIED | funding/print_application_saved |
| F-COM-07 | Newsletter confirmation page | guest | /newsletter?token&action=confirm with a confirm button | VERIFIED | community/newsletter_manage |
| F-ADM-14 | Audit trail browser | admin | AdminAudit resource lists every admin action with reason | VERIFIED | admin/data_comments |
| F-SHARE-02 | Story/Status image download | all | Share dialog offers "Görseli indir" and "Metin ve bağlantıyı kopyala" for Instagram/WhatsApp status | PARTIAL (seen, not triggered) | share/book_share_dialog |
