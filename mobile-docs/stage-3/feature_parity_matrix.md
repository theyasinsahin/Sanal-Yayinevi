# Stage 3 — Feature parity matrix

All 156 Stage 1 features and the 15 Stage 2 discoveries, with their stable identifiers. **Implementation** and **verification** are tracked separately; code existing is never counted as verified.

## How to read it

| Verification | Meaning in this document |
|---|---|
| VERIFIED | The feature's main path was driven through the app against the real backend (isolated sandbox) and its backend effect checked: in the Stage 3 verification pass on both the iOS simulator and the Android emulator (V1–V8), or earlier through the iOS journey / live API tests; plus unit tests where logic is ported. Remaining gaps of a verified feature are listed under Limitations |
| PARTIALLY VERIFIED | Part of it ran (the screen rendered live data, or the API operations ran live, or the ported logic is unit-tested), but the full interaction was not driven on a device |
| NOT VERIFIED | Implemented; its GraphQL documents are validated against the server schema and the code passes analysis, but nothing was executed |
| BLOCKED | Cannot be exercised without configuration that is not available (Google OAuth clients) |

Evidence keys: **D nn** = screenshot `evidence/screenshots/nn_*.png` from `integration_test/app_journey_test.dart` (iPhone 17 simulator, iOS 27.0) · **L** = `test/integration/live_api_test.dart` (`evidence/live_api_test_output.txt`) · **T1** = `test/richtext_golden_test.dart` · **T2** = `test/core_logic_test.dart` · **T3** = `test/reader_writer_logic_test.dart` · **T4** = `test/widget_test.dart` · **G** = `evidence/graphql_validation.txt` (document valid against the server schema) · **V1–V8** = verification-pass integration suites `integration_test/v01_auth_nav_test.dart` … `v08_admin_test.dart`, run with `flutter drive` on the iPhone 17 simulator (iOS 27.0) and the Pixel 8 emulator (Android 15, API 35) against the disposable sandbox; scenario results in `verification_log.md`, screenshots in `evidence/screenshots_v/`.

Web behaviour references: Stage 1 `stage-1/07a…07f` (by identifier) and Stage 2 `stage-2/coverage_matrix.md` (same identifiers). Paths in "Flutter location" are under `Client/mobile/lib/`.

## Totals

After the Stage 3 verification pass (before the pass in brackets).

| | Count |
|---|---|
| Tracked features | 171 |
| IMPLEMENTED | 167 |
| NOT STARTED | 2 |
| NOT APPLICABLE (browser-only) | 2 |
| — of the implemented: VERIFIED | 156 (30) |
| — PARTIALLY VERIFIED | 8 (56) |
| — NOT VERIFIED | 2 (79) |
| — FAILED | 0 (0) |
| — BLOCKED (verification) | 1 (2) |

No feature is marked IN PROGRESS or DEFERRED. "Implemented" for F-QUOTE-08 and F-MSG-07 means parity with the website, which deliberately offers neither control.


## Auth & session (AUTH)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-AUTH-01 | E-mail / password login | login | features/auth/auth_screens.dart, core/auth/auth_controller.dart | IMPLEMENTED | VERIFIED | L (login, wrong password); D 02→03 (real form, returnTo); T4 (validation); T2; V1 iOS+Android (form, refused, returnTo) | — |
| F-AUTH-02 | Registration with e-mail code (2 steps) | sendRegistrationCode, registerAndLogin | features/auth/auth_screens.dart | IMPLEMENTED | VERIFIED | T2 (code-400 handling); G; V1 iOS+Android: code mail from the sink, short/wrong code refused, success → profile, user row | Resend after the 60 s cooldown not waited for |
| F-AUTH-03 | Google sign-in / sign-up | googleAuth(token) | core/auth/google_sign_in.dart (signInWithGoogle, PluginGoogleIdTokenSource); features/auth/auth_screens.dart (GoogleButton); ios/Runner (URL scheme, scheme guard) | IMPLEMENTED | BLOCKED | G; V9 iOS+Android: button on login/register, unconfigured message, real sandbox googleAuth refuses a forged token (no session, no user), cancel sends nothing, real plugin reaches Google's sign-in UI on Android and is stopped by the URL-scheme guard on iOS; 20 unit/widget tests | No OAuth client ids exist yet (BLK-01): no real Google sign-in has succeeded. Always shown on both platforms; iOS store review also needs Sign in with Apple or an equivalent (BLK-02). Setup: google_sign_in_setup.md |
| F-AUTH-04 | Forgot password | forgotPassword | features/auth/auth_screens.dart | IMPLEMENTED | VERIFIED | G; V1 iOS+Android: reset mail delivered to the sink | Mail link opens the website until association files exist (BLK-05); the app's paste-the-link screen was used |
| F-AUTH-05 | Reset password from e-mailed link | resetPassword | features/auth/auth_screens.dart; router /reset-password/:token | IMPLEMENTED | VERIFIED | T2 (token extraction, password rules); G; V1 iOS+Android: pasted link and /reset-password/<token>; mismatch/invalid/reused link refused; old password refused, new accepted | https link → app needs association files (BLK-05) |
| F-AUTH-06 | Logout (all devices) | logout | core/auth/auth_controller.dart; shell drawer; profile | IMPLEMENTED | VERIFIED | L (token revoked server-side); D (sign-out + guard); V1 iOS+Android (drawer → server-side revocation checked) | — |
| F-AUTH-07 | Password strength indicator | — | features/auth/auth_screens.dart | IMPLEMENTED | VERIFIED | T2 (rules identical to server); V1 iOS+Android (meter Zayıf → Güçlü on device) | — |
| F-AUTH-08 | Session persistence, validation, expiry | me | core/auth/auth_controller.dart, core/auth/session.dart | IMPLEMENTED | VERIFIED | T2 (expired token discarded, role refresh, UNAUTHENTICATED → sign-out); L (24 h exp); V5 iOS (Keychain) + Android (Keystore): restart keeps the session, logout clears storage | Natural 24 h expiry not waited for (unit-tested) |
| F-AUTH-09 | Route guards | — | router.dart (guardRedirect) | IMPLEMENTED | VERIFIED | T2 (all roles); D (guest → login, member → / for /admin); V1 iOS+Android | — |
| F-AUTH-10 | Registration intent (deferred action) | — | core/app_services.dart (IntentStore), core/widgets/ui.dart (requireMember) | IMPLEMENTED | PARTIALLY VERIFIED | T2, T4 (prompt, copy, origin kept); T3 (guest progress migration); V2/V3 iOS+Android: like, save, follow, bookmark, read prompts with the right copy; nothing stored | Automatic replay of the action after a real sign-up not driven on a device |

