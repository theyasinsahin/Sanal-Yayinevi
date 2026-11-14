# 07c — Features: Authoring (Create Book, Writing Dashboard) and Writing Sessions

Part of the feature inventory (index: `07_feature_inventory.md`; field key in `07a`). Static analysis only. Paths relative to `Client/src/`.

---

## H. Authoring

### F-WRITE-01 — Create a new book (draft)
- **Entry:** “Kitap Oluştur” in nav → `/create-book` (protected). **UI:** `pages/CreateBookPage`.
- **Inputs:** cover image (required), title (required), classification (F-WRITE-02), description (required).
- **Validation (FE):** “Kitap başlığı zorunludur.”, “Açıklama zorunludur.”, “Kapak resmi yüklemek zorunludur.”, classification errors. An error summary lists each problem as a button that scrolls to and focuses the field (order: cover, title, classification, description). No client length limits. Server: classification validation; Mongoose `title` required.
- **API:** `createBook` → new book in `DRAFT`. **OK:** navigate to `/dashboard/<newId>`. **Fail:** server message in an alert.
- **Perm:** signed-in. **Resp:** SH + EXT (cover upload to Cloudinary, F-WRITE-03).
- **Verify:** behaviour when image upload is disabled (env without Cloudinary) — the form requires a cover, so creation would be blocked (**INFERRED**).

### F-WRITE-02 — Work classification fields
- **UI:** `components/Books/Classification/ClassificationFields` (used in create book, classification editor on detail/dashboard, printed-book submission).
- **Inputs & rules:**
  - **Eser biçimi** (format) — single select, required (“Bir eser biçimi seçin.”).
  - **Tür ve konular** — 1 to 3 genres (“En az 1, en fazla 3 tür/konu seçin.”), searchable, grouped `FICTION` “Kurgu ve Hikâyeler” / `KNOWLEDGE` “Bilgi ve Düşünce”; further checkboxes disable at 3.
  - **Etiketler** — up to 8 free-text tags, 2–50 chars, pattern `^[\p{L}\p{N}\p{M} '#+.-]+$`, case/space-insensitive duplicate check (Turkish locale); autocomplete from `searchClassificationTags` after 2 chars (250 ms debounce); Enter adds.
  - **Anlatım özellikleri** (narrative features) — optional multi-select.
  - **Hedef okur kitlesi** (audience) — optional single select.
  - **İçerik uyarıları** (content warnings) — optional multi-select.
  - Previously selected but now inactive terms are shown as “(pasif; kaldırın / yeniden seçin)”.
- **API:** `getClassificationOptions`, `searchClassificationTags`, `updateBookClassification` (editor: “Sınıflandırmayı düzenle” → “Sınıflandırmayı kaydet” / “İptal”).
- **Resp:** SH (same limits enforced in `Server/src/services/classificationService.js`; server additionally limits new-tag creation to 50 per user per 24 h).

### F-WRITE-03 — Image upload (covers, session covers, avatars)
- **UI:** `components/ImageUpload`. **Rules (all FE):** accepted types JPEG/PNG/WebP, ≤8 MB (“JPEG, PNG veya WebP biçiminde, en fazla 8 MB bir görsel seçin.”); reject >40 MP or any side >12,000 px; **centre-crop** to the target aspect ratio (book cover 2:3; session cover 16:9 max width 1600) on a canvas; re-encode JPEG quality 0.92; upload with an **unsigned Cloudinary preset** (`POST https://api.cloudinary.com/v1_1/<cloud>/image/upload`, multipart `file` + `upload_preset`); the returned `secure_url` is what gets stored in the backend. Disabled when Cloudinary is not configured.
- **Resp:** FE + EXT (Cloudinary) + BR (canvas, File API). The backend never receives image bytes for covers. **Src:** `components/ImageUpload/index.jsx`, `config/integrations.js`.
- **Mobile note:** use image picker + native crop + direct Cloudinary upload with the same cloud name / preset; needs camera/photo-library permissions.
- **Verify:** profile-picture path (uses `react-easy-crop`/`utils/cropImage.js` — see 07d F-PROF-07).

### F-WRITE-04 — Writing dashboard: chapter list and management
- **Entry:** `/dashboard/:bookId` (protected; “Yazmaya Devam Et”). **UI:** `pages/BookDashboard`.
- **Shows:** sidebar (drawer on small screens) with cover, title, chapter count, classification editor, “Okuyucu Modu” (opens reader), “Profile Dön”, new-chapter input + “Ekle” (Enter submits) + checkbox “Yeni bölümü gizli oluştur”, chapter list with “· Gizli” marker and per-chapter delete.
- **Rules:** every action first flushes pending autosaves (`runAfterSaving`); while an action runs the editor is read-only. Add chapter creates an empty chapter (`content:''`). Delete asks `window.confirm('Bu bölümü silmek istediğinize emin misiniz?')` → toast “Bölüm silindi”. Printed books without `canEditContent` show “Bu kitaba içerik eklemek için yazar hak talebinizin onaylanması gerekir.”
- **API:** `getBookById` (with chapter content), `createChapter`, `deleteChapter`, `updateChapter(isHidden)`.
- **Perm:** author (admin allowed by server). **Resp:** SH. **Note:** there is **no chapter rename and no chapter reordering** in the UI (order = creation time); verify in Stage 2.
- **Verify:** what a non-author sees when opening the URL (page has no explicit owner check; server rejects mutations).

