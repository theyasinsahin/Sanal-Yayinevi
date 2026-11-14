# 04 — Database Schema

Stage 1 static analysis. Evidence: `Server/src/models/*.js`. Classification legend: **VERIFIED** / **INFERRED** / **UNKNOWN** (see `README.md`).

> The live database is not guaranteed to match these source-defined schemas (legacy fields such as `Book.status`, `Book.genreId`, `Book.tags` coexist with their replacements). No database was accessed in Stage 1.

## 1. Technology

| Item | Finding | Evidence |
|---|---|---|
| Database | MongoDB | `Server/src/config/db.js` (`mongoose.connect(process.env.MONGO_URI)`) |
| ODM | Mongoose `^8.6.3` | `Server/package.json` |
| Topology requirement | **Replica set (or mongos) required** — follow requests, print funding and admin saves use multi-document transactions (`mongoose.connection.transaction`) | `Server/src/services/followService.js:18-22`, `.env.example` (`replicaSet=rs0`), `config/startup.js:42` |
| IDs | MongoDB `ObjectId`, exposed through GraphQL as `ID` strings (24 hex chars) | all models |
| Deletion model | Soft delete (`isDeleted`, `deletedAt`) on most user content; hard deletes are rare (`Verification`, bookmarks, print interest) | models below |
| Migrations | No migration framework. One-off scripts in `Server/src/scripts/` (`migratePoints`, `migrateClassification`, `migratePrintFunding`, `migrateUserSettings`, `backfillIsDeleted`) | `Server/package.json` scripts |

**Entity count: 52 Mongoose models** = 35 single-file models + 17 models in `models/printFunding.js`. Counting definition: one entity per `mongoose.model(...)` registration (each maps to one MongoDB collection). Embedded sub-schemas (e.g. `PrivacySettings`) are not counted.

## 2. Core domain entities

Types: `OID` = ObjectId. `ts` = `{timestamps:true}` → `createdAt`, `updatedAt`.

### User (`models/user.js`) — ts
| Field | Type | Notes |
|---|---|---|
| username | String, required, **unique** | validated 3–50 chars (`userService.js:39-41`) |
| fullName | String, required | |
| email | String, required, **unique** | stored lower-cased by services |
| password | String, required | bcrypt hash (cost 12); never exposed in GraphQL |
| bio, profilePicture, website | String, default `''` | `profilePicture` may be URL or `data:` image |
| role | enum `USER` \| `PUBLISHER` \| `ADMIN`, default `USER` | |
| isVerified | Boolean, default false | set true on registration / Google |
| isActive | Boolean, default true | false = deactivated; login reactivates |
| authVersion | Number, default 0 | incremented to revoke all JWTs |
| loginBlocked | Boolean, default false | admin-controlled |
| googleSubject | String | Google `sub` |
| isDeleted / deletedAt | soft delete | |
| followers, following | [OID→User] | maintained transactionally by `followService` |
| savedBooks, usersBooks, followedBooks | [OID→Book] | |
| savedAuthors | [OID→User] | **INFERRED unused** (no resolver reads it) |
| lastLogin | Date | |
| resetPasswordToken | String | SHA-256 hash of the emailed token |
| resetPasswordExpires | Date | 1 hour |
| isPremium | Boolean | deprecated in GraphQL |
| sessionCreationAccess | embedded: `status` enum `NONE/PENDING/APPROVED/REJECTED`, `reason`≤1000, `requestedAt`, `reviewedAt`, `reviewedBy`, `reviewNote`≤500, `revision` | |
| privacySettings | embedded: `isProfilePublic`(true), `isLibraryPublic`(true), `isFollowListPublic`(true), `allowMessages` enum `everyone/followers/none` (everyone), `showInSearchEngines`(true) | |
| notificationSettings | embedded 12 booleans; defaults true except `emailDigest`, `emailMarketing` false | |
| authorSettings | embedded: `defaultLanguage`('tr'), `publishingVisible`(true), `copyrightNote`≤300, `weeklyWordGoal`(null, ≥0), `preferredGenres`[String] | |

