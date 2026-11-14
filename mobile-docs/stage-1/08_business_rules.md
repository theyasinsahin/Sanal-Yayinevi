# 08 — Business Rules

Stage 1 static analysis. Each rule is tagged **[BE]** (enforced by the backend — the Flutter app gets it for free but must handle the resulting error), **[FE]** (implemented only in React — Flutter must re-implement it), or **[BE+FE]** (duplicated). Server paths are relative to `Server/src/`, client paths to `Client/src/`.

## 1. Accounts and identity

| # | Rule | Tag | Evidence |
|---|---|---|---|
| R-ACC-01 | Registration requires a 6-digit e-mailed code; valid 10 minutes; max 5 verification attempts; requesting a new code resets attempts | BE | `services/userService.js:383-445`, `models/verification.js` |
| R-ACC-02 | Username 3–50 chars (`\p{L}\p{N}_` first, then also `.`/`-`); e-mail ≤254 and lower-cased; full name 2–120; password ≥8 with upper, lower, digit, special, ≤72 bytes | BE+FE (password only on FE) | `userService.js:35-41`, `utils/passwordValidation.js` |
| R-ACC-03 | E-mail and username are unique (case-insensitive e-mail match) | BE | `userService.js:387` |
| R-ACC-04 | JWT valid 24 h, no refresh; `authVersion` bump revokes all tokens (logout, password/e-mail change, reset, deactivate) | BE | `05_authentication_security.md` |
| R-ACC-05 | Login reactivates a deactivated account; deleted or `loginBlocked` accounts cannot log in; errors are generic | BE | `userService.js:448-464` |
| R-ACC-06 | Reset link valid 1 hour, single use; response never reveals whether the account exists | BE | `userService.js:83-115, 265-279` |
| R-ACC-07 | Changing e-mail requires the current password, marks the account unverified, notifies new (and bcc old) address | BE | `userService.js:47-81` |
| R-ACC-08 | Google: existing password accounts are linked only for `@gmail.com` addresses or Workspace (`hd`) tokens; new accounts get `username = localpart + random(0–999)` | BE | `userService.js:288-348` |
| R-ACC-09 | Deactivation hides the user and all their content everywhere; deletion additionally soft-deletes their content and removes follow edges | BE | `utils/activeUsers.js`, `userService.js:188-263` |
| R-ACC-10 | Profile edit (`updateProfile`) has no server-side format validation | BE (gap) | `graphql/resolvers/user.js:127-134` |
| R-ACC-11 | Client session lifecycle (validate with `me`, expiry timer, focus re-validation) | FE | `context/AuthContext/index.jsx` |

## 2. Privacy and visibility

| # | Rule | Tag | Evidence |
|---|---|---|---|
| R-PRIV-01 | Profile visible to: self, admin, anyone if public, followers if private | BE | `utils/profileAccess.js` |
| R-PRIV-02 | Library (saved books, printed readings) and follow lists additionally require their own privacy flag | BE | same |
| R-PRIV-03 | `allowMessages`: everyone / followers only / none; checked when creating a conversation **and on every message** | BE | `services/messageService.js:28-31, 106-108` |
| R-PRIV-04 | E-mail and settings objects are returned only to self/admin | BE | `resolvers/user.js:194, 228-241` |
| R-PRIV-05 | Mention suggestions and mention notifications only target public profiles or the actor's followers; max 30 mentions per text | BE | `services/mentionService.js` |
| R-PRIV-06 | Private quotes are visible only to their owner; never shareable, never attachable to messages | BE | `utils/quoteAccess.js`, `services/socialShareService.js` |
| R-PRIV-07 | UI derives from server flags (`canViewProfile`, `canViewLibrary`, `canViewFollowList`, `canMessage`) | FE | `pages/UserProfilePage` |

## 3. Follow

| # | Rule | Tag |
|---|---|---|
| R-FOL-01 | Every follow is a request needing approval (no instant follow, even for public profiles) | BE `services/followService.js` |
| R-FOL-02 | One pending request per pair (unique partial index); re-requesting returns the pending one | BE |
| R-FOL-03 | Accepting adds both edges atomically and notifies requester (`FOLLOW_REQUEST_ACCEPTED`) and recipient (`NEW_FOLLOWER`, if enabled); rejecting/cancelling marks the request and its notification resolved | BE |
| R-FOL-04 | Unfollow and remove-follower delete the edge and cancel any pending request | BE |
| R-FOL-05 | Cannot follow oneself | BE |

## 4. Books and publication lifecycle