## App shell (NAV)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-NAV-01 | Top navigation bar | getUnreadMessageCount, getUnreadNotificationCount | features/shell/shell.dart | IMPLEMENTED | VERIFIED | D 01, 04 (badges); V1–V8 (badges, app bar on every run) | Adapted: bottom navigation + app bar + drawer |
| F-NAV-02 | Mobile slide-out menu | — | features/shell/shell.dart (AppDrawer) | IMPLEMENTED | VERIFIED | D (drawer present); code; V1 iOS+Android: guest and member drawers opened and used | Drawer not opened in the device run |
| F-NAV-03 | Footer | getCommunityConfig, subscribeNewsletter | shell drawer (links); community_screens.dart (NewsletterForm, CommunityContactInfo) | IMPLEMENTED | VERIFIED | G; V1 iOS+Android: drawer links, newsletter on Hakkımızda, contact info | No footer on mobile (by design) |
| F-NAV-04 | Readable URLs and legacy redirects | resolvePublicRoute | router.dart (_Resolve, legacy redirects) | IMPLEMENTED | VERIFIED | G; code; V1 iOS+Android: /kitap/<slug>, /kitap/<slug>/oku, /yazar/<username>, /book-detail/<id>, unknown slug; Android OS deep links betik:///login and betik:///dashboard/<id> (manual) | https links need association files (BLK-05) |
| F-NAV-05 | Not Found page | — | features/community/community_screens.dart (NotFoundScreen) | IMPLEMENTED | VERIFIED | code; V1 iOS+Android | — |
| F-NAV-06 | Page loading / error boundary | — | core/widgets/ui.dart (Loader, ErrorView) | IMPLEMENTED | PARTIALLY VERIFIED | T2 (network error mapping); D (loading states); Loading and error views seen on device (e.g. the recommendations error before fix V-05) | Offline / server-down states not provoked on a device |
| F-NAV-07 | Toasts | — | core/widgets/ui.dart (showToast) | IMPLEMENTED | VERIFIED | code; T4; Toasts asserted in V1–V8 on both platforms | — |
| F-NAV-08 | Scroll restoration | — | — | NOT APPLICABLE | — | — | Native navigation stacks keep position; nothing to port |
| F-NAV-09 | PWA install prompt & service worker | — | — | NOT APPLICABLE | — | — | Browser-only |
| F-NAV-10 | Decorative mascots | — | — | NOT STARTED | — | — | Cosmetic only; not implemented (fox asset is bundled but unused) |
| F-NAV-11 | Reading font size preference | — | core/app_services.dart (ReadingPreferences); profile/settings.dart | IMPLEMENTED | VERIFIED | code; reader uses it (D 08); V5 iOS+Android: size saved under app_font_size, reader uses 20 px | Changing the size was not driven on device |

## Notifications (NOT)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-NOT-01 | Notification list with unread badge | getNotifications, getUnreadNotificationCount, markNotificationsRead | features/notifications/notifications_screen.dart; BadgeController | IMPLEMENTED | VERIFIED | D 04 (badge), 16 (list, mark read); L (guest refused); V2/V5 iOS+Android: badge rises, list, opening marks read (server) | No push (BLK-04) |
| F-NOT-02 | Notification targets | — | notifications_screen.dart (notificationTarget) | IMPLEMENTED | PARTIALLY VERIFIED | T2 (every type mapped); Tapped on device: comment mention (V2), follow accepted (V5), quote like (V5), session mention → entry (V6); all types unit-tested | NEW_CHAPTER, PRINT_UPDATE, BADGE_EARNED, POINTS targets not tapped |
| F-NOT-03 | Follow requests in the panel | getIncomingFollowRequests, respondToFollowRequest | notifications_screen.dart (FollowRequestsPanel) | IMPLEMENTED | VERIFIED | G; L (request/cancel side); V5 iOS+Android: reject, then accept; follower stored | Accept/reject not driven |