Indexes: `{isDeleted:1}`, `{sessionCreationAccess.status:1, sessionCreationAccess.requestedAt:-1, _id:-1}`, unique `username`, unique `email`.

### Book (`models/book.js`) — ts
| Field | Type | Notes |
|---|---|---|
| urlSlug | String, unique sparse | readable URL slug |
| kind | enum `DIGITAL` \| `PRINTED`, default DIGITAL | PRINTED = catalogue record of a physically published book |
| isbn | String | unique partial index (strings only) |
| printedAuthor, publisher | String | printed books |
| publicationYear | Number | |
| publicationStatus | enum `PENDING/APPROVED/REJECTED` | printed-book review state |
| submittedBy, reviewedBy | OID→User | |
| publicationEvidenceUrl, purchaseUrl, reviewNote | String | |
| reviewedAt | Date | |
| claimVersion | Number | optimistic concurrency for claims |
| title | String, required | |
| authorId | OID→User | may be absent for unclaimed printed books |
| imageUrl | String | cover; URL or `data:` image |
| pageCount | Number | |
| genreId | OID→Genre | **legacy** single genre |
| formatId, targetAudienceId | OID→ClassificationTerm | |
| genreIds | [OID→Genre] | |
| tagIds, narrativeFeatureIds, contentWarningIds | [OID→ClassificationTerm] | |
| classificationStatus | enum `COMPLETE/NEEDS_REVIEW` | |
| classificationVersion, recognitionScore (0–1,000,000), editorialVersion | | |
| tags | [String] | **legacy**; GraphQL `tags` is resolved from `tagIds` |
| description | String | |
| stats | `{views, shares, likes}` Numbers | |
| likedBy | [OID→User] | |
| publishDate | Date, default now | |
| comments, chapters | [OID] | legacy denormalised arrays; resolvers query the collections instead |
| status | enum `DRAFT/WRITING/COMPLETED/FUNDING/FUNDED/PUBLISHED`, default DRAFT | **legacy combined status** |
| digitalStatus | enum `DRAFT/PUBLISHED` | newer split status |
| writingStatus | enum `WRITING/COMPLETED` | newer split status |
| completedAt | Date | |
| printRevision | Number | optimistic concurrency |
| printConfig | `{paperType enum enzo/ivory/coated, coverType enum hardcover/paperback, dimension '13.5x21', estimatedPageCount}` | legacy |
| fundingTarget, currentFunding, backerCount, fundingDeadline | legacy funding counters | |
| adminArchiveId | OID→AdminAudit | |
| isDeleted / deletedAt | soft delete | |

Indexes: `{isDeleted}`, unique partial `{isbn}`, `{kind, publicationStatus, createdAt:-1}`, `{kind, publicationStatus, isDeleted, recognitionScore:-1, createdAt:-1, _id:-1}`, `{isDeleted, publishDate:-1, _id:-1}`, `{isDeleted, updatedAt:-1, _id:-1}`, `{isDeleted, stats.likes:-1, _id:-1}`, and for each of `formatId, genreIds, tagIds, narrativeFeatureIds, targetAudienceId`: `{isDeleted, <field>, publishDate:-1, _id:-1}`.

### Chapter (`models/chapter.js`) — ts
`urlSlug` (unique sparse), `bookId` (OID→Book, req), `authorId` (OID→User, req), `title`, `content` (HTML string), `isHidden` (false), `wordCount` (auto-computed in `pre('validate')` via `chapterWordCount`), `pageCount` (0), `adminArchiveId`, `isDeleted`, `deletedAt`.
Indexes: `{isDeleted}`, `{isHidden,_id}`, `{bookId,isDeleted}`, `{bookId,isDeleted,createdAt,_id}`. **Chapter order = `createdAt` ascending, then `_id`** (no explicit order field).