State is two-dimensional (`digitalStatus` DRAFT/PUBLISHED × `writingStatus` WRITING/COMPLETED) with a legacy combined `status` kept in sync (`DRAFT`, `WRITING`, `COMPLETED`).

```text
            updateBookStatus('WRITING' | 'PUBLISHED')            updateBookStatus('COMPLETED')
 DRAFT ───────────────────────────────────────────► PUBLISHED/WRITING ─────────────► PUBLISHED/COMPLETED
   ▲                                                    │                                   │
   └──────────── updateBookStatus('DRAFT') ◄────────────┴───────────────────────────────────┘
                 (blocked while a campaign is active / refunding / in production)
```

| # | Rule | Tag | Evidence |
|---|---|---|---|
| R-BOOK-01 | New books are DRAFT; only author/admin can see drafts | BE | `models/book.js`, `utils/bookAccess.js` |
| R-BOOK-02 | Publishing or completing requires at least one chapter with non-whitespace text | BE+FE | `services/print/applicationService.js:22-27`; client `hasContent` |
| R-BOOK-03 | Status changes are author/admin only, transactional, audited; `fundingTarget`/`printConfig` arguments are rejected | BE | `applicationService.js:11-42` |
| R-BOOK-04 | `PUBLISHED` status call awards +50 points once per book | BE | `resolvers/book.js:91-96`, `services/scoreAwards.js:46` |
| R-BOOK-05 | Note: the web UI publishes with `status:'WRITING'`, so the +50 award path (`'PUBLISHED'`) is **not triggered by the web publish button** | FE fact (verify) | `pages/BookDetail` `handlePublish`, `pages/BookDashboard` `togglePublish` |
| R-BOOK-06 | Deleting a book is a soft delete cascading to chapters, comments, quotes, user lists; blocked during active campaign/production | BE | `services/bookService.js:126-160` |
| R-BOOK-07 | Classification: 1 format, 1–3 genres, ≤8 tags (2–50 chars), ≤32 features, ≤32 warnings, optional audience; ≤50 new tags per user per 24 h | BE+FE | `services/classificationService.js:31-66` |
| R-BOOK-08 | Feed shows only digital, published, non-deleted books of active authors | BE | `services/bookCatalogService.js:26-28` |
| R-BOOK-09 | Like toggles `likedBy` + `stats.likes`; notifies author unless disabled or self | BE | `bookService.js:90-103` |
| R-BOOK-10 | View count increments on every call (no dedup) | BE | `bookService.js:105-111` |
| R-BOOK-11 | Card “Popüler” badge when views > 1000; read time = ceil(pages/3) min; description cut at 120 chars | FE | `components/Books/BookCard` |
| R-BOOK-12 | Readable URL slugs are generated lazily on first request and are **permanent** (`<title>-<author>`; suffix `-2`, `-3`… on collision) | BE | `services/publicUrlService.js:18-47` |

## 5. Chapters and reading

| # | Rule | Tag | Evidence |
|---|---|---|---|
| R-CH-01 | Chapter order = creation time ascending; no reorder | BE | `services/chapterService.js:18-21` |
| R-CH-02 | Content is sanitised HTML (allow-list in 07b F-READ-13), ≤500,000 chars; `wordCount` computed server-side | BE | `security/richText.js`, `models/chapter.js` |
| R-CH-03 | `pageCount` is supplied by the client (1200 chars/page); book `pageCount` = sum of chapter page counts (digital books) | FE→BE | `utils/htmlPageSplitter`, `chapterService.js:32-36` |
| R-CH-04 | Creating a chapter: +15 points, notifies book followers (`NEW_CHAPTER`), counts weekly writing words | BE | `chapterService.js:39-53`, `resolvers/chapter.js:59-61` |
| R-CH-05 | Hidden chapters are readable only by author/admin; their quotes, quote comments and shares are blanked | BE | `utils/chapterAccess.js`, `resolvers/quote.js` |
| R-CH-06 | Registration gate (env flag): guests may read only the first non-hidden chapter; others return `REGISTRATION_REQUIRED` with empty content | BE | `utils/chapterAccess.js:7-16` |
| R-CH-07 | One bookmark per user per book; chapter must be readable; `paragraphIndex ≥ 0` | BE | `services/bookmarkService.js` |
| R-CH-08 | Reading progress: `isCompleted` when every chapter is in the completed set; current chapter must belong to the book | BE | `services/readingProgressService.js` |
| R-CH-09 | Reading points: session per user (new session replaces old), reports 1–60 s, strictly sequential, cannot exceed real elapsed time (60 s budget cap), session expires 120 s after last heartbeat; 1 point per accumulated 60 s | BE | `services/readingService.js` |
| R-CH-10 | Client accumulates only visible + active time, warns at 90 s idle, stops at 120 s, flushes every 15 s | FE | `utils/readingTracker.js`, `hooks/useReadingTracker.js` |
| R-CH-11 | Paragraph index = ordinal of top-level `<p>` in sanitised HTML | FE | `components/ParagraphComment/ParagraphRenderer` |
| R-CH-12 | Weekly writing goal counts **net added** words per save; week starts Monday 00:00 Turkey time (UTC+3) | BE | `services/writingService.js` |