### F-WRITE-05 — Rich-text chapter editor with autosave
- **UI:** `react-quill` (Quill “snow” theme). Toolbar: header 1/2/normal; bold, italic, underline, strike, blockquote; ordered/bullet list; link, image; clean. Placeholder “Hikayenizi buraya yazın...”.
- **Autosave rules (FE, `utils/chapterAutosave.js`):** save 1.5 s after the last keystroke, and at the latest 10 s after the first unsaved change; saves are serialized per chapter; a failed save marks the chapter “uncertain” and stops automatic retries until the user presses **Kaydet**; pending edits survive chapter switching and book refetches; flush on tab hidden, on `online`, and before leaving. Status badge: `Kaydedildi` / `Kaydediliyor…` / `Otomatik kayıt bekleniyor…` / `Kaydedilemedi — Kaydet ile tekrar deneyin.` Manual **Kaydet** → toast “Kaydedildi!”.
- **Leaving with unsaved changes:** in-app navigation is blocked until the flush completes; if it fails → confirm “Değişiklikler kaydedilemedi. Kaydetmeden ayrılmak istiyor musunuz?”. Browser unload shows the native prompt.
- **Page count rule (FE!):** on every save the client computes `pageCount = parseContentToPages(html, title).length` using `utils/htmlPageSplitter` (**1200 text characters per page**, splitting between top-level blocks and, for oversized blocks, between words) and sends it with `updateChapter`. The server sums chapter `pageCount`s into `Book.pageCount`. **Flutter must reproduce this algorithm** or books edited on mobile will report different page counts (which feed read-time estimates and printed-quote page validation).
- **API:** `updateChapter(chapterId, content, pageCount)`. Server re-sanitises HTML and recomputes `wordCount`; weekly writing words are tracked server-side.
- **Images in content:** Quill's default image button embeds the picture as a **base64 `data:` URI inside the HTML** (**INFERRED** from the default Quill toolbar with no custom image handler in the page; the Cloudinary preset name `quill_preset` suggests an earlier/other upload path — verify in Stage 2). Server limit: `data:image/(png|jpeg|webp)` ≤450,000 base64 chars per image, whole request ≤2 MB, chapter ≤500,000 chars.
- **Resp:** SH + BR. **Mobile note:** needs a rich-text editor producing Quill-compatible HTML (e.g. a Quill-delta based editor with HTML export) — see `10_mobile_compatibility.md`.
- **Verify:** exact HTML produced for each toolbar format; image embedding path; autosave under flaky network.

### F-WRITE-06 — Hide / show chapter
- “⋯ Bölüm işlemleri” menu → “Okuyuculardan gizle” / “Okuyuculara aç”. Hidden chapters are invisible to readers (and their quotes/comments are blanked server-side).
- **API:** `updateChapter(isHidden)`.

### F-WRITE-07 — Share chapter from the dashboard
- In the same menu for non-draft books and non-hidden chapters: “Bölümü paylaş” (flushes autosave first) → F-SHARE-01.

### F-WRITE-08 — Publication status panel in the dashboard
- Same state machine as F-BOOK-08 with a status headline (`Taslak` / `Yayında` / `Yazım tamamlandı`): “Yayınla (Görünür Yap)” ↔ “Taslağa Çek”, “Yazımı Tamamla”, “Destek Fonu İçin Başvur / Başvurumu Gör”. Publish disabled until some chapter has text (`utils/chapterContent.hasChapterContent`).
- **API:** `updateBookStatus`.

---

## I. Writing sessions (“Yazı Oturumları”)

A session is a themed public or restricted thread where members post short texts (“yazı”/“ileti”).

### F-SESS-01 — Sessions list
- **Entry:** `/sessions`. **UI:** `pages/SessionsPage`, `SessionCard`.
- **Shows:** cover, type badge (`Herkese Açık` / `Takipçilere Özel` / `Özel`), “Kapalı” badge, date, title, description, `#tags`, creator, participant count; share button on open active sessions.
- **Rules:** paginated by `limit/offset` (“Daha Fazla”); the search box filters **only the already loaded sessions client-side** (title, description, tags; case-insensitive) — there is no server search.
- **API:** `getSessions` (hook `useGetSessions`, `hooks/useSessions.js`). **States:** skeletons; “Oturumlar yüklenemedi.”; “Henüz oturum yok — İlk oturumu sen aç!” / “Aramanıza uygun oturum bulunamadı.”
- **Perm:** public. **Resp:** SH (search FE).