### Comment (`models/comment.js`) — no timestamps
`userId`, `bookId`, `content`, `date` (default now), `likedBy[]`, `replies` (Mixed[], legacy), `parentId` (OID→Comment, null = top level), `adminArchiveId`, `isDeleted`, `deletedAt`. Indexes `{isDeleted}`, `{bookId,isDeleted}`.

### ParagraphComment — ts
`bookId`, `chapterId`, `userId` (all req), `paragraphIndex` (Number, req), `content` (req), `likedBy[]`, soft delete. Index `{chapterId, paragraphIndex}`.

### Bookmark — ts
`userId`, `bookId`, `chapterId` (req), `chapterIndex`, `paragraphIndex` (req), `chapterTitle`. **Unique `{userId, bookId}`** → one bookmark per user per book.

### Quote — ts
`text` (req), `normalizedText` (req, duplicate detection), `note`, `visibility` enum `PUBLIC/PRIVATE` (PUBLIC), `userId`, `bookId` (req), `chapterId`, `pageNumber` (≥1), `chapterTitle`, `chapterIndex`, `location {startOffset,endOffset}`, `likedBy[]`, `isRepost`, `originalQuoteId` (OID→Quote), `repostComment`, `repostedBy[]`, `isSpoiler`, soft delete.
Indexes: `{normalizedText, bookId}`, `{isDeleted}`, `{userId, visibility, createdAt:-1}`, `{bookId, visibility, isDeleted}`.

### QuoteComment — ts
`quoteId`, `userId`, `content` (req), `likedBy[]`, soft delete.

### Genre — ts
`group` enum `FICTION/KNOWLEDGE`, `sortOrder`, `classificationVersion`, `name` (unique), `slug` (unique, lowercase), `description`, `iconUrl`, `hexColor` (default `'var(--primary)'` — a **CSS variable string**, see compatibility doc), `isActive`.

### ClassificationTerm — ts
`kind` enum `FORMAT/FEATURE/AUDIENCE/WARNING/TAG` (immutable), `slug` (immutable, kebab-case ≤100), `name` ≤100, `description` ≤1000, `normalizedName`, `isActive`, `sortOrder`, `createdBy`. Unique `{kind, slug}`; unique partial `{kind, normalizedName}`.

### Session (writing/“oturum” room) — ts
`urlSlug` (unique sparse), `coverImageUrl` ≤2048, `title` (req, ≤150), `description` ≤500, `type` enum `OPEN/FOLLOWERS_ONLY/PRIVATE`, `accessCode` (String; hashed — see business rules), `createdBy` (req), `isActive` (true), `tags[]`, `participantCount`, soft delete. Indexes `{isActive, createdAt:-1}`, `{isDeleted}`.

### SessionEntry — ts
`sessionId`, `userId` (req), `content` (req, trim, ≤5000), `likedBy[]`, soft delete. Index `{sessionId, createdAt}`.

### Conversation — ts
`participants[]` (OID→User), `lastMessage` (OID→Message), `unreadCounts` (Map<userId, Number>), `isGroup` (false), `groupName`, `groupImageUrl`. Group fields exist but **no group-creation API exists (VERIFIED: no mutation)**.

### Message — ts
`conversationId`, `senderId` (req), `content`, `type` enum `TEXT/QUOTE/BOOK`, `attachedQuoteId`, `attachedBookId`, `lastMessageAt`, soft delete. Index `{conversationId, createdAt:-1}`.

### FollowRequest — ts
`requesterId`, `recipientId` (req), `status` enum `PENDING/ACCEPTED/REJECTED/CANCELLED`, `resolvedAt`. Unique partial `{requesterId, recipientId}` where `status='PENDING'`; `{recipientId, status, createdAt:-1}`.