## 6. Comments, quotes, mentions

| # | Rule | Tag |
|---|---|---|
| R-SOC-01 | Comments only on visible books; +5 points; replies flatten to one level and are auto-prefixed with `@username` | BE `services/commentService.js` |
| R-SOC-02 | Only the owner can delete a comment; deleting a root soft-deletes its replies | BE |
| R-SOC-03 | Quote duplicate detection uses normalised text (lower-case, punctuation stripped, whitespace collapsed) per book and visibility; duplicate → error `QUOTE_EXISTS:<id>` | BE `services/quoteService.js` |
| R-SOC-04 | Client checks duplicates first and offers repost instead | FE `components/Quote/QuotePopup` |
| R-SOC-05 | Printed-book quotes: 10–1000 chars, note ≤1000, page 1…pageCount; digital quotes need a chapter of the book | BE |
| R-SOC-06 | Repost once per user, only public originals; +3 points; quote +10 points | BE |
| R-SOC-07 | Quote feed “popular” = like count desc then newest | BE |
| R-SOC-08 | Mentions: `@username` tokens (same regex on both sides); notification types `COMMENT_MENTION`, `PARAGRAPH_MENTION`, `QUOTE_MENTION`, `SESSION_MENTION`; a mentioned book author does not also get `COMMENT_RECEIVED` | BE+FE |
| R-SOC-09 | Paragraph-comment delete is a hard delete, owner only | BE |

## 7. Sessions

| # | Rule | Tag |
|---|---|---|
| R-SES-01 | Creating requires `sessionCreationAccess.status = APPROVED` (admin-reviewed request, reason 10–1000) | BE `services/sessionService.js:73-77`, `sessionAccessService.js` |
| R-SES-02 | Types: OPEN (anyone), FOLLOWERS_ONLY (creator + followers), PRIVATE (bcrypt-hashed access code ≥4 chars, ≤72) | BE |
| R-SES-03 | Access-code attempts: 10 per 15 min per IP and per user, per session | BE `sessionService.js:18-26` |
| R-SES-04 | Entries ≤5000 chars; only in active sessions; +5 points; first entry by a user increments `participantCount` | BE |
| R-SES-05 | New entry notifies creator and previous participants (`SESSION_REPLY`) except those already mentioned; publishes subscription event | BE |
| R-SES-06 | Only the creator can close; closing is permanent | BE |
| R-SES-07 | Cover must be a Cloudinary HTTPS image-upload URL or empty (default cover path served by the web host) | BE `utils/sessionCover.js` |
| R-SES-08 | Only OPEN + active sessions can be shared | BE+FE |
| R-SES-09 | Session list search is client-side over loaded pages | FE |

## 8. Messaging

| # | Rule | Tag |
|---|---|---|
| R-MSG-01 | 1-to-1 only; one conversation per pair; cannot message oneself | BE `services/messageService.js` |
| R-MSG-02 | Recipient suggestions = people the sender follows who accept the sender's messages | BE |
| R-MSG-03 | Only participants can read/send; unread counters per participant; `markMessagesAsRead` zeroes own counter | BE |
| R-MSG-04 | QUOTE messages require a public quote; attached books are re-checked for visibility on read | BE |
| R-MSG-05 | Only the sender can delete (soft) or edit (TEXT only) | BE |
| R-MSG-06 | No content length rule beyond the global 20,000-char string limit; no server-side empty-text check | BE (gap) |

## 9. Scores and badges

Points: quote 10 · comment 5 · repost 3 · publish 50 · chapter 15 · session entry 5 · reading 1/min. Awards are idempotent per `(user, action, sourceId)`. Leaderboard = top 10 by period (total from `UserScore`, daily/weekly/monthly summed from `PointEvent`, Europe/Istanbul boundaries, Monday week). Badges unlock when a `UserScore.stats` counter reaches a threshold (`Badge.condition`). **[BE]** `services/scoreAwards.js`, `scoreService.js`, `utils/scorePeriod.js`.

