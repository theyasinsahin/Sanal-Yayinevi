# 03 — Backend API Inventory

Stage 1 static analysis. Everything here is **VERIFIED** from source unless tagged **INFERRED**/**UNKNOWN**. Nothing was executed.

Related: auth/limits/error contract → `05_authentication_security.md`; rules behind each operation → `08_business_rules.md`; real-time → `09_integrations_realtime.md`.

## 1. Shape of the API

The backend is **not REST**. It is a single **GraphQL** endpoint (Apollo Server 5 on Express 4) plus a handful of auxiliary HTTP routes.

| Surface | Location | Evidence |
|---|---|---|
| GraphQL over HTTP | `POST <API>/` — Apollo middleware is mounted on `/`, so **any path not claimed by another route reaches GraphQL**; the web client posts to the bare origin `<API>/` (`Client/src/App.js` `createHttpLink({uri: API_URL})`, `Client/.env.example`) | `Server/index.js:156-170` |
| GraphQL subscriptions | `ws(s)://<API>/graphql`, sub-protocol `graphql-transport-ws` | `Server/index.js:105-122` |
| REST: Google redirect callback | `POST /auth/google/callback` | `Server/src/routes/googleAuthRoutes.js` |
| REST: print assets + payment callbacks | `/api/print/*` | `Server/src/routes/printRoutes.js` |
| REST: legacy payment callback | `POST /api/payment/callback` (always 410) | `Server/src/routes/paymentRoutes.js` |
| HTML share previews | `GET /share/:type/:id` | `Server/src/routes/socialShareRoutes.js` |

**Counts (counting definition: one endpoint = one GraphQL root field or one REST route):**

| Kind | Count |
|---|---|
| GraphQL queries | 104 |
| GraphQL mutations | 102 |
| GraphQL subscriptions | 4 |
| REST / HTML routes | 7 |
| **Total** | **217** |

### Common conventions
- **Headers:** `Content-Type: application/json`; `Authorization: Bearer <jwt>` when signed in. Batched requests are rejected. Response header `Server-Timing: graphql;dur=<ms>` is exposed.
- **Versioning:** none. No `/v1`, no schema version. Compatibility is by additive schema evolution; several legacy operations remain as stubs (marked ⚠ below).
- **Scalars:** `ID` (24-hex ObjectId string), `DateTime` (declared in `common.graphql` **without a custom resolver** → serialised by graphql-js default; a JS `Date` serialises through `JSON.stringify` as an ISO-8601 string — **INFERRED**, verify in Stage 2), `JSON` (arbitrary), `MinorAmount` (safe integer kuruş, 0…100,000,000,000). Several `createdAt`/`updatedAt` fields are typed `String` and explicitly converted to ISO strings by resolvers.
- **Date encodings are mixed (INFERRED from resolver code and client parsing; confirm in Stage 2):** `DateTime` fields and explicitly converted fields → ISO-8601 strings; `String`-typed date fields that are returned straight from Mongoose without a resolver (e.g. `Notification.createdAt`, `Quote.createdAt`, `QuoteComment.createdAt`, `ParagraphComment.createdAt`, `UserBadge.earnedAt`, `Genre.createdAt/updatedAt`, `UserScore.createdAt`) → **epoch-millisecond strings** (graphql-js coerces a `Date` to `String` through `valueOf()`); the web client parses these with `new Date(Number(value))`.
- **`Status`** = `{ code: Int!, message: String! }` – used as a generic result; note that some mutations report failure as `code: 400` **inside a successful response** (registration).
- **Auth column legend:** `—` public · `U` signed-in user · `O` owner of the resource · `A` admin · `P` publisher or admin · `(U)` optional (result differs for guests).
- **Pagination styles (three coexist):** `limit/offset` (limit 1–100, offset 0–10000), `page` (fixed server page size), and opaque `after` cursor (book feed only).
- **Errors:** see `05_authentication_security.md` §9. Guest calling a `U` operation → GraphQL error with `extensions.code = UNAUTHENTICATED` (HTTP 200).
- Type definitions: `Server/src/graphql/typedefs/*.graphql`. Resolvers: `Server/src/graphql/resolvers/*.js`. Services: `Server/src/services/*.js`.

---

## 2. Authentication & account (`user.graphql`, `resolvers/user.js`, `services/userService.js`)

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| M `sendRegistrationCode` | — | `email!, username!` → `Status!` | Failure = `code:400` + message (not a GraphQL error). Sends 6-digit e-mail code (10 min). |
| M `registerAndLogin` | — | `username!, fullName!, email!, password!, code!` → `RegistrationPayload!{code,message,token,user}` | Failure = `code:400`, `token:null`. Used by the web client. |
| M `register` | — | same → `Status!` | Same without token. |
| M `login` | — | `email!, password!` → `AuthPayload{token,user}` | Error `Giriş bilgileri geçersiz.` Reactivates deactivated accounts. |
| M `googleAuth` | — | `token!` (Google ID token) → `AuthPayload!` | Mobile-compatible Google path. |
| M `logout` | U | → `Status!` | Revokes **all** sessions (`authVersion++`). |
| M `forgotPassword` | — | `email!` → `Status!` | Always neutral message. |
| M `resetPassword` | — | `token!, newPassword!` → `Status!` | `BAD_USER_INPUT` on invalid/expired token or weak password. |
| M `changeEmail` | U | `newEmail!, currentPassword!` → `Status!` | Invalidates current token. |
| M `changePassword` | U | `currentPassword!, newPassword!` → `Status!` | Invalidates current token. |
| M `deactivateAccount` | U | → `Status!` | |
| M `deleteAccount` | U | → `Status!` | Soft-delete cascade. **Destructive.** |
| M `deleteUserById` | A | `id!` → `Status!` | Actually deactivates (admin record save). |
| Q `me` | U | → `User` | Throws when not signed in. |

## 3. Users, profiles, follow

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getUserById` | — | `id!` → `User` | Active, non-deleted only. Private fields are gated per field. |
| Q `getUserByUsername` | — | `username!` → `User` | Exact match. |
| Q `getUserByEmail` | U (self) / A | `email!` → `User` | `null` otherwise. |
| Q `getAllUsers` | — | `limit, offset` → `[User!]` | Sorted by `_id`. |
| Q `getFollowingByUserId` / `getFollowersByUserId` | (U) | `id!` → `[User]` | `[]` if follow list not visible. |
| Q `getSavedBooksByUserId` | (U) | `id!` → `[Book]` | `[]` if library not visible. |
| Q `getUsersBooksByUserId` | (U) | `id!` → `[Book]` | Drafts only for owner/admin. |
| M `updateProfile` | U | `username, fullName, bio, profilePicture` → `User!` | `Object.assign` + save; only Mongoose schema validation (unique username/e-mail → duplicate-key error). No server-side length/format validation beyond the global 20,000-char string limit (**VERIFIED** `resolvers/user.js:127-134`). |
| M `toggleSaveBook` | U | `bookId!` → `User!` | Add/remove from `savedBooks`. |
| M `updatePrivacySettings` | U | `privacySettings!` → `User!` | Partial update; `allowMessages` ∈ `everyone/followers/none`. |
| M `updateNotificationSettings` | U | `notificationSettings!` → `User!` | Partial update. |
| M `updateAuthorSettings` | U | `authorSettings!` → `User!` | `copyrightNote` ≤300; `weeklyWordGoal` int ≥0; `preferredGenres` = active genre **names** (also saved as `UserPreference`). `defaultLanguage`/`publishingVisible` inputs are accepted by the schema but **ignored by the service** (`userService.js:176-181`). |
| M `toggleFollowUser` ⚠ legacy | U | `followId!` → `Status!` | Delegates to follow-request logic. |
| M `requestFollowUser` | U | `targetId!` → `FollowActionResult!` | Creates a **PENDING request** (all follows need approval) + notification. |
| M `cancelFollowRequest` | U | `targetId!` → `FollowActionResult!` | |
| M `unfollowUser` | U | `targetId!` → `FollowActionResult!` | |
| M `removeFollower` | U | `followerId!` → `FollowActionResult!` | |
| M `respondToFollowRequest` | U (recipient) | `requestId!, accept!` → `FollowActionResult!` | |
| Q `getIncomingFollowRequests` | U | `limit=20, offset=0` → `FollowRequestPage!{items,total}` | |
| Q `searchMentionUsers` | U | `query!` → `[MentionUser!]!` | ≤8 results; username prefix or name contains; only public profiles or the caller's followers. |

`User` computed fields: `canViewProfile`, `canViewLibrary`, `canViewFollowList`, `canMessage`, `isSearchIndexable`, `followStatus` (`NOT_FOLLOWING/PENDING/FOLLOWING`), `publicPath` (`/yazar/<username>`), `weeklyWritingWords` (self only), `email` (self/admin, else `''`), `bio` (only if profile visible), `usersBooks`, `savedBooks`, `followers`, `following`, `donations`, settings objects (self/admin). `draftBooks`, `favouriteAuthors`, `followedBooks` are declared but have **no dedicated resolver** (default property resolution → **UNKNOWN** runtime shape; avoid).

## 4. Books, catalogue, classification

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getBookFeed` | — | `limit` (1–48, default 24), `after`, `sort: BookSort`, `classification: ClassificationFilter`, `search` (≤100), `funding: BookFundingFilter` → `BookFeedPage!{books,endCursor,hasNextPage}` | **Primary discovery API.** Digital, published, active-author books. Cursor is bound to sort+filters. `CLOSEST_TO_TARGET` forces `funding=ACTIVE`. Search matches title, author username/full name, or public quote text (Turkish i/İ/ı/I folded). |
| Q `getBookById` | (U) | `id!` → `Book` | `null` when not visible. |
| Q `getBooksByAuthorId` | (U) | `authorId!` → `[Book!]` | Respects profile privacy; drafts for owner/admin. |
| Q `getAllBooks` | — | `limit, offset` → `[Book!]` | Digital non-draft, newest first. |
| Q `getBookByTitle` | — | `title!` → `Book` | Exact title. |
| Q `searchBooks` | — | `query!` (≤120) → `[Book!]` | Regex on title/description/author full name; ≤100 results. |
| Q `getReadingChapter` | (U) | `bookId!, chapterId!` → `Chapter` | Reader's chapter fetch incl. content (content blank unless `READABLE`). |
| M `createBook` | U | `title!, classification!, description!, imageUrl!` → `Book!` | Creates a **DRAFT** digital book. |
| M `updateBook` | O/A | `bookId!, title, classification, description` → `Book!` | Not for PRINTED books. Cover image cannot be changed through this mutation (no `imageUrl` argument). |
| M `updateBookClassification` | O/A/submitter | `bookId!, classification!` → `Book!` | |
| M `updateBookStatus` | O/A | `bookId!, status!` (`DRAFT/WRITING/COMPLETED/PUBLISHED`), ~~fundingTarget~~, ~~printConfig~~ → `Book!` | Passing `fundingTarget`/`printConfig` is rejected. Needs ≥1 chapter with text unless `DRAFT`. `PUBLISHED` awards 50 points once. |
| M `deleteBook` | O/A | `id!` → `Status!` | Soft delete + cascade. **Destructive.** |
| M `incrementBookViews` | — | `id!` → `Book!` | No de-duplication server-side. |
| M `likeBook` | U | `bookId!` → `Book!` | Toggle; notifies author. |
| M `toggleBookFollow` | U | `bookId!` → `{isFollowing, followCount}` | Followers get `NEW_CHAPTER` notifications. |
| Q `isFollowingBook` | (U) | `bookId!` → `Boolean!` | `false` for guests. |
| Q `getFollowedBooks` | U | → `[Book]` | |
| Q `getClassificationOptions` | — | → `{formats, genres, narrativeFeatures, targetAudiences, contentWarnings}` | Active terms only. |
| Q `searchClassificationTags` | — | `search` (≤50) → `[ClassificationTerm!]!` | Prefix match, ≤20. |
| Q `getAllGenres` | — (A if `includeInactive`) | `includeInactive` → `[Genre!]!` | |
| Q `getGenreBySlug` | — | `slug!` → `Genre` | Throws if missing/inactive. |
| M `createGenre` / `updateGenre` / `deleteGenre` | A | see `genre.graphql` → `Genre!` | Routed through the audited admin save; `deleteGenre` = deactivate. `iconUrl` always `''`. |

`ClassificationInput` = `{ formatId!, genreIds! (1–3), tags (≤8 strings, 2–50 chars), narrativeFeatureIds (≤32), targetAudienceId, contentWarningIds (≤32) }`. `ClassificationFilter` = `{formats, genres, tags, features, audiences}` — arrays of **slugs** (≤20 each).

`Book` notable fields: `kind` (`DIGITAL/PRINTED`), `status` (legacy), `digitalStatus`, `writingStatus`, `publicPath` (`/kitap/<slug>`), `fundingSummary`, `format`, `genres`, `classificationTags`, `tags` (names), `narrativeFeatures`, `targetAudience`, `contentWarnings`, `classificationStatus`, `canEditContent`, `myClaim`, `commentCount`, `likedBy`, `stats{views,shares,likes}`, `chapters` (content only selected if requested), `comments`, `author`, printed fields (`isbn`, `printedAuthor`, `publisher`, `publicationYear`, `publicationStatus`, `purchaseUrl`; `publicationEvidenceUrl`/`reviewNote`/`submittedBy` only for admin/submitter).

## 5. Chapters, reading, bookmarks, progress

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getChaptersByBookId` | (U) | `bookId!` → `[Chapter!]` | Ordered by creation. |
| Q `getChapterById` | (U) | `id!` → `Chapter` | Throws `Bölüm bulunamadı.` |
| Q `getAllChapters` | — | `limit, offset` | Admin-style listing; visibility filtered. |
| Q `getChaptersByAuthorId` | (U) | `authorId!` | |
| M `createChapter` | O/A | `bookId!, title!, content!, pageCount, isHidden` → `Chapter!` | HTML sanitised; +15 points; notifies book followers. |
| M `updateChapter` | O/A | `chapterId!, title, content, pageCount, isHidden` → `Chapter!` | Used by autosave. |
| M `deleteChapter` | O/A | `id!` → `Status!` | Soft delete. **Destructive.** |
| Q `getBookmark` | (U) | `bookId!` → `Bookmark` | `null` for guests / unreadable chapter. |
| M `setBookmark` | U | `bookId!, chapterId!, chapterIndex!, paragraphIndex!, chapterTitle` → `Bookmark!` | One per user+book; server recomputes `chapterIndex`/`chapterTitle`. |
| M `removeBookmark` | U | `bookId!` → `Status!` | |
| Q `getReadingProgress` | U | `bookId!` → `ReadingProgress` | |
| M `saveReadingProgress` | U | `bookId!, chapterId!, completedChapterIds!` → `ReadingProgress!` | |
| M `markChapterAsRead` | U | `bookId!, chapterId!` → `ReadingProgress!` | |
| Q `getUserReadingHistory` | U | → `[ReadingProgress!]!` | Latest first. |
| M `startReadingSession` | U | `bookId!, chapterId!` → `{sessionId}` | Starts a verified reading-time session (one per user). |
| M `reportReadingTime` | U | `sessionId!, sequence!, seconds! (1–60), chapterId!` → `{sequence, acceptedSeconds, earnedPoints, score}` | Error codes `READING_SESSION_REPLACED`, `READING_SESSION_EXPIRED`, `READING_TOO_FAST`. |
| M `addReadingMinutes` ⚠ | U | deprecated – always throws | |

`Chapter` fields: `accessStatus` (`READABLE/REGISTRATION_REQUIRED/HIDDEN/UNAVAILABLE`), `canReadContent`, `content` (sanitised HTML or `''`), `isHidden`, `wordCount`, `pageCount`, `publicPath` (`/kitap/<book>/bolum/<chapter>`).

## 6. Comments & paragraph comments

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getCommentsByBookId` | — | `bookId!` → `[Comment!]` | Flat list (top-level + replies distinguished by `parentId`), newest first. `Comment.replies` resolver **always returns `[]`** — clients must group by `parentId`. |
| Q `getCommentById`, `getCommentsByUserId`, `getAllComments` | — | | |
| M `createComment` | U | `bookId!, content!` → `Comment!` | +5 points; mentions + author notification. |
| M `replyToComment` | U | `bookId!, content!, parentCommentId!` → `Comment` | Replies are flattened to one level (reply-to-reply attaches to root); server auto-prefixes `@username` of the replied-to user. |
| M `deleteComment` | O | `id!` → `Status!` | Also soft-deletes replies. Admin cannot use this path. |
| M `toggleCommentLike` | U | `commentId!` → `Comment` | |
| Q `getParagraphComments` | (U) | `chapterId!, paragraphIndex!` → `[ParagraphComment]` | `[]` if chapter unreadable. |
| Q `getParagraphCommentCounts` | (U) | `chapterId!` → `[{paragraphIndex,count}]` | |
| M `addParagraphComment` | U | `bookId!, chapterId!, paragraphIndex!, content!` → `ParagraphComment!` | |
| M `deleteParagraphComment` | O | `id!` → `Status!` | **Hard delete.** |
| M `toggleParagraphCommentLike` | U | `id!` → `ParagraphComment!` | |

Note: the `Comment` type's `userId` field returns a **`User` object** (naming quirk).

## 7. Quotes

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getQuotesFeed` | — | `limit=20, offset=0, sortBy` (`popular` default → likes desc; anything else → newest) → `[Quote]` | Public, non-repost quotes. |
| Q `searchQuotes` | — | `query!, limit, offset` → `[Quote]` | |
| Q `getQuotesByBook` | (U) | `bookId!` → `[Quote]` | Public + caller's private. |
| Q `getQuotesByUser` | (U) | `userId!` → `[Quote]` | Includes reposts; respects profile privacy. |
| Q `getQuoteById` | (U) | `id!` → `Quote` | `null` if not accessible. |
| Q `checkQuoteExists` | (U) | `text!, bookId!, visibility=PUBLIC` → `{exists, quote}` | Duplicate detection by normalised text. |
| Q `getQuoteComments` | (U) | `quoteId!` → `[QuoteComment]` | |
| M `createQuote` | U | `text!, note, bookId!, chapterId, pageNumber, chapterTitle, chapterIndex, location{startOffset,endOffset}, isSpoiler, visibility=PUBLIC` → `Quote!` | Duplicate → error message `QUOTE_EXISTS:<quoteId>` (plain `Error`; masked in production — see risks). +10 points. Printed books: text 10–1000 chars, `pageNumber` 1…pageCount. |
| M `repostQuote` | U | `originalQuoteId!, repostComment, isSpoiler` → `Quote!` | Once per user; +3 points. |
| M `unrepostQuote` | U | `originalQuoteId!` → `Boolean!` | |
| M `deleteQuote` | O | `id!` → `Status!` | |
| M `toggleQuoteLike` | U | `id!` → `Quote!` | Notifies owner. |
| M `addQuoteComment` | U | `quoteId!, content!` → `QuoteComment!` | |
| M `deleteQuoteComment` | O | `id!` → `Status!` | |
| M `toggleQuoteCommentLike` | U | `id!` → `QuoteComment!` | |

`Quote.text/note/repostComment` are returned as `''` when the chapter is hidden or the quote/book is not readable.

## 8. Sessions (collaborative writing rooms)

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getSessions` | — | `limit=20, offset=0` → `[Session!]!` | Newest first. |
| Q `getSession` | (U) | `sessionId!` → `Session` | `FOLLOWERS_ONLY` requires follower/creator. |
| Q `getSessionEntries` | (U) | `sessionId!, limit=30, offset=0, accessCode` → `[SessionEntry!]!` | Oldest first. `PRIVATE` requires `accessCode`. |
| Q `getSessionEntry` | (U) | `sessionId!, entryId!, accessCode` → `SessionEntry` | Deep-link target. |
| Q `verifySessionAccessCode` | — | `sessionId!, accessCode!` → `Boolean!` | Rate limited 10/15 min. |
| M `createSession` | U + approved access | `input{title!, description, coverImageUrl, type!, accessCode, tags}` → `Session!` | `PRIVATE` needs code ≥4 chars. Cover must be a Cloudinary `https://res.cloudinary.com/.../image/upload/...` URL or empty. |
| M `updateSessionCover` | O/A | `sessionId!, coverImageUrl` → `Session!` | |
| M `addSessionEntry` | U | `sessionId!, content! (≤5000), accessCode` → `SessionEntry!` | +5 points; publishes subscription event. |
| M `deleteSessionEntry` | O | `entryId!` → `Boolean!` | |
| M `toggleSessionEntryLike` | U | `entryId!, accessCode` → `SessionEntry!` | |
| M `closeSession` | O | `sessionId!` → `Boolean!` | Irreversible via API. |
| Q `mySessionCreationAccess` | U | → `SessionCreationAccess!` | |
| M `requestSessionCreationAccess` | U | `reason!` (10–1000) → `SessionCreationAccess!` | |
| Q `sessionAccessRequests` | A | `status=PENDING, page=1` → page (20/page) | |
| M `reviewSessionCreationAccess` | A | `userId!, revision!, approve!, note` → `SessionCreationAccess!` | `CONFLICT` on stale revision. |
| S `onNewSessionEntry` | (U) | `sessionId!, accessCode` → `SessionEntry!` | |

## 9. Messaging

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getConversations` | U | → `[Conversation!]!` | Sorted by `updatedAt` desc. |
| Q `getConversation` | U (participant) | `conversationId!` → `Conversation` | |
| Q `getOrCreateConversation` | U | `recipientId!` → `Conversation` | **A query with a write side effect.** Checks recipient's `allowMessages`. |
| Q `getMessages` | U (participant) | `conversationId!, limit=20, offset=0` → `[Message!]!` | **Newest first.** |
| Q `getMessageRecipients` | U | `search, limit=30, offset` → `[User!]!` | Only users the caller follows who accept messages. |
| Q `getUnreadMessageCount` | U | → `Int!` | |
| M `sendMessage` | U (participant) | `input{conversationId!, content, type! (TEXT/QUOTE/BOOK), attachedQuoteId, attachedBookId}` → `Message!` | |
| M `markMessagesAsRead` | U | `conversationId!` → `Boolean!` | |
| M `editMessage` | O | `messageId!, content!` → `Message!` | TEXT only. |
| M `deleteMessage` | O | `messageId!` → `Boolean!` | Soft delete. |
| S `onNewMessage` | U (participant) | `conversationId!` → `Message!` | Only new messages (no edit/delete/read events). |

## 10. Score, leaderboard, badges, notifications, recommendations

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getLeaderboard` | — | `period` (`total`/`daily`/`weekly`/`monthly`) → `[LeaderboardEntry]` | Top 10. Periods use Europe/Istanbul boundaries; week starts Monday. |
| Q `getUserScore` | — | `userId!` → `UserScore` | |
| Q `getUserRank` | — | `userId!, period` → `{rank, points}` | `rank:null` if 0 points. |
| Q `getUserBadges` | — | `userId!` → `[UserBadge]` | |
| Q `getNotifications` | U | → `[Notification]` | **Latest 20 only; no pagination.** |
| Q `getUnreadNotificationCount` | (U) | → `Int` | 0 for guests. |
| M `markNotificationsRead` | U | → `Boolean` | Marks all. |
| S `myScoreUpdated` | U | → `Boolean!` | |
| S `leaderboardUpdated` | — | → `Boolean!` | |
| Q `getRecommendations` | U | `limit=10, offset=0` → `[{book, score, reason}]` | |
| Q `getUserPreference` | U | → `UserPreference` | |
| M `saveUserPreference` | U | `genreIds!` → `UserPreference!` | Onboarding genres. |

## 11. Printed-book catalogue & personal reading log

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `getPrintedBooks` | — | `page=1, search="", classification` → `PrintedBookPage!{books,total,page,totalPages}` | 12 per page; sorted by `recognitionScore`. |
| Q `lookupPrintedBook` | U | `isbn!` → `IsbnLookup!` | Server-side external ISBN lookup (see `09_integrations_realtime.md`). |
| M `submitPrintedBook` | U | `input: PrintedBookInput!` → `Book!` | Creates `PENDING` printed book. Year 1400…current, pages 1–50000, HTTPS URLs. |
| Q `getMyPrintedSubmissions` | U | → `[Book!]!` | ≤100. |
| Q `getPrintedBookReviews` | A | → `[Book!]!` | Pending queue. |
| M `reviewPrintedBook` | A | `bookId!, approve!, note` → `Book!` | |
| M `requestBookClaim` | U | `bookId!, evidence!, evidenceUrl` → `BookClaim!` | Author claims an unowned printed book. |
| Q `getBookClaimReviews` | A | → `[BookClaim!]!` | |
| M `reviewBookClaim` | A | `claimId!, approve!, note` → `BookClaim!` | Approval assigns `authorId`. |
| Q `myPrintedBookReading` | U | `bookId!` → `PrintedBookReading` | |
| Q `getPrintedReadings` | (U) | `userId!, page=1` → `PrintedReadingPage!{items,total,page,totalPages,canView}` | 12 per page; privacy → `canView:false`. |
| M `savePrintedBookReading` | U | `bookId!, rating! (1–5), review (≤3000)` → `PrintedBookReading!` | Approved printed books only. |
| M `removePrintedBookReading` | U | `bookId!` → `Boolean!` | |

## 12. Print funding (crowdfunded printing) — `printFunding.graphql`, `services/print/*`

All money is `MinorAmount` (kuruş). Environment is **SANDBOX only** in code (no live-payment mode exists). Mutations other than the “preparation” set throw `PRINT_SYSTEM_DISABLED` when the print system is off; payment mutations throw `PAYMENTS_DISABLED` when no provider is enabled.

| Operation | Auth | Notes |
|---|---|---|
| Q `printPaymentMode` | — | `DISABLED` / `SANDBOX` / `IYZICO_SANDBOX`. Client feature switch. |
| Q `printOverview(bookId!)` | (U) | `{digitalStatus, writingStatus, interestCount, interested, campaign}` |
| Q `printTariffs` | — | ≤50, newest first. |
| M `setPrintInterest(bookId!, interested!)` | U | “I would buy a printed copy”. |
| Q `myPrintApplications(page)`, `myPrintApplicationForBook(bookId!)` | U | 20/page. |
| Q `printApplication(id!)`, `printApplicationHistory(id!)`, `printApplicationVersions(id!)` | O/A | |
| M `savePrintApplication(input!)` | O | Book must be PUBLISHED + COMPLETED. `specification{dimension ∈ 13.5x21/16x24, paperType ∈ enzo/ivory/coated, coverType ∈ paperback/hardcover, color ∈ BW/COLOR, printRun 1–100000, coverAssetId, coverDpi 300–2400, bleedMm 3–20, notes}`; `declarations{copyright, permissions, terms}` all `true`. Optimistic `revision`. |
| M `submitPrintApplication(applicationId!, revision!)` | O | |
| M `cancelPrintApplication(applicationId!, revision!, reason!)` | O | |
| Q `adminPrintApplications(page)` | A | |
| M `reviewPrintApplication(input!)` | A (not own) | `decision ∈ APPROVED/REJECTED/REVISION_REQUESTED`; approval requires a verified `quote` JSON incl. layout & quote PDF assets. |
| M `createPrintTariff(input: JSON!)` | A | |
| M `openFundingCampaign(input{applicationId!, revision!, days})` | A | Only from an `APPROVED` application with a verified quote. One active campaign per book and per author (`services/print/campaignService.js:9-28`). |
| M `closeFundingCampaign(campaignId!, reason!)` | A | Only `ACTIVE`/`CLOSING`; sets `CLOSING` with outcome `CANCELLED` (refunds follow). |
| Q `myFundingCampaigns(page)` / `adminFundingCampaigns(page)` | U / A | |
| M `startPrintCheckout(input{campaignId!, idempotencyKey! (16–100, `[A-Za-z0-9_-]`), quantity 0–100, donationMinor, shippingAddress})` | U | Returns `FundingPayment` incl. `checkoutUrl` (iyzico hosted page) when provider is `IYZICO_SANDBOX`. `shippingAddress{consent:true, fullName, phone, city, district, postalCode, line}` required when `quantity>0`. `CAPACITY_EXCEEDED`, `CONFLICT` codes. |
| M `simulatePrintPayment(paymentId!, outcome!)` | U (owner of payment) | Only for the local mock provider. |
| M `cancelPrintPayment(paymentId!)` | U | |
| M `requestPrintRefund(paymentId!, reason!)` | U | |
| M `retryPrintRefund(refundId!)` | A | |
| Q `myFundingPayments(page)`, `myFundingPayment(id!)`, `myPrintOrders(page)` | U | `PrintPreOrder.shippingAddress` is decrypted for owner/admin only. |
| Q `adminFundingPayments`, `adminPrintOrders`, `adminFundingRefunds` | A | |
| M `updatePrintProduction(input!)`, `updatePrintOrder(input!)` | A | State machines in `08_business_rules.md`. |
| Q `printCampaignAudit(campaignId!)` | O/A | |
| M `runPrintMaintenance` | A | 2/min. |

REST companions (`routes/printRoutes.js`):

| Route | Auth | Request | Response |
|---|---|---|---|
| `POST /api/print/assets` | Bearer JWT | Raw body, `Content-Type: application/pdf`, ≤10 MB, header `X-Filename`. Must start with `%PDF-` and contain `%%EOF`. | `201` JSON asset descriptor (id, sha256, …) |
| `GET /api/print/assets/:id` | Bearer JWT (owner/admin/authorised) | — | `200 application/pdf`, `Content-Disposition: attachment; filename="print-document.pdf"`, `ETag` |
| `POST /api/print/iyzico/callback/:reference` | none (token in body verified against DB) | urlencoded `token` | `303` redirect to `${CLIENT_URL}/funding-history` |
| `POST /api/print/webhooks/sandbox` | signature headers | raw JSON ≤32 kB | `{received:true}` |

Errors on these routes: `{error, message}` with 400/401/403/500/503.

## 13. Legacy donations (read-only)

| Operation | Auth | Notes |
|---|---|---|
| M `initializePayment(bookId!, amount!)` ⚠ | — | **Always throws** (`Eski ödeme akışı kapalı…`). |
| Q `getMyTransactions` | U | Historical records. |
| Q `getBookTransactions(bookId!)`, `getAllTransactions` | A | |
| Q `getBookBackers(bookId!)` | A (returns `[]` for others) | |
| `POST /api/payment/callback` ⚠ | — | Always `410 {error:'LEGACY_PAYMENT_DISABLED'}` |

## 14. Publisher portal, admin, community, sharing, routing, misc.

| Operation | Auth | Arguments → Result | Notes |
|---|---|---|---|
| Q `publisherCatalog` | P | `page=1, limit=20 (≤48), search (≤100), funding: ALL/HAS_CAMPAIGN/ACTIVE/SUCCEEDED` → `PublisherCatalogPage!` | Read-only summary of books + campaigns. |
| Q `getAdminResources` | A | → `[AdminResource!]!` | Generic schema-driven admin metadata. |
| Q `getAdminOverview` | A | → `AdminOverview!` | Dashboard counters, revenue. |
| Q `getAdminRecords` | A | `resource!, page, limit (≤100), search (≤120), state ALL/ACTIVE/INACTIVE/DELETED, relatedField, relatedId` → `AdminRecordPage!` | |
| Q `getAdminRecord` | A | `resource!, id!` → `AdminRecord` | |
| M `saveAdminRecord` | A | `resource!, id, revision, changes: JSON!, reason! (5–500)` → `AdminRecord!` | Optimistic `revision`; audited; `CONFLICT` on stale. |
| Q `getAuthors` | — | `page=1, pageSize=12 (≤100)` → `AuthorPage!` | Authors with ≥1 public book and public profile, by username. |
| Q `getCommunityConfig` | — | → `{email, phone, socials{instagram,x,linkedin,tiktok}}` | From env. |
| M `sendContactMessage` | — | `input{name 2–100, email, subject 3–150, message 10–5000, website (honeypot, must be empty)}` → `Status!` | 10/15 min per IP. |
| M `subscribeNewsletter` | — | `input{email, consent:true, website}` → `Status!` | Double opt-in e-mail. |
| M `manageNewsletter` | — | `token! (64 hex), action: confirm/unsubscribe` → `Status!` | Target of e-mailed web link `/newsletter?token=…&action=…`. |
| Q `getSocialShare` | — | `type: BOOK/CHAPTER/QUOTE/PROFILE/SESSION, id!` → `SocialShare!{type,id,title,description,path,imagePath,webOrigin}` | `id` may be slug/username. Only public content; `NOT_FOUND` otherwise. |
| Q `resolvePublicRoute` | (U) | `type: PROFILE/BOOK/SESSION, reference!, legacy, chapter` → `PublicRoute{id, path, chapterId}` | **Slug → id resolver; essential for deep links.** `legacy:true` treats `reference` as an ObjectId. |
| Q `healthCheck` | — | → `String!` | `"Server is up and running!"` |
| M `ping` | — | → `String!` | `"Pong!"` |

`GET /share/:type/:id?webOrigin=<origin>` → small HTML page with Open Graph/Twitter meta tags that immediately `location.replace`s to the web client URL (`<CLIENT_URL><path>`); 404 HTML when not public. This is the URL the web client shares so that link previews work.

## 15. Subscriptions summary

| Subscription | Auth | Trigger | Payload |
|---|---|---|---|
| `onNewMessage(conversationId!)` | participant | `sendMessage` | `Message` |
| `onNewSessionEntry(sessionId!, accessCode)` | per session type | `addSessionEntry` | `SessionEntry` |
| `myScoreUpdated` | U | points awarded | `true` |
| `leaderboardUpdated` | — | points awarded | `true` |

Details and scaling caveat (in-process `PubSub`) → `09_integrations_realtime.md`.

## 16. Operations with no client usage / legacy

See `06_frontend_architecture.md` §“GraphQL operations used by the web client” for the list of operations the React app actually calls; operations not in that list need no Flutter counterpart for parity.