### Notification — ts
`userId` (req), `type` enum (17 values: `PRINT_UPDATE, BOOK_REVIEW, POINTS_EARNED, BADGE_EARNED, FUNDING_RECEIVED, NEW_CHAPTER, BOOK_LIKED, COMMENT_RECEIVED, FOLLOW_REQUEST, FOLLOW_REQUEST_ACCEPTED, NEW_FOLLOWER, QUOTE_LIKED, SESSION_MENTION, SESSION_REPLY, COMMENT_MENTION, PARAGRAPH_MENTION, QUOTE_MENTION`), `title`, `message` (req), `icon` (emoji), `isRead`, `meta` (Mixed — navigation payload), `dedupKey` (unique partial).

### Scoring
- **UserScore** — ts: `userId` (unique), `totalPoints`, `readingRemainderSeconds`, `stats {quotesCreated, commentsCreated, repostsCreated, booksPublished, chaptersAdded, minutesRead, sessionEntriesCreated}`.
- **PointEvent** — ts: `userId`, `points`, `action`, `sourceId`. Indexes `{createdAt:-1,userId}`; unique partial `{userId, action, sourceId}` (idempotent awards). Period (daily/weekly/monthly) points are computed from this collection.
- **Badge** — ts: `key` (unique), `name`, `description`, `icon`, `condition {stat, threshold}`.
- **UserBadge** — ts: `userId`, `badgeId`, `earnedAt`; unique `{userId, badgeId}`.
- **ReadingSession**: `userId` (**unique** — one active reading session per user), `token`, `bookId`, `lastHeartbeatAt`, `expiresAt`, `clockBudgetMs`, `sequence`.
- **WritingActivity**: `userId`, `chapterId`, `weekStart`, `words`; unique `{userId, chapterId, weekStart}`.

### Reading & preferences
- **ReadingProgress** — ts: `userId`, `bookId` (unique pair), `lastChapterId`, `completedChapters[]`, `lastReadAt`, `isCompleted`.
- **UserPreference** — ts: `userId` (unique), `preferredGenres[]` (OID→Genre), `onboardingCompleted`.
- **PrintedBookReading** — ts: `userId`, `bookId` (unique pair), `rating` (int 1–5, req), `review` ≤3000, `readAt`, soft delete, `adminArchiveId`.

### Printed catalogue
- **BookClaim** — ts: `bookId`, `claimantId`, `evidence` ≤3000 (req), `evidenceUrl`, `status` enum `PENDING/APPROVED/REJECTED`, `reviewNote`, `reviewedBy`, `reviewedAt`. Unique partial `{bookId, claimantId}` where PENDING.
- **PrintedCatalogRecord** — import provenance (`bookId` unique, `batchId`, hashes, `importedBy`, `verification`).
- **PrintedEditorialRecord** — editorial curation provenance; unique `{batchId, bookId}`.

### Auth / security / misc
- **Verification**: `email`, `code` (bcrypt hash of 6-digit code), `attempts`, `createdAt` with **TTL 600 s**.
- **SecurityRateBucket**: `_id` (sha256 of scope:identity:window), `count`, `expiresAt` (TTL index).
- **NewsletterSubscription** — ts: `email` (unique), `status` enum `pending/active/unsubscribed`, `consentVersion`, `requestedAt`, `confirmedAt`, `unsubscribedAt`, `tokenHash`, `tokenExpiresAt`.
- **Transaction** (legacy donations): `userId`, `bookId`, `amount`, `currency` (TRY), `status` enum `PENDING/SUCCESS/FAILED/REFUNDED`, `paymentProviderId`, `paymentProvider` ('IYZICO'), `createdAt`. Read-only today (`routes/paymentRoutes.js` returns 410).
- **IyzicoCheckout** — ts: `merchantReference` (unique), `token` (unique partial), `checkoutUrl`, `amountMinor`, `currency`, `state`, `leaseUntil`, `cancelled`, `paymentId`, `paymentTransactionId`, `capturedAt`, `refundReference`, `refundId`.
- **AdminAudit** — ts: `actorId`, `resource`, `recordId`, `action`, `reason` ≤500, `fields[]`.
- **AdminControl**: `_id` String, `version`.