### F-SESS-02 — Request permission to create sessions
- **UI:** `components/Sessions/SessionAccessRequest`, `hooks/useSessionCreationAccess.js`.
- **Rules:** guests: “Oturum oluşturma iznine ücretsiz başvurabilirsiniz. — Başvurmak için giriş yapın”. Members: status is polled every 30 s and on focus. `NONE` → form “Nasıl oturumlar düzenlemek istiyorsunuz?” (10–1000 chars) → “Oturum açma izni iste”; `PENDING` → waiting message + “Durumu yenile”; `REJECTED` → shows the admin's `reviewNote` and allows “Yeniden izin iste”; `APPROVED` → the “+ Oturum Aç” button appears.
- **API:** `mySessionCreationAccess`, `requestSessionCreationAccess`. **Perm:** signed-in. **Resp:** SH. Admin side → 07f.

### F-SESS-03 — Create session
- **UI:** `CreateSessionModal`. **Inputs:** optional cover (16:9 Cloudinary upload, removable), title (required: “Başlık zorunludur.”), description (mentions allowed), type (3 buttons), access code (only for `Özel`, ≥4 chars: “Erişim kodu en az 4 karakter olmalıdır.”), tags (Enter/“Ekle”, removable chips).
- **API:** `createSession`. **Fail:** server message in the modal. **Perm:** approved members. Server limits: title ≤150, description ≤500, cover must be a Cloudinary URL.

### F-SESS-04 — Session detail and entry feed
- **Entry:** `/oturum/:slug` (legacy `/sessions/:id`). **UI:** `pages/SessionDetail`.
- **Shows:** back link, cover, badges, tags, title, description (with mentions), creator, “N katılımcı · N yazı”, composer, entries **newest first** (server returns oldest first; the client reverses), “Diğer iletileri yükle” pagination (30 per page).
- **Access:** `FOLLOWERS_ONLY` sessions error for non-followers → “Bu oturuma erişim yetkiniz yok.” + “Geri Dön”. Missing → “Oturum bulunamadı.”
- **API:** `getSession`, `getSessionEntries`. **Perm:** per session type (server). **Resp:** SH.

### F-SESS-05 — Private session access-code gate
- For `PRIVATE` sessions the page shows a lock screen (“Özel Oturum … erişim kodu gereklidir.”) with a password field; `verifySessionAccessCode` must return true, then the code is kept **in memory only** for the visit and sent with every entries/like/add/subscription call. Wrong code → “Erişim kodu hatalı.”; a later code-related error resets the gate.
- **Rules:** the gate is shown even to the creator on the web page (`session.type === 'PRIVATE' && !accessCode`), although `canReadEntries` would allow the creator — **verify in Stage 2**. Server rate limit: 10 attempts / 15 min per IP and per user.
- **API:** `verifySessionAccessCode`. **Resp:** SH.

### F-SESS-06 — Post an entry
- Composer (auto-growing textarea up to 320 px, mentions, Ctrl/Cmd+Enter, “Paylaş”), disabled for guests and hidden when the session is closed (“Bu oturum kapatılmıştır. Yeni yazı eklenemez.”). Max 5000 chars (server).
- **API:** `addSessionEntry`. **Side effects (BE):** +5 points, participant count, `SESSION_MENTION`/`SESSION_REPLY` notifications to creator and previous participants, real-time event.

### F-SESS-07 — Live updates
- New entries from other users appear without refresh through the `onNewSessionEntry` subscription (hook `useNewSessionEntrySubscription`). **Resp:** BE push + FE cache merge. **Verify:** de-duplication with own posts; reconnect behaviour.

### F-SESS-08 — Like an entry
- Heart button with count; guests get the toast “Beğenmek için giriş yapmalısınız.” (no registration modal here). **API:** `toggleSessionEntryLike`.

### F-SESS-09 — Delete own entry
- “···” menu on own entries → “Yazıyı Sil” (no confirmation) → toast “Yazı silindi.” **API:** `deleteSessionEntry`. **Destructive.**

### F-SESS-10 — Close session
- Creator only, active sessions: “Oturumu Kapat” → `window.confirm('Oturumu kapatmak istediğinize emin misiniz?')` → navigate to `/sessions`. No reopen. **API:** `closeSession`. **Destructive (irreversible).**

### F-SESS-11 — Edit session cover
- Creator or admin: “Kapak fotoğrafını düzenle” → upload/remove → “Kapağı kaydet”. **API:** `updateSessionCover`.

### F-SESS-12 — Deep link to an entry
- `#entry-<id>` (from notifications): the entry is fetched individually (`getSessionEntry`) if not in the loaded page, appended, scrolled to and focused; otherwise “Etiketlendiğiniz ileti bulunamadı veya artık erişilebilir değil.”

### F-SESS-13 — Share session
- Open + active sessions only → F-SHARE-01 with type `SESSION`.