## 10. Printed catalogue

| # | Rule | Tag |
|---|---|---|
| R-PRT-01 | Submissions are PENDING until an admin approves; visible only to submitter/admin until then | BE `services/printedBookService.js` |
| R-PRT-02 | ISBN normalised to ISBN-13 with checksum validation; unique | BE `utils/printedBooks.js` |
| R-PRT-03 | Submitting a book does not grant authorship; a separate evidence-based claim does (one pending claim per user per book) | BE |
| R-PRT-04 | Content can be added to a printed book only by its approved author (or admin) | BE `utils/printedBooks.js:5-13` |
| R-PRT-05 | Rating 1–5 integer, review ≤3000, approved printed books only, one per user per book | BE `services/printedReadingService.js` |

## 11. Print funding (sandbox)

| # | Rule | Tag |
|---|---|---|
| R-FUND-01 | Application requires the book to be PUBLISHED + COMPLETED; saving snapshots all chapters into an immutable version (≤8 MB) with content hash; estimated pages = words / 250 (13.5×21) or / 350 (16×24) | BE `services/print/applicationService.js` |
| R-FUND-02 | Application states PREPARING → SUBMITTED → APPROVED / REJECTED / REVISION_REQUESTED; CANCELLED by author while no campaign exists; optimistic `revision` on every write | BE |
| R-FUND-03 | Admin cannot review own application; approval needs verified quote + layout and quote PDFs and minimum target/unit-price checks | BE |
| R-FUND-04 | One active campaign per book and per author; campaign duration from tariff policy (default 30 days) | BE `campaignService.js`, model indexes |
| R-FUND-05 | Checkout: quantity ≤ policy max (default 10), donation within policy min/max (default 50–100,000 TL), total 0.01–1,000,000 TL; the whole basket must fit the remaining target and stock; capacity is reserved (default 15 min) | BE `paymentService.js:21-60` |
| R-FUND-06 | Idempotency: same key + same content returns the same payment; same key + different content → `CONFLICT` | BE |
| R-FUND-07 | Shipping address required with consent for physical copies; country fixed `TR`; stored encrypted | BE |
| R-FUND-08 | Campaign settles to SUCCEEDED at target, otherwise FAILED/CANCELLED → automatic refunds with exponential retry | BE `campaignService.js`, `worker.js` |
| R-FUND-09 | Production and order state machines (07f F-ADM-09/10) | BE |
| R-FUND-10 | Money always integer kuruş; client converts TL input with ≤2 decimals | BE+FE |
| R-FUND-11 | PDF assets: `%PDF-` header, `%%EOF` trailer, ≤10 MB, owner/admin/authorised download only | BE `assetService.js` |

## 12. End-to-end traces

**T1 — Login.** `pages/Auth/Login` `handleSubmit` → `LOGIN` mutation (`graphql/mutations/user.js`) → HTTP POST → `secureRootFields` (rate limit `login`) → `resolvers/user.js` `login` → `UserService.loginUser` (normalise e-mail, bcrypt compare, reactivate, sign JWT) → `User` collection → `AuthPayload` → `AuthContext.login` (persist) → effect navigates to `finishRegistrationIntent(...)`. Validation: FE required fields; BE everything else. Errors: plain `Error('Giriş bilgileri geçersiz.')` → UI shows a generic message regardless of text.

**T2 — Explore feed page.** `FeedFilters`/`FeedSearch` → `FiltersContext` → `useBookFeed` (debounce, variables) → `getBookFeed` → `bookCatalogService.getBookFeed` (visibility clauses, classification filter, search regex, cursor) → `Book.find` or aggregate with campaign lookup → `{books,endCursor,hasNextPage}`; per book the field resolvers load author, classification terms, comment counts, `fundingSummary` via DataLoaders → `BookGrid` → `BookCard`. Missing link: none.

**T3 — Read a chapter and earn points.** Route resolver → `BookReader` → `getBookById` (chapter list without content) + `getBookmark` + `getReadingProgress` → `resolveReaderProgress` picks the chapter → `getReadingChapter` → `Chapter.content` resolver checks `chapterStatus` and sanitises → `ParagraphRenderer`. In parallel `useReadingTracker` → `startReadingSession` → `ReadingSession` upsert; every 15 s `reportReadingTime` → transaction (sequence, time budget) → `UserScore.readingRemainderSeconds` → `awardPoints` per full minute → `PointEvent` + `Notification` → `publishScoreUpdate` → subscription `myScoreUpdated` → client refetches score queries. Progress: state change → localStorage → `saveReadingProgress`.