## Discovery (DISC)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-DISC-01 | Landing page | getBookFeed | features/discovery/landing_screen.dart | IMPLEMENTED | VERIFIED | D 01; L; V1/V2 iOS+Android | — |
| F-DISC-02 | Explore feed: search, filters, sort, paging | getBookFeed, getClassificationOptions | features/discovery/feed_screen.dart | IMPLEMENTED | VERIFIED | D 05, 06; L (sort/funding/search variables); T2 (filter coupling); V2 iOS+Android: search, empty state, clear, sort, funding coupling, format filter | Cursor paging needs more data |
| F-DISC-03 | "Senin için" recommendations | getRecommendations, getUserPreference | feed_screen.dart (_ForYouTab) | IMPLEMENTED | VERIFIED | G; V2 iOS+Android after fix V-05 (list loads) | — |
| F-DISC-04 | Genre onboarding / edit | getAllGenres, saveUserPreference | feed_screen.dart (GenreOnboarding) | IMPLEMENTED | VERIFIED | G; V2 iOS+Android: onboarding and edit stored in userpreferences | — |
| F-DISC-05 | Book card | — | features/book/book_card.dart | IMPLEMENTED | VERIFIED | D 01, 05; T4 (derived values, small screen); V2 iOS+Android (+ widget test for a missing page count) | — |
| F-DISC-06 | Authors directory | getAuthors | features/community/community_screens.dart (AuthorsScreen) | IMPLEMENTED | VERIFIED | D 18 | — |
| F-DISC-07 | "Tercihlerim" strip | getUserPreference | feed_screen.dart | IMPLEMENTED | VERIFIED | G; V2 iOS+Android: 'Tercihlerim' shown, 'Düzenle' edits | Stage 2 discovery |

## Book detail (BOOK)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-BOOK-01 | Book detail (digital) | getBookById, getUserById | features/book/book_detail_screen.dart | IMPLEMENTED | VERIFIED | D 07; L | — |
| F-BOOK-02 | Book card interactions | — | features/book/book_card.dart | IMPLEMENTED | VERIFIED | D (card → detail) | — |
| F-BOOK-03 | Like a book | likeBook | book_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V2 iOS+Android: like/unlike/like, persisted | Optimistic toggle with rollback; not driven |
| F-BOOK-04 | Save to library | toggleSaveBook | book_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V2 iOS+Android: savedBooks | — |
| F-BOOK-05 | Follow a book | isFollowingBook, toggleBookFollow | book_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V2 iOS+Android: isFollowingBook | — |
| F-BOOK-06 | Read / Support buttons | — | book_detail_screen.dart | IMPLEMENTED | PARTIALLY VERIFIED | D 07 → 08; KİTABI OKU on device (V2/V3) | DESTEK OL button itself not tapped (checkout reached through the funding panel) |
| F-BOOK-07 | Share book | getSocialShare | features/share/share_sheet.dart | IMPLEMENTED | VERIFIED | T2 (URL format); G; V2 iOS+Android: copy link / copy text with /share/book/… | System share sheet ('Diğer uygulamalar') not driven |
| F-BOOK-08 | Author publication controls | updateBookStatus, deleteBook | book_detail_screen.dart (_AuthorControls) | IMPLEMENTED | VERIFIED | L (status WRITING, delete); V2 iOS+Android: publish (cancel keeps draft), complete, back to draft, delete | Buttons/confirm dialogs not driven on device |
| F-BOOK-09 | Edit classification inline | updateBookClassification | features/book/classification_fields.dart | IMPLEMENTED | VERIFIED | T2 (limits); G; V4 iOS+Android: classification editor saved | — |
| F-BOOK-10 | Delete book from detail | deleteBook | book_detail_screen.dart | IMPLEMENTED | VERIFIED | L (mutation); V2 iOS+Android: delete with confirm; book then not found | Stage 2 discovery |

## Comments (COMM)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-COMM-01 | Comment list, one-level replies | getCommentsByBookId | features/book/comments.dart | IMPLEMENTED | VERIFIED | L; T2 (threading) | — |
| F-COMM-02 | Add comment | createComment | comments.dart | IMPLEMENTED | VERIFIED | L (mutation); V2 iOS+Android | UI not driven |
| F-COMM-03 | Reply to comment | replyToComment | comments.dart | IMPLEMENTED | VERIFIED | L (parentId); V2 iOS+Android: reply stored with parentId | — |
| F-COMM-04 | Like comment | toggleCommentLike | comments.dart | IMPLEMENTED | VERIFIED | G; V2 iOS+Android | — |
| F-COMM-05 | Delete own comment | deleteComment | comments.dart | IMPLEMENTED | VERIFIED | L; V2 iOS+Android: cancel keeps, confirm deletes | — |
| F-COMM-06 | @mention autocomplete | searchMentionUsers | core/widgets/mentions.dart | IMPLEMENTED | VERIFIED | T2 (token detection/insertion); G; V2 iOS+Android after fix V-03: live suggestion list, selection inserts @user | Suggestion list not driven |

