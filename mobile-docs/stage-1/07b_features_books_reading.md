# 07b — Features: Book Detail, Reader, Comments, In-reader Quotes

Part of the feature inventory (index: `07_feature_inventory.md`; field key in `07a`). Static analysis only. Paths relative to `Client/src/`.

---

## E. Book detail

### F-BOOK-01 — Book detail page (digital book)
- **Entry:** `/kitap/:slug` (legacy `/book-detail/:id`), from any book card, notification or share link. **UI:** `pages/BookDetail`.
- **Shows:** cover (placeholder on error), classification summary, page count, publish date (`toLocaleDateString()`), like count, title, author link, synopsis, funding panel (07e), comments. Back link “Kitaplığa Dön” returns to the originating catalogue (`/feed` or `/printed-books`, with its query string).
- **API:** `getBookById` (detail selection), `getCommentsByBookId`, `getUserById(self)` (to know saved books and role).
- **States:** skeleton; error “Kitap açılamadı” (+ “Tekrar Dene” = full reload, “Kitaplığa Dön”); not found “Kitap bulunamadı … Basılı kitaplara dön”.
- **Rules:** a `PRINTED` book renders a different layout (`PrintedBookDetail`, 07e). `isDraft`/`isCompleted` are derived client-side from `digitalStatus`/`writingStatus` with a legacy-`status` fallback (same formula as the server's `digitalState`/`writingState`).
- **Perm:** public for published books; drafts only author/admin (server). **Resp:** SH. **Src:** `pages/BookDetail/index.jsx`, `graphql/queries/book.js`.
- **Verify:** fields actually displayed for each status; hash `#comments` scrolling.

### F-BOOK-02 — Book card interactions
- **UI:** `components/Books/BookCard`. Tap → detail (remembers catalogue return location). Shows page badge (`{n}s.`), “Popüler” badge when views > 1000, status ribbons (`FUNDING` → “Basım bilgileri”, `PUBLISHED` → “Yayımlandı”), description truncated to 120 chars (“Henüz açıklama eklenmemiş.” fallback), estimated reading time `ceil(pageCount / 3)` minutes, funding progress, compact counters (views, comments, likes), recommendation reason badge, share button (opens share dialog, 07d F-SHARE-01). Cover uses `utils/ImageUtils.getOptimizedImage(url, 300, 450)` (Cloudinary `c_fill,w_300,h_450,q_auto,f_auto` transformation; non-Cloudinary URLs unchanged) with a local placeholder.
- **Resp:** FE (all derived values are frontend-only: “Popüler” threshold, read time, truncation).

### F-BOOK-03 — Like a book
- **Entry:** heart button on detail. **Rules:** guest → registration intent `like`; optimistic toggle of state and count, rolled back on failure with toast “Beğeni işlemi başarısız”. Liked state = `book.likedBy` contains my id.
- **API:** `likeBook`. **Perm:** signed-in. **Resp:** SH (optimism FE). **Side effect:** author notification (`bookLike` setting).

### F-BOOK-04 — Save book to library
- **Entry:** bookmark icon on detail. **Rules:** guest → intent `save`; optimistic; toast “Kitaplığına eklendi” / “Kitaplıktan çıkarıldı”; rollback toast “Kaydetme işlemi başarısız”. Saved state comes from `getUserById(self).savedBooks`.
- **API:** `toggleSaveBook`. **Perm:** signed-in.

### F-BOOK-05 — Follow a book (new-chapter notifications)
- **UI:** `components/Books/BookFollowButton`. Labels “Kitabı Takip Et” / “Kitabı Takip Ediyorsun”; optimistic; guest → intent `follow`.
- **API:** `isFollowingBook`, `toggleBookFollow`. **Perm:** signed-in.

### F-BOOK-06 — Read / Support buttons
- “Kitabı Oku” → reader (`/kitap/:slug/oku`). “Destek Ol” → `/donate/:bookId` (protected; the support/checkout page, 07e).
- **Verify:** conditions under which “Destek Ol” is visible/enabled (rendering conditions were partially elided in the condensed read).

### F-BOOK-07 — Share book
- Share button visible when the book is not a draft → F-SHARE-01 (07d).

### F-BOOK-08 — Author publication controls
- **Perm:** author (some for admin). **Rules & copy:**
  - Draft + author: **“Yayınla (Görünür Yap)”** — requires ≥1 chapter with words (`chapter.wordCount > 0`), confirm dialog “Kitap herkese görünür olacak. Onaylıyor musunuz?”, calls `updateBookStatus(status:'WRITING')`. Hint when empty: “Yayınlamak için en az bir bölüme metin ekleyin.”
  - Published, not completed: **“Yazımı Tamamla”** → confirm “Kitabın yazım aşamasını bitirdiniz mi?” → `status:'COMPLETED'`.
  - Published: **“Taslağa Çek”** → confirm → `status:'DRAFT'` (server refuses during active campaign/production).
  - Completed: **“Destek Fonu İçin Başvur / Başvurumu Gör”** → `/print/:bookId`.
  - **“Yazmaya Devam Et”** → `/dashboard/:bookId` (author only).
  - **“Sil”** (author or admin) → `window.confirm("Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?")` → `deleteBook` → navigate to `/profile`. **Destructive (soft delete + cascade).**
- **API:** `updateBookStatus`, `deleteBook`. **Resp:** SH (state machine enforced BE: `Server/src/services/print/applicationService.js:11-42`).
- **Verify:** all transitions, error toasts, points award on first publish.

### F-BOOK-09 — Edit classification inline
- **UI:** `components/Books/Classification/ClassificationEditor` (author/admin) on the detail page. **API:** `getClassificationOptions`, `searchClassificationTags`, `updateBookClassification`. Details of the fields → 07c F-WRITE-02.

## F. Book comments

### F-COMM-01 — List comments with one-level replies
- **UI:** `components/Comments/CommentList`, `CommentItem`. The server returns a flat list; the **client groups by `parentId`** and sorts roots newest first. Empty: “Henüz yorum yapılmamış. İlk yorumu sen yap!”. Each comment: avatar, username link, date (`tr-TR`), text with clickable `@mentions` (`components/Mentions/MentionText`), like, reply; deep-link anchor `#comment-<id>` scrolls to and focuses the comment.
- **API:** `getCommentsByBookId`. **Resp:** SH (threading is FE).

### F-COMM-02 — Add comment
- Textarea with mention autocomplete (F-COMM-06) + “Gönder”. Guest → intent `comment` carrying the draft (restored after sign-in). Empty text ignored. Success toast “Yorum gönderildi”, list refetched.
- **API:** `createComment`. **Side effects:** +5 points, mention + author notifications.

### F-COMM-03 — Reply to comment
- “Yanıtla” opens an input pre-filled with `@username `; submit disabled while empty or equal to the bare mention. Replies to replies attach to the root (server). Guest → intent `reply` with draft.
- **API:** `replyToComment`.

### F-COMM-04 — Like comment
- Optimistic toggle with count; guest → intent `comment-like`. **API:** `toggleCommentLike`.

### F-COMM-05 — Delete own comment
- Trash icon only on own comments; `window.confirm("Silmek istediğinize emin misiniz?")`; refetch. Server also soft-deletes replies. **API:** `deleteComment`. **Destructive.**

### F-COMM-06 — `@mention` autocomplete (shared component)
- **UI:** `components/Mentions/MentionInput` — used in book comments, replies, paragraph comments, quote notes, quote comments, session entries (07c/07d).
- **Rules:** typing `@` followed by up to 50 username chars opens a list (debounce 200 ms) of up to 8 users (“Herkese açık hesaplar ve takipçilerin”); arrow keys/Enter/Tab select, Escape dismisses; selection inserts `@username ` at the caret. Hint text “Birini etiketlemek için @ yaz.”
- **API:** `searchMentionUsers`. **Perm:** signed-in (query throws for guests). **Resp:** SH (token detection regex is FE and mirrors the server's `mentionedUsernames`).
- **Verify:** behaviour for guests typing `@`.

## G. Reader

### F-READ-01 — Open reader and resume position
- **Entry:** `/kitap/:slug/oku`, `/kitap/:slug/bolum/:chapterSlug`, legacy `/book-reader/:bookId?chapter=<id>&paragraph=<n>`. **UI:** `pages/BookReader`.
- **Rules (FE algorithm `utils/readerProgress.js` → must be re-implemented):** starting chapter is chosen by priority **link-requested chapter → server bookmark → saved progress (local or server, whichever is `pending` or newer) → first readable chapter**. When resuming from bookmark/progress all earlier chapters are marked completed. A bookmark also restores the paragraph scroll position. If a shared chapter no longer exists: “Paylaşılan bölüm bulunamadı…”.
- **API:** `getBookById` (reader selection: chapters without content), `getReadingChapter` (content of the current chapter only), `getBookmark`, `getReadingProgress`.
- **States:** “Kitabınız hazırlanıyor...”, “Kitap yüklenemedi. Tekrar dene”, “Bölüm yüklenemedi. Tekrar dene”.
- **Perm:** public for readable chapters. **Resp:** SH.

### F-READ-02 — Chapter list / table of contents
- Sidebar (drawer below 1100 px, with focus trap and Escape) listing “Bölüm N”, title, length label (`{words} kelime · {pages} sayfa` or “Uzunluk bilgisi hazırlanıyor”), tags “Okuyuculara kapalı” (hidden, visible to author/admin) and “Ücretsiz üyelikle oku” (registration required). Header: “{total} bölümden {done} tanesi okundu” + progress bar. “Kitap Detayına Dön”.
- Tapping a registration-gated chapter opens the registration prompt instead of navigating.

### F-READ-03 — Chapter navigation and completion
- “Önceki Bölüm” / primary button whose label depends on state: `Tamamla ve Devam Et`, `Sonraki Bölüm`, `Tamamla`, `✦ Tamamlandı`, `Ücretsiz üyelikle oku`, `Okuyuculara kapalı`. Advancing marks the current chapter completed. Per-chapter check boxes toggle completion manually. End marker “✦ SON ✦”. Top bar shows scroll progress within the chapter; scroll resets on chapter change.
- **State:** completed set + current chapter → F-READ-04.

### F-READ-04 — Reading-progress sync (offline tolerant)
- **Rules (FE, `hooks/useReaderProgress.js`):** every change is written immediately to local storage (`book-progress-<userId|guest>-<bookId>`, `{version:2,lastChapterId,completedChapterIds,pending,updatedAt}`), then debounced 250 ms to the server via `saveReadingProgress`; flushed on leaving the page (web uses `fetch(..., {keepalive:true})`); retried when the device comes back online; banner “Okuma ilerlemesi eşitlenemedi. Bu cihazdaki kayıt korunuyor. Tekrar dene”. Guests keep local progress only; after sign-up the guest record for the intent's book is migrated (F-AUTH-10).
- **API:** `getReadingProgress`, `saveReadingProgress` (`markChapterAsRead` is defined but the reader uses `saveReadingProgress`).
- **Resp:** SH + BR (localStorage, `pagehide`, `online`). **Mobile note:** replace with local DB + app-lifecycle flush.
- **Verify:** conflict resolution between devices; behaviour offline.

### F-READ-05 — Verified reading-time tracking → points
- **Rules (FE, `utils/readingTracker.js`, `hooks/useReadingTracker.js`; BE `Server/src/services/readingService.js`):** active only for signed-in users on a readable, non-draft chapter with text. The client starts a server session (`startReadingSession`), accumulates **visible, active** time in 1-second ticks (activity = scroll/click/touch/key within the last 120 s; ticks longer than 2 s are discarded), and reports it every 15 s in chunks of ≤60 s with a strictly increasing `sequence`. The server grants **1 point per accumulated 60 s** and rejects reports that exceed real elapsed time. After 90 s without interaction a banner warns (“⏸️ Hareketsiz görünüyorsun…”, “Devam Et”); tracking pauses at 120 s. Opening the reader elsewhere replaces the session (“Okuma puanı takibi diğer açık okuyucuya geçti…”). Unsent time is persisted locally and replayed within 120 s.
- **API:** `startReadingSession`, `reportReadingTime`. **Perm:** signed-in. **Resp:** SH (anti-cheat BE; timing FE) + BR (visibility events).
- **Verify:** point accrual rate; replaced/expired session handling; background/foreground transitions.

### F-READ-06 — Bookmark (“ayraç”) on a paragraph
- Each paragraph has a bookmark toggle (“Ayraç koy” / “Ayracı kaldır”); the bookmarked paragraph shows “Kaldığın yer”. One bookmark per book. Guest → intent `bookmark` (after sign-in: “Ayracı kaydetmeye hazırsın. Ayracı buraya kaydet”). Errors: “Ayraç kaydedilemedi/kaldırılamadı. Lütfen tekrar deneyin.”
- **API:** `getBookmark`, `setBookmark`, `removeBookmark`. **Resp:** SH.
- **Critical FE rule:** `paragraphIndex` counts **top-level `<p>` elements of the sanitised chapter HTML in document order, starting at 0** (`ParagraphRenderer` `segments`). Flutter must compute identical indices or bookmarks and paragraph comments will point at different paragraphs than on the web.

### F-READ-07 — Paragraph comments
- Per-paragraph comment button with count badge; opens an inline panel listing comments oldest first (avatar, `@user`, relative time, text with mentions, delete on own), input with mention autocomplete, Ctrl/Cmd+Enter submits, “Gönder”. Empty: “Henüz yorum yok. İlk yorumu sen yap!”. Link param `paragraph=<n>` opens the panel automatically; anchor `#paragraph-comment-<id>` focuses a comment. Guest → intent `paragraph-comment` with draft.
- **API:** `getParagraphCommentCounts`, `getParagraphComments`, `addParagraphComment`, `deleteParagraphComment` (no confirmation; hard delete). `toggleParagraphCommentLike` is defined in `graphql/mutations/paragraphComment.js` but **no like control is rendered in the panel** (VERIFIED in the panel source; verify at runtime).
- **Verify:** `createdAt` format (client expects epoch-ms string).

### F-READ-08 — Create a quote by selecting text
- **UI:** `components/Quote/QuotePopup`. Selecting 10–1000 characters inside the chapter text opens a popup (after 350 ms on touch): shows the selection, visibility selector (Public / “Sadece ben”), optional note (mentions), “Sürprizbozan içeriyor” checkbox. The client first calls `checkQuoteExists`:
  - not existing → **Kaydet** → `createQuote`;
  - existing public quote by someone else → shows “@user tarafından paylaşılmış” and the button becomes **Yeniden paylaş** → `repostQuote` (or choose private to save own copy);
  - already mine / already reposted → “Bu alıntı zaten kayıtlı. Profilimdeki alıntılar”.
  - >1000 chars → “En fazla 1000 karakter seçebilirsiniz. Seçimi kısaltın.”
- Success “Alıntı kaydedildi!” / “Özel alıntı kaydedildi!”, auto-close after 1.2 s. Collapsible help box “Alıntı nasıl eklenir?”. Guest → intent `quote` preserving the selection and draft.
- **API:** `checkQuoteExists`, `createQuote`, `repostQuote`. **Resp:** SH + BR (DOM Selection API, visualViewport positioning).
- **Sent metadata:** `chapterId`, `chapterTitle`, `chapterIndex`, `location{startOffset,endOffset}` (DOM range offsets — browser-specific meaning; the server only stores them).
- **Mobile note:** needs a native text-selection toolbar action; popup geometry need not be copied.
- **Verify:** duplicate detection (`QUOTE_EXISTS:` error string is masked in production — see risks).

### F-READ-09 — Copy protection
- Copying selected reader text replaces the clipboard with “Kitap: <title> / Link: <url> / * … telif hakları gereği sınırlandırılmıştır…”. **Resp:** FE + BR (`copy` event). **Mobile note:** native equivalent = disable “Copy” in the selection menu or substitute the same text; product decision needed (documented in `10_mobile_compatibility.md`).

### F-READ-10 — Registration gate and hidden chapters
- Guests can read only the first open chapter when the server gate is on: other chapters arrive with `accessStatus: REGISTRATION_REQUIRED` and empty content; the reader shows a registration card with “İlk açık bölümü oku” and “Kitap detayına dön”. `HIDDEN` chapters show a notice (`HiddenChapterNotice`); `UNAVAILABLE` → “Bu bölüm artık erişilebilir değil…”.
- **Resp:** BE decides, FE renders. **Verify:** gate flag value in the Stage 2 environment (`REGISTRATION_GATE_ENABLED`).

### F-READ-11 — View counting
- The reader calls `incrementBookViews` once per reader mount. **Resp:** SH (no server de-duplication). **Verify:** count behaviour on re-open.

### F-READ-12 — Share chapter
- “Bölümü paylaş” on non-hidden chapters → F-SHARE-01 with type `CHAPTER`.

### F-READ-13 — Chapter HTML rendering
- Chapter content is HTML produced by the Quill editor and sanitised on both sides to the same allow-list: tags `p br div span strong b em i u s strike blockquote h1–h4 ol ul li pre code a img sub sup hr`; Quill classes `ql-align-*`, `ql-indent-1..8`, `ql-size-small|large|huge`, `ql-font-serif|monospace`, `ql-direction-rtl`, `ql-syntax`; inline styles `color`, `background-color`, `text-align`, `font-size` (server allow-list; client strips `style`); images as `http(s)` or `data:image/(png|jpeg|webp)` ≤450k base64 chars.
- **Resp:** SH. **Src:** `utils/richText.js`, `Server/src/security/richText.js`.
- **Mobile note:** Flutter needs an HTML renderer that honours these Quill classes and exposes per-paragraph widgets (for F-READ-06/07) and text selection (F-READ-08).
- `utils/htmlPageSplitter` (1200 chars per page) exists; whether it is still used by any screen is **UNKNOWN** (not referenced by the reader page read above) — see coverage notes.