## 3. Print-funding entities (`models/printFunding.js`)

All use `{timestamps:true, strict:'throw'}`. “append-only” = updates/deletes throw. Money is stored as **integer minor units (kuruş)**, 0…100,000,000,000.

| Model | Purpose | Key fields / constraints |
|---|---|---|
| PrintAsset (append-only) | Uploaded PDF | `ownerId`, `sha256`, `bytes`, `filename`≤120, `mime='application/pdf'`, `data` Buffer (select:false). Unique `{ownerId, sha256}` |
| BookPrintVersion (append-only) | Frozen manuscript snapshot | `bookId`, `authorId`, `title`, `authorName`, `chapters[{sourceId,title,content}]`, `wordCount`, `estimatedPages`, `contentHash`, `specification`, `declarations`, `classificationReview` |
| PrintTariff (append-only) | Pricing table | `version` (unique), `label`, `environment='SANDBOX'`, `pageRates`, `coverRates`, `dimensionBps`, `colorBps`, `setupMinor`, `packagingPerUnitMinor`, `shippingPerUnitMinor`, `serviceMinor`, `taxBps`, `feeBps`, `policy {donationMinMinor 5000, donationMaxMinor 10000000, quickAmountsMinor [5000,10000,25000,50000], campaignDays 30, reservationMinutes 15, maxOrderQuantity 10}` |
| PrintApplication | Author’s print application | `bookId`, `authorId`, `versionId`, `previousVersionIds[]`, `revision`, `state` enum `PREPARING/SUBMITTED/REVISION_REQUESTED/APPROVED/REJECTED/CANCELLED`, `open`, `tariffId`, `estimate`, `verifiedQuote`, `approvedTargetMinor`, `approvedUnitPriceMinor`, `reviewNote`≤2000. Unique partial `{bookId}` where `open:true` |
| FundingCampaign | Crowdfunding campaign | `bookId`, `authorId`, `applicationId` (unique), `versionId` (unique), `tariffId`, `environment`, `title`, `state` enum `ACTIVE/CLOSING/SUCCEEDED/FAILED/CANCELLED/REFUNDING/REFUNDED`, `activeLock`, `outcome` enum `TARGET/DEADLINE/CANCELLED`, `targetMinor`, `unitPriceMinor`, `acceptedMinor`, `reservedMinor`, `printRun`, `soldQuantity`, `reservedQuantity`, `supporterCount`, `startsAt`, `endsAt`, `financeIssue`, `productionState` enum `NOT_STARTED/PREPARATION/PRINTER_APPROVED/STARTED/PRINTING/PRINTED/PACKAGING/SHIPPING/DELIVERED/COMPLETED/ISSUE/CANCELLED`, `previousProductionState`, `productionRevision`. Unique partial on `{authorId}` and `{bookId}` where `activeLock:true` → **one active campaign per author and per book** |
| FundingPayment | A supporter payment | `userId`, `campaignId`, `bookId`, `idempotencyKey`≤100, `requestHash`, `provider` enum `SANDBOX/IYZICO_SANDBOX`, `providerId`, `currency='TRY'`, `amountMinor`, `donationMinor`, `orderMinor`, `quantity`, `state` enum `CREATED/PENDING/FAILED/CANCELLED/CAPTURED/REFUND_PENDING/REFUNDED`, `allocated`, `captured`, `issue`. Unique `{userId, idempotencyKey}` |
| PaymentReservation | Capacity hold | `paymentId` (unique), `campaignId`, `amountMinor`, `quantity`, `state` enum `HELD/CONSUMED/RELEASED/EXPIRED`, `expiresAt` |
| FundingPaymentEvent (append-only) | Webhook dedup | `eventId` (unique), `paymentId`, `payloadHash`, `providerState` |
| FundingLedger (append-only) | Money ledger | `key` (unique), `kind` enum `CAPTURE/ALLOCATION/REFUND/DEALLOCATION`, `amountMinor` |
| FundingRefund | Refund job | `paymentId` (unique), `amountMinor`, `reason`, `state` enum `PENDING/PROCESSING/FAILED/SUCCEEDED`, `attempts`, `leaseUntil`, `retryAt`, `providerRefundId`, `lastError` |
| PrintPreOrder | Printed copy order | `paymentId` (unique), `campaignId`, `userId`, `quantity`, `unitPriceMinor`, `totalMinor`, `state` enum `AWAITING_PAYMENT/CONFIRMED/CANCELLED/REFUND_PENDING/REFUNDED/PACKAGING/SHIPPED/DELIVERED/ISSUE`, `previousState`, `shippingAddress` (Mixed, **encrypted, select:false**), `consent`, `carrier`, `trackingNumber`, `revision` |
| CampaignSupporter | Supporter counter | unique `{campaignId, userId}`, `activePayments` |
| PrintInterest | “I’d buy a print” flag | unique `{bookId, userId}` |
| PrintAudit (append-only) | Audit trail | `actorId`, `entityId`, `action`, `from`, `to`, `reason`, `metadata` |
| CampaignUpdate (append-only) | Public campaign updates | `campaignId`, `state`, `message`≤2000 |
| PrintOutbox | Notification outbox | `key` (unique), `userId`, `campaignId`, `broadcast`, `cursor`, `title`, `message`, `state` enum `PENDING/DONE` |
| SandboxCharge | Mock payment provider record | `merchantReference` (unique), `amountMinor`, `state` enum `PENDING/FAILED/CANCELLED/CAPTURED/REFUNDED` |