## Reader (READ)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-READ-01 | Open reader and resume | getBookById, getReadingChapter, getBookmark, getReadingProgress | features/reader/reader_screen.dart, reader_progress.dart | IMPLEMENTED | VERIFIED | D 08; L; T3 (resume priority) | Resume is per chapter (server stores no scroll offset) |
| F-READ-02 | Chapter list | — | reader_screen.dart (_ChapterDrawer) | IMPLEMENTED | VERIFIED | D 09 | — |
| F-READ-03 | Chapter navigation and completion | saveReadingProgress | reader_screen.dart | IMPLEMENTED | VERIFIED | T2 (button labels); L (progress); V3 iOS+Android: complete & continue, previous, revisit label, last chapter; hidden chapter in the middle after fix V-08 | Buttons not tapped on device |
| F-READ-04 | Progress sync (offline tolerant) | saveReadingProgress | reader_progress.dart (ProgressWriter) | IMPLEMENTED | VERIFIED | T3; L; V3 iOS+Android: completedChapters on the server | Offline → online transition not simulated on a device |
| F-READ-05 | Verified reading time → points | startReadingSession, reportReadingTime | features/reader/reading_tracker.dart | IMPLEMENTED | VERIFIED | T3 (state machine); L (report accepted, too-fast refused); V3 iOS+Android: reading session created, heartbeat sequence advances | Background/foreground and idle stop not measured |
| F-READ-06 | Bookmark on a paragraph | getBookmark, setBookmark, removeBookmark | reader_screen.dart; core/richtext/paragraphs.dart | IMPLEMENTED | VERIFIED | L (index 2 stored, resume from bookmark); T1 (index rule); V3 iOS+Android: tapped; paragraphIndex 1 for the 2nd <p> after an h1; restored; moved; removed | Button not tapped on device |
| F-READ-07 | Paragraph comments | getParagraphCommentCounts, getParagraphComments, addParagraphComment, deleteParagraphComment | features/reader/reader_widgets.dart | IMPLEMENTED | VERIFIED | L (add + counts by paragraph index); V3 iOS+Android: panel, add, stored index, count, delete | Panel not opened on device |
| F-READ-08 | Quote by selecting text | checkQuoteExists, createQuote, repostQuote | reader_screen.dart (SelectionArea), reader_widgets.dart (quote sheet) | IMPLEMENTED | VERIFIED | L (duplicate check, create with location); V3 iOS+Android: real long-press + drag selection → Alıntıla → sheet → quote with chapter id/index; <10 chars refused; duplicate detected | Simulator/emulator touch, not a physical device |
| F-READ-09 | Copy protection | — | reader_screen.dart (copyProtectionNotice) | IMPLEMENTED | VERIFIED | T2 (notice text); V3 iOS+Android: menu has only Alıntıla/Kopyala; Kopyala copies the notice | Screenshots not prevented (same as the website) |
| F-READ-10 | Registration gate and hidden chapters | — | reader_screen.dart | IMPLEMENTED | VERIFIED | T3 (guest resolution); T2 (labels); V3 iOS+Android: guest gate (J-05 sheet), gated chapters marked, hidden chapter notice; author sees hidden text | Not driven as a guest on device |
| F-READ-11 | View counting | incrementBookViews | reader_screen.dart | IMPLEMENTED | VERIFIED | D (called on open); G; V3 iOS+Android: views counted | — |
| F-READ-12 | Share chapter | getSocialShare | reader_screen.dart | IMPLEMENTED | VERIFIED | G; V3 iOS+Android: /share/chapter/… | — |
| F-READ-13 | Chapter HTML rendering | — | features/reader/html_view.dart; core/richtext/rich_text.dart | IMPLEMENTED | VERIFIED | D 08; T1 (sanitiser = DOMPurify config, 21 fixtures) | Inline style colours are not shown (the web reader strips them too) |
| F-READ-14 | "Alıntı nasıl eklenir?" help card | — | reader_screen.dart (_HelpCard) | IMPLEMENTED | VERIFIED | D 08 | Copy adapted to touch |
| F-READ-15 | Manual read checkbox per chapter | saveReadingProgress | reader_screen.dart (_ChapterDrawer) | IMPLEMENTED | VERIFIED | D 09 (visible); V3 iOS+Android: unchecking updates the server | — |
| F-READ-16 | Scroll progress bar | — | reader_screen.dart | IMPLEMENTED | VERIFIED | D 08; V3 iOS+Android: 60-paragraph chapter, 0 → >0.9 | — |

## Authoring (WRITE)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-WRITE-01 | Create a book (draft) | createBook | features/writing/create_book_screen.dart | IMPLEMENTED | VERIFIED | L (mutation); D 03 (form); V4 iOS+Android after fix V-06: validation, cover upload (stand-in), classification, draft row | Real Cloudinary not configured (BLK-03) |
| F-WRITE-02 | Classification fields | getClassificationOptions, searchClassificationTags | features/book/classification_fields.dart | IMPLEMENTED | VERIFIED | T2; D 03; V4 iOS+Android | — |
| F-WRITE-03 | Image upload (covers, avatars, session covers) | Cloudinary unsigned upload | features/writing/image_upload.dart | IMPLEMENTED | PARTIALLY VERIFIED | T2 (type sniffing, crop arithmetic); V4/V5/V6 iOS+Android: pick (test seam) → validate → centre-crop → JPEG → multipart POST with preset to a local Cloudinary stand-in → URL saved by the server (cover, avatar, session cover) | Real Cloudinary account and the system photo picker not exercised (BLK-03) |
| F-WRITE-04 | Dashboard: chapter list and management | getBookById, createChapter, deleteChapter | features/writing/dashboard_screen.dart | IMPLEMENTED | VERIFIED | D 10; L (createChapter); V4 iOS+Android: add (title rule), hidden add, select, delete with confirm | New chapter opens at once (website leaves it unselected) |
| F-WRITE-05 | Rich-text editor with autosave (native) | updateChapter | features/writing/chapter_editor.dart, chapter_autosave.dart; core/richtext/quill_html.dart, page_count.dart | IMPLEMENTED | VERIFIED | T1 (Quill 1.3.7 goldens, page-count goldens); T3 (autosave); L (HTML stored unchanged, pageCount); D 10 (editor renders the chapter); V4 iOS+Android: toolbar + typing → Quill HTML; undo/redo; copy/paste via toolbar (fix V-07); website chapter round trip; read-only for incompatible markup; Android Gboard typing (manual run) | Rich paste from other apps, iOS soft-keyboard typing, editor image insertion via the picker, opening app-saved chapters in the website editor: not tested |
| F-WRITE-06 | Hide / show chapter | updateChapter(isHidden) | dashboard_screen.dart | IMPLEMENTED | VERIFIED | G; V4 iOS+Android: isHidden toggled on the server | — |
| F-WRITE-07 | Share chapter from dashboard | getSocialShare | dashboard_screen.dart | IMPLEMENTED | VERIFIED | G; V4 iOS+Android: /share/chapter/… | — |
| F-WRITE-08 | Publication panel in dashboard | updateBookStatus | dashboard_screen.dart (_publishBar) | IMPLEMENTED | VERIFIED | D 10; L; V4 iOS+Android: publish and complete from the bar | — |
| F-WRITE-09 | "Yeni bölümü gizli oluştur" | createChapter(isHidden) | dashboard_screen.dart | IMPLEMENTED | VERIFIED | G; V4 iOS+Android | — |
| F-WRITE-10 | "Okuyucu Modu" shortcut | — | dashboard_screen.dart | IMPLEMENTED | VERIFIED | code; V4 iOS+Android | — |