**T4 — Write and autosave a chapter.** Quill `onChange` → `manager.edit` → timer (1.5 s / 10 s) → `persistChapter` → `parseContentToPages` → `updateChapter(chapterId, content, pageCount)` → resolver ownership check (`assertContentAccess`, author/admin) → `ChapterService.updateChapter` (sanitise, wordCount, `recordWriting`, recompute book page total) → updated chapter → status badge “Kaydedildi”. Errors propagate as mutation errors → status `error` → manual retry.

**T5 — Comment with a mention.** `MentionInput` (`searchMentionUsers`) → “Gönder” → `createComment` → `CommentService.createComment` (book visible?) → `Comment` insert → `ScoreService.onCommentCreated` (+5, notification) → `notifyMentions` (eligible users, access check, preference) → `notifyUser` author (`COMMENT_RECEIVED`) → response → client refetches `getCommentsByBookId` → `CommentList` regroups.

**T6 — Follow request.** `UserFollowButton` → `requestFollowUser` → `FollowService.requestFollow` (transaction: pair check, existing edge/request, create `FollowRequest`, create `FOLLOW_REQUEST` notification) → `FollowActionResult` → toast + profile refetch (polls while PENDING). Recipient: bell polling → `getIncomingFollowRequests` → “Kabul Et” → `respondToFollowRequest` (transaction: edges, notifications) → refetch.

**T7 — Send a chat message.** `ChatWindow.handleSend` → `sendMessage` (optimistic) → `MessageService.sendMessage` (participant check, recipient permission, attachment check, insert, unread counters, `lastMessage`) → `pubsub.publish('NEW_MESSAGE')` → `onNewMessage` filter (conversation match, active user, participant) → recipient's Apollo cache update. Sender's cache updated from the mutation result.

**T8 — Session entry with access code.** `AccessCodeGate` → `verifySessionAccessCode` (rate limited, bcrypt) → code kept in memory → `getSessionEntries(accessCode)` / subscription with `accessCode` → `EntryComposer` → `addSessionEntry` → `SessionService.addSessionEntry` (code check, insert, points, participant count, mention + reply notifications, publish) → all subscribers receive the entry.

**T9 — Create quote from selection.** DOM selection → `QuotePopup` → `checkQuoteExists` → `createQuote` or `repostQuote` → `QuoteService` (book/chapter checks, normalised duplicate check, insert, points, mention notifications) → cache invalidation of quote lists (`utils/quoteCache.js`).

**T10 — Share.** `SocialShareButton` → `getSocialShare` (public-only checks, path via permanent slug) → `shareLinks()` builds `<API>/share/<type>/<key>?webOrigin=…` → external app opens that URL → `routes/socialShareRoutes.js` returns OG HTML → redirect to `<web origin><path>` → `PublicContentRoute` → `resolvePublicRoute` → page.

**T11 — Support checkout (iyzico sandbox).** `PrintCheckout.start` → `startPrintCheckout` (idempotency key) → `paymentService.checkout` (transaction: policy, reservation on campaign, payment, pre-order with encrypted address) → provider `initialize` → `FundingPayment` with `checkoutUrl` → user opens hosted page → iyzico POST `/api/print/iyzico/callback/:reference` → `reconcilePayment` → 303 redirect to web `/funding-history` → client polls `myFundingPayments`. Background worker reconciles pending payments, expires reservations, settles campaigns, processes refunds.

**T12 — Google sign-in (web).** `<GoogleLogin ux_mode="redirect">` → Google → form POST to `/auth/google/callback` (cookie CSRF) → `authenticateWithGoogleCredential({requireNonce})` → redirect with fragment → `GoogleCallback` verifies nonce → `AuthContext.login`. Mobile equivalent: native Google sign-in → `googleAuth(token)` mutation → same service function without nonce.

**Incomplete traces:** `getRecommendations` scoring was read only at the level of its weight structure (genre signal weights from liked/saved/commented/quoted/onboarding genres, social signal, popularity = likes×0.6 + views×0.1 + shares×0.3 capped, freshness within 30 days; results sorted by score and paginated in memory) — the exact weight constants were not transcribed. `adminService.saveAdminRecord` per-resource side effects were read by rule lines, not exhaustively traced.