## 4. Relationships (cardinality)

```text
User 1─* Book (authorId)            User *─* User (followers/following arrays)
User *─* Book (savedBooks, followedBooks, likedBy)
Book 1─* Chapter 1─* ParagraphComment
Book 1─* Comment (self-ref parentId for replies)
Book 1─* Quote 1─* QuoteComment      Quote 0..1─* Quote (originalQuoteId = repost)
User 1─0..1 Bookmark per Book        User 1─0..1 ReadingProgress per Book
User 1─0..1 PrintedBookReading per (PRINTED) Book
User 1─1 UserScore, 1─* PointEvent, *─* Badge (UserBadge)
User 1─0..1 UserPreference *─* Genre
Book *─* Genre (genreIds); Book *─1 ClassificationTerm (format, audience); *─* (tags, features, warnings)
Session 1─* SessionEntry; User 1─* Session (createdBy)
Conversation *─* User (participants); Conversation 1─* Message; Message *─0..1 Quote / Book (attachment)
FollowRequest *─1 User (requester), *─1 User (recipient)
Book 1─* BookClaim; Book 1─0..1 PrintedCatalogRecord
Book 1─* PrintApplication 1─1 FundingCampaign 1─* FundingPayment 1─0..1 {PaymentReservation, PrintPreOrder, FundingRefund}
```

## 5. Data lifecycle rules (VERIFIED from services)

- **Book soft delete** cascades to chapters, comments, quotes and pulls the book from all users’ `savedBooks/usersBooks/followedBooks`; blocked while a campaign is active/refunding/in production (`bookService.js:126-160`).
- **Account delete** (`deleteAccountCompletely`, `userService.js:222-263`): soft-deletes the user’s books (with cascade), quotes, sessions, session entries, comments, paragraph comments, quote comments, messages; removes follow edges; sets `isDeleted`, `isActive=false`. Not a hard delete.
- **Deactivated / deleted users are hidden everywhere** through `inactiveUserIds()` filters and the `users` DataLoader (`graphql/loaders.js:17`).
- **Verification codes** expire by TTL (10 min) and after 5 attempts.
- **Rate buckets** expire by TTL.