## Sessions (SESS)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-SESS-01 | Sessions list | getSessions | features/sessions/sessions_screen.dart | IMPLEMENTED | VERIFIED | D 12 | — |
| F-SESS-02 | Request permission to create | mySessionCreationAccess, requestSessionCreationAccess | sessions_screen.dart (SessionAccessPanel) | IMPLEMENTED | VERIFIED | D 12 (status shown); G; V6 iOS+Android: short reason refused, PENDING stored, rejection note shown | — |
| F-SESS-03 | Create session | createSession | sessions_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: title rule, tags, OPEN and PRIVATE created | Real Cloudinary not configured (BLK-03) |
| F-SESS-04 | Session detail and entries | getSession, getSessionEntries | features/sessions/session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android | — |
| F-SESS-05 | Private access-code gate | verifySessionAccessCode | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: code length rule, wrong code refused, right code → post | Creator skips the gate unless the server asks (decision D-12) |
| F-SESS-06 | Post an entry | addSessionEntry | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android | — |
| F-SESS-07 | Live updates | onNewSessionEntry | session_detail_screen.dart; core/network/subscription_client.dart | IMPLEMENTED | VERIFIED | T3 (protocol); T2 (de-duplication); L (same socket client verified with onNewMessage); V6 iOS+Android: entry posted elsewhere appears live | Session subscription itself not exercised live |
| F-SESS-08 | Like an entry | toggleSessionEntryLike | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: likedBy toggled | — |
| F-SESS-09 | Delete own entry | deleteSessionEntry | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android | — |
| F-SESS-10 | Close session | closeSession | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: cancel keeps, confirm closes; closed session takes no entries | — |
| F-SESS-11 | Edit session cover | updateSessionCover | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: cover via the upload stand-in, stored | Real Cloudinary not configured (BLK-03) |
| F-SESS-12 | Deep link to an entry | getSessionEntry | session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; T2 (target); V6 iOS+Android: mention notification → session with ?entry= | — |
| F-SESS-13 | Share session | getSocialShare | sessions_screen.dart, session_detail_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: /share/session/… | — |
| F-SESS-14 | "Durumu yenile" for pending access | mySessionCreationAccess | sessions_screen.dart | IMPLEMENTED | VERIFIED | G; V6 iOS+Android | — |

## Profile (PROF)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-PROF-01 | View profile | getUserById, getQuotesByUser, getUserScore, getUserBadges, getFollowedBooks | features/profile/profile_screen.dart | IMPLEMENTED | VERIFIED | D 04; V5 iOS+Android: own, other, private-as-other | Other users' and private profiles not driven |
| F-PROF-02 | Edit own profile | updateProfile | profile_screen.dart (_EditProfileForm) | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: name, bio, avatar; username rule (fix V-09) | Real Cloudinary not configured (BLK-03); app validates username like registration |
| F-PROF-03 | Followers / following lists | — | profile_screen.dart (_showUsers) | IMPLEMENTED | VERIFIED | code; V5 iOS+Android | — |
| F-PROF-04 | Message from profile | getOrCreateConversation | profile_screen.dart | IMPLEMENTED | VERIFIED | L (query); V5 iOS+Android | — |
| F-PROF-05 | Share profile | getSocialShare | profile_screen.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: /share/profile/… | — |
| F-PROF-06 | "Desteklerim" shortcut | — | profile_screen.dart | IMPLEMENTED | PARTIALLY VERIFIED | D 04, 17 | The profile's DESTEKLERİM button itself not tapped |
| F-PROF-07 | Grouped quotes | getQuotesByUser | features/quotes/quotes_screen.dart (ProfileQuoteGroups) | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |

## Follow (FOLLOW)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-FOLLOW-01 | Request / cancel / unfollow | requestFollowUser, cancelFollowRequest, unfollowUser | profile_screen.dart (_FollowButton) | IMPLEMENTED | VERIFIED | L (request + cancel); V5 iOS+Android: request, withdraw, request | Button not driven |
| F-FOLLOW-02 | Accept / reject requests | respondToFollowRequest | notifications_screen.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |
| F-FOLLOW-03 | Follow notifications | — | server side; shown in notifications | IMPLEMENTED | VERIFIED | T2 (targets); V5 iOS+Android: accepted notification → profile, 'Takibi bırak' | — |
| F-FOLLOW-04 | Remove a follower | removeFollower | profile_screen.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |

## Settings (SET)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-SET-01 | Change e-mail | changeEmail | features/profile/settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: info mail to the new address, signed out, sign-in with the new address | App signs out immediately after success (token is already revoked) |
| F-SET-02 | Change password | changePassword | settings.dart | IMPLEMENTED | VERIFIED | G; T2 (rules); V5 iOS+Android: mismatch, wrong current refused (stays signed in), success signs out, new password works | — |
| F-SET-03 | Privacy settings | updatePrivacySettings | settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: private profile + messages closed seen by another member; reverted | — |
| F-SET-04 | Notification settings | updateNotificationSettings | settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | Only the 7 flags the web exposes |
| F-SET-05 | Author settings | updateAuthorSettings, getAllGenres | settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: invalid goal refused; note, goal, genre stored | — |
| F-SET-06 | Appearance (font size) | — | settings.dart; ReadingPreferences | IMPLEMENTED | VERIFIED | code; V5 iOS+Android | — |
| F-SET-07 | Deactivate account | deactivateAccount | settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: profile hidden from others; sign-in reactivates | — |
| F-SET-08 | Delete account | deleteAccount | settings.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: phrase required; deleted; sign-in refused | Typed phrase "hesabımı sil" |

## Quotes (QUOTE)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-QUOTE-01 | Quotes feed | getQuotesFeed | features/quotes/quotes_screen.dart | IMPLEMENTED | VERIFIED | D 11 | — |
| F-QUOTE-02 | Search quotes | searchQuotes | quotes_screen.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |
| F-QUOTE-03 | Quote card | — | features/quotes/quote_card.dart | IMPLEMENTED | VERIFIED | D 11; V5 iOS+Android | — |
| F-QUOTE-04 | Like quote | toggleQuoteLike | quote_card.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |
| F-QUOTE-05 | Repost / undo | repostQuote, unrepostQuote | quote_card.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: repost stored, undone | Repost card in the feed not asserted (feed ordering) |
| F-QUOTE-06 | Quote comments | getQuoteComments, addQuoteComment, deleteQuoteComment | quote_card.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |
| F-QUOTE-07 | Quote detail | getQuoteById | quotes_screen.dart (QuoteDetailScreen) | IMPLEMENTED | VERIFIED | G; V5 iOS+Android | — |
| F-QUOTE-08 | Delete own quote (not in web UI) | deleteQuote | — | IMPLEMENTED | VERIFIED | code review | Parity = not offered, as on the web |
| F-QUOTE-09 | Quote from a printed book | createQuote(pageNumber), getQuotesByBook | features/printed/printed_detail.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: page range checked, pageNumber stored | — |
| F-QUOTE-10 | Repost comment | repostQuote | quote_card.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: repost comment stored | Stage 2 discovery |

## Messaging (MSG)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-MSG-01 | Conversation list | getConversations | features/messaging/messages_screen.dart | IMPLEMENTED | VERIFIED | D 15; L | List refreshes with the unread poll (web list is stale) |
| F-MSG-02 | Start a conversation | getMessageRecipients, getOrCreateConversation | messages_screen.dart | IMPLEMENTED | VERIFIED | L (getOrCreateConversation); D 15; V5 iOS+Android (from profile) | — |
| F-MSG-03 | Chat window | getMessages, markMessagesAsRead | messages_screen.dart (ChatScreen) | IMPLEMENTED | VERIFIED | L (newest-first order, mark read); V5 iOS+Android | Chat screen not opened on device |
| F-MSG-04 | Send text message | sendMessage | ChatScreen | IMPLEMENTED | VERIFIED | L; V5 iOS+Android | — |
| F-MSG-05 | Real-time incoming messages | onNewMessage | ChatScreen; subscription_client.dart | IMPLEMENTED | VERIFIED | L (real WebSocket delivery < 8 s); T3 | — |
| F-MSG-06 | Delete own message | deleteMessage | ChatScreen | IMPLEMENTED | VERIFIED | L; V5 iOS+Android | — |
| F-MSG-07 | Edit message (not in web UI) | editMessage | — | IMPLEMENTED | VERIFIED | code review | Parity = not offered |
| F-MSG-08 | Share book/quote into a chat | sendMessage(BOOK\|QUOTE) | features/messaging/share_to_chat.dart | IMPLEMENTED | VERIFIED | G; V5 iOS+Android: book shared into a conversation | Quote sharing into chat not driven |
| F-MSG-09 | Attachment bubbles | — | messages_screen.dart (_Bubble) | IMPLEMENTED | VERIFIED | T2 (preview text); V5 iOS+Android: book bubble → book | Quote bubble not driven |

## Sharing (SHARE)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-SHARE-01 | Share dialog | getSocialShare | features/share/share_sheet.dart | IMPLEMENTED | VERIFIED | T2 (shared URL = API /share/... with webOrigin); V2–V6 iOS+Android: book, chapter, profile, session links copied | System share sheet not driven |
| F-SHARE-02 | Story/status image | — | share_sheet.dart (_shareWithImage) | IMPLEMENTED | NOT VERIFIED | code | Image is handed to the system share sheet instead of a browser download |

## Score (SCORE)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-SCORE-01 | Leaderboard | getLeaderboard, getUserRank | features/score/leaderboard_screen.dart | IMPLEMENTED | VERIFIED | D 13; L (dynamic document) | — |
| F-SCORE-02 | Earning points (server rules) | — | server side | IMPLEMENTED | PARTIALLY VERIFIED | L (reading time accepted); V3: reading-time reports accepted on device | Point awards not asserted per rule |
| F-SCORE-03 | Live score refresh | myScoreUpdated, leaderboardUpdated | core/app_services.dart (BadgeController); leaderboard_screen.dart | IMPLEMENTED | PARTIALLY VERIFIED | T3 (socket protocol) | Event-driven refresh not asserted on device |
| F-SCORE-04 | Badges on profile | getUserBadges | profile_screen.dart | IMPLEMENTED | VERIFIED | D 04 (badge emoji) | — |

## Printed catalogue (PRINTED)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-PRINTED-01 | Printed catalogue | getPrintedBooks | features/printed/printed_books_screen.dart | IMPLEMENTED | VERIFIED | D 14 | — |
| F-PRINTED-02 | Submit a printed book | lookupPrintedBook, submitPrintedBook | printed_books_screen.dart (PrintedBookSubmissionForm) | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: client rules, invalid ISBN message, https rule, PENDING row | ISBN lookup against Open Library not called (external) |
| F-PRINTED-03 | My submissions | getMyPrintedSubmissions | printed_books_screen.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android | — |
| F-PRINTED-04 | Printed book detail | getBookById | features/printed/printed_detail.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android | — |
| F-PRINTED-05 | Rate & review | myPrintedBookReading, savePrintedBookReading, removePrintedBookReading | printed_detail.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: rate, review, remove, add again | — |
| F-PRINTED-06 | Printed shelf on profiles | getPrintedReadings | printed_detail.dart (PrintedReadingLibrary) | IMPLEMENTED | VERIFIED | G; V7 iOS+Android | — |
| F-PRINTED-07 | Author claim | requestBookClaim | printed_detail.dart (_ClaimForm) | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: rule, submit, admin approves, chapter tools appear | — |

## Print funding (FUND)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-FUND-01 | Funding panel / interest | printOverview, printPaymentMode, setPrintInterest | features/funding/funding_shared.dart (BookFundingPanel) | IMPLEMENTED | VERIFIED | L (overview shape, minor units); V7 iOS+Android: campaign card and support link on the book page; free interest toggled and stored | — |
| F-FUND-02 | Campaign card | — | funding_shared.dart (CampaignCard) | IMPLEMENTED | VERIFIED | T2 (money, labels); V7 iOS+Android: campaign card with target, collected amount, status | — |
| F-FUND-03 | Support / pre-order checkout | startPrintCheckout, myFundingPayment | features/funding/checkout_screen.dart | IMPLEMENTED | VERIFIED | T2 (idempotency key, total, TL→kuruş); G; V7 iOS+Android: 1 copy + 100 TL, address, consents → reservation stored in kuruş with idempotency key (sandbox mock provider) | Sandbox (PRINT_PAYMENTS_MODE=SANDBOX) only; the iyzico sandbox and live payments were not used |
| F-FUND-04 | Payment card & completing | simulatePrintPayment, cancelPrintPayment | funding_shared.dart (PaymentCard) | IMPLEMENTED | VERIFIED | T2 (iyzico host allow-list); G; V7 iOS+Android: simulated success, simulated failure and cancel from the payment card; states stored | iyzico hosted payment page not exercised (no sandbox keys; never live) |
| F-FUND-05 | Funding history | myFundingPayments | checkout_screen.dart (FundingHistoryScreen) | IMPLEMENTED | VERIFIED | D 17; L; V7 iOS+Android: history lists captured, failed, cancelled and refunded payments | — |
| F-FUND-06 | Print application workspace | myPrintApplicationForBook, printTariffs, save/submit/cancelPrintApplication, POST /api/print/assets | features/funding/print_application_screen.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: application form, cover PDF picked (test hook for the picker) and uploaded to POST /api/print/assets, saved, submitted | System document picker UI itself not driven (test override) |
| F-FUND-07 | Legacy payment result pages | — | checkout_screen.dart (PaymentFailureScreen); router | IMPLEMENTED | NOT VERIFIED | code | — |
| F-FUND-08 | Legacy backers avatars | getBookBackers | — | NOT STARTED | — | — | Admin-only, invisible to users on the web; not implemented |
| F-FUND-09 | Idempotent retry controls | startPrintCheckout | checkout_screen.dart | IMPLEMENTED | VERIFIED | T2; code; V7 iOS+Android: idempotency key stored with the reservation; new basket after a failure creates a new payment | — |
| F-FUND-10 | Pending payment actions in history | simulatePrintPayment, cancelPrintPayment | checkout_screen.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: pending payment cancelled from history | — |
| F-FUND-11 | Frozen print version with hash | printApplication* | print_application_screen.dart (ApplicationDetails) | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: saved application version is frozen with its hash and shown | — |

## Community (COM)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-COM-01 | About page | — | community_screens.dart (AboutScreen) | IMPLEMENTED | VERIFIED | code; V1 iOS+Android | Web copy |
| F-COM-02 | Contact form | sendContactMessage, getCommunityConfig | community_screens.dart (ContactScreen) | IMPLEMENTED | VERIFIED | G; V1 iOS+Android: mail in the sink | — |
| F-COM-03 | Legal pages | — | community_screens.dart (LegalScreen), legal_documents.dart (generated from the web texts) | IMPLEMENTED | VERIFIED | code; V1 iOS+Android | Texts are drafts on the website too |
| F-COM-04 | Newsletter subscription | subscribeNewsletter | community_screens.dart (NewsletterForm) | IMPLEMENTED | VERIFIED | G; V1 iOS+Android: confirmation mail | — |
| F-COM-05 | Authors directory | getAuthors | see F-DISC-06 | IMPLEMENTED | VERIFIED | D 18 | — |
| F-COM-06 | Social links | getCommunityConfig | community_screens.dart (CommunityContactInfo) | IMPLEMENTED | VERIFIED | G; V1 iOS+Android | Sandbox has no published e-mail/phone, so the 'not published' texts were seen |
| F-COM-07 | Newsletter confirmation page | manageNewsletter | community_screens.dart (NewsletterScreen) | IMPLEMENTED | VERIFIED | G; V1 iOS+Android: mailed link → confirm → subscription active | Reached by deep link |

## Publisher (PUB)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-PUB-01 | Publisher catalogue | publisherCatalog | features/admin/admin_screens.dart (PublisherPortalScreen) | IMPLEMENTED | VERIFIED | L (role allowed, member refused); T2 (guard); V7 iOS+Android: publisher catalogue and campaign filter; member redirected | Screen not opened on device |

## Admin (ADM)

| ID | Feature | API dependency | Flutter location | Implementation | Verification | Evidence | Limitations |
|---|---|---|---|---|---|---|---|
| F-ADM-01 | Admin overview | getAdminOverview | admin_screens.dart (AdminOverviewScreen) | IMPLEMENTED | VERIFIED | L (admin ok, member FORBIDDEN); V8 iOS+Android | Screens not opened on device (journey used the author account) |
| F-ADM-02 | Data browser | getAdminResources, getAdminRecords | admin_screens.dart (AdminDataScreen) | IMPLEMENTED | VERIFIED | L (records query); T2; V8 iOS+Android: list, status filter, search field | — |
| F-ADM-03 | Record editor (reason, optimistic lock) | getAdminRecord, saveAdminRecord | admin_screens.dart (AdminRecordEditorScreen) | IMPLEMENTED | VERIFIED | G; V8 iOS+Android: reason rule, hide/restore a comment (gone from the book page), stale revision → conflict + reload | No admin write was executed in Stage 3 |
| F-ADM-04 | Schema viewer | getAdminResources | admin_screens.dart (_SchemaView) | IMPLEMENTED | VERIFIED | G; V8 iOS+Android | — |
| F-ADM-05 | Printed-book review queue | getPrintedBookReviews, getBookClaimReviews, reviewPrintedBook, reviewBookClaim | admin_screens.dart (AdminPrintedBooksScreen) | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: printed approval and claim approval | Reject paths not driven |
| F-ADM-06 | Session-access review | sessionAccessRequests, reviewSessionCreationAccess | admin_screens.dart (AdminSessionAccessScreen) | IMPLEMENTED | VERIFIED | G; V6 iOS+Android: approve and reject with a note | — |
| F-ADM-07 | Print application review | adminPrintApplications, reviewPrintApplication | features/admin/admin_print_funding.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: admin approves with quote, confirmed pages, two PDFs and amounts; DB state checked | Reject / revision-request paths not driven |
| F-ADM-08 | Open / close campaigns | openFundingCampaign, closeFundingCampaign, printCampaignAudit | admin_print_funding.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: open campaign with confirmation; audit trail shows CAMPAIGN_SETTLED and PRODUCTION_UPDATED | Manual close path not driven (campaign settled by maintenance) |
| F-ADM-09 | Production tracking | updatePrintProduction | admin_print_funding.dart | IMPLEMENTED | VERIFIED | T2 (state choices); G; V7 iOS+Android: production stepped PRINTER_APPROVED → STARTED → PRINTING → PRINTED after the campaign settled | — |
| F-ADM-10 | Payments, refunds, pre-orders | adminFundingPayments/Orders/Refunds, retryPrintRefund, updatePrintOrder, requestPrintRefund | admin_print_funding.dart | IMPLEMENTED | VERIFIED | T2 (order state choices); G; V7 iOS+Android: full refund of a captured payment while ACTIVE (supporter sees İade edildi); pre-order CONFIRMED → PACKAGING | retryPrintRefund not driven (sandbox refunds never fail) |
| F-ADM-11 | Tariffs | printTariffs, createPrintTariff | admin_print_funding.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: new sample tariff version created | — |
| F-ADM-12 | Manual maintenance run | runPrintMaintenance | admin_print_funding.dart | IMPLEMENTED | VERIFIED | G; V7 iOS+Android: maintenance run settles refunds and the campaign (SUCCEEDED) | — |
| F-ADM-13 | Admin powers in regular screens | — | book_detail_screen.dart, session_detail_screen.dart, dashboard_screen.dart | IMPLEMENTED | VERIFIED | code; V8 iOS+Android: delete + classification on another author's book (no status buttons, as on the website); author dashboard opens | — |
| F-ADM-14 | Audit trail browser | getAdminRecords(AdminAudit) | admin_screens.dart | IMPLEMENTED | VERIFIED | G; V8 iOS+Android: reasons listed | Stage 2 discovery |
