# Reader and editor — observed behaviour

Evidence for a later native-versus-WebView decision. No recommendation is made here.

## 1. Chapter content format (what the editor produces)

The editor is Quill ("snow" toolbar). Captured from the `UpdateChapter` mutation:

| Toolbar action | HTML sent to the server |
|---|---|
| Plain paragraph | `<p>text</p>` |
| Empty line | `<p><br></p>` |
| Bold / italic / underline / strike | `<strong>`, `<em>`, `<u>`, `<s>` inside `<p>` |
| Header picker | `Normal`, `<h1>`, `<h2>` only |
| Blockquote | `<blockquote>text</blockquote>` |
| Ordered / bullet list | `<ol><li>…</li></ol>`, `<ul><li>…</li></ul>` |
| Link | `<a href="…" rel="noopener noreferrer" target="_blank">` (Quill URL tooltip) |
| Image | Native file chooser (png, gif, jpeg, bmp, ico) → `<p><img src="data:image/png;base64,…"></p>` — embedded in the chapter HTML, not uploaded |
| Clean | Removes formatting |

Typed `<b>` or `&` is stored escaped (`&lt;b&gt;`, `&amp;`); Turkish letters and emoji are stored as-is. Colour, alignment, font, size, video and code are not offered. Rich paste could not be simulated, so what paste sanitising keeps is unknown.

The mutation is `UpdateChapter{chapterId, content, pageCount}`; the client computes `pageCount`. Observed: 19,966 characters / 43 paragraphs → 20; short chapters → 1. The book's page count is the sum of all chapters, hidden ones included.

## 2. Editor screen (`/dashboard/<bookId>`)

Own layout without the site navigation (`writing/dashboard_seed_story`).

- **Sidebar:** cover thumbnail, title, "N Bölüm", SINIFLANDIRMAYI DÜZENLE, OKUYUCU MODU, PROFİLE DÖN, new-chapter field + EKLE + "Yeni bölümü gizli oluştur", chapter list (hidden ones marked "· Gizli", a delete button per row).
- **Publish bar:** state text and buttons — see `user_journeys.md` J-03.
- **Editor header:** chapter title, save badge, "⋯" menu (Okuyuculardan gizle / Okuyuculara aç, Bölümü paylaş), KAYDET.
- **Empty book:** "HOŞGELDİNİZ — Düzenlemek için bir bölüm seçin veya yeni bir bölüm oluşturun."; empty chapter placeholder "Hikayenizi buraya yazın...".
- **Mobile:** sidebar becomes a drawer opened by "Bölümler (N)".

### Saving

| Situation | Behaviour |
|---|---|
| Typing | Autosave about 1.6 s after the last keystroke; badge "KAYDEDİLDİ" |
| Cmd/Ctrl+S | No special handling |
| Switching chapter or leaving through PROFİLE DÖN with pending text | Saved immediately, then navigation; no dialog |
| Browser reload/close with pending text | Native `beforeunload` prompt |
| Offline | Badge "KAYDEDİLEMEDİ — KAYDET İLE TEKRAR DENEYİN."; after reconnecting it returned to "KAYDEDİLDİ" |
| Save refused by server | Same failure badge (seen as a non-owner) |

### Chapter management

Empty title → nothing happens. A new chapter is appended but not opened. Delete asks "Bu bölümü silmek istediğinize emin misiniz?" and shows "Bölüm silindi". Hide/show changes immediately without confirmation.

## 3. Reader screen (`/kitap/<slug>/oku`)

`reader/open_first` (desktop), `reader/reader__mobile`.

- **Sidebar (drawer on mobile):** "Kitap Detayına Dön", title, "N bölümden M tanesi okundu" with bar, chapters as "BÖLÜM n / title / words · pages" each with a read checkbox. Hidden chapters are absent for readers. Guests see "Ücretsiz üyelikle oku" on chapters after the first.
- **Top:** scroll progress bar, back arrow, "Alıntı nasıl eklenir?" help toggle, dismissible help card.
- **Body:** "Bölüm i / n", title, BÖLÜMÜ PAYLAŞ, then one block per top-level HTML element. Each block has a bookmark button and a comment button, always visible.
- **Bottom:** Önceki Bölüm / Tamamla ve Devam Et (last chapter: Tamamla; revisited chapter: Sonraki Bölüm).

The address does not change between chapters.

### Paragraph index

Each top-level element of the chapter HTML is one "paragraph" (the 20-page test chapter produced 43 blocks: paragraphs, the image paragraph, list containers). The zero-based index of that block is what bookmarks and paragraph comments store. Any other splitting rule in the mobile app would attach existing bookmarks and comments to the wrong text.

### Bookmark

`SetBookmark{bookId, chapterId, chapterIndex, paragraphIndex, chapterTitle}`. One per book: setting another moves it. The block gets an orange side line and the label "Kaldığın yer". `RemoveBookmark{bookId}` on a second tap. Survives reload.

### Paragraph comments

Tapping the comment button opens a dark inline panel under the paragraph ("Paragraf Yorumları", count, list, text area with @mention, Gönder). Send is disabled while empty; Enter inserts a newline. `AddParagraphComment{bookId, chapterId, paragraphIndex, content}`. Own comments have a delete button without confirmation. Escape or ✕ closes.

### Quotes by selection

- Under 10 characters: nothing.
- 10–1000: popup "Alıntı kaydet" with the selected text, visibility (Herkese açık / Sadece ben), note with @mention, "Sürprizbozan içeriyor", Kaydet.
- A `CheckQuoteExists` call runs first; a duplicate shows "Bu alıntı zaten kayıtlı." with a link to the profile quotes.
- `CreateQuote{visibility, text, note, bookId, chapterId, chapterTitle, chapterIndex, location{startOffset, endOffset}, isSpoiler}`. In the test the offsets were 0–40 for text starting at the beginning of the second paragraph, so they are relative to the selected text node, not the chapter.
- The help card describes the touch gesture (long-press a word, drag the handles). Touch selection was not exercised.

### Progress, completion, reading time

- "Tamamla ve Devam Et" and the checkboxes send `SaveReadingProgress{bookId, chapterId, completedChapterIds}`.
- The same state is kept in local storage (`book-progress-<user>-<book>`, version 2, with a `pending` flag). A change made offline was sent after reconnecting.
- Reopening the reader goes to the last chapter, scrolled to the top.
- `StartReadingSession{bookId, chapterId}` on opening a chapter, then `ReportReadingTime{sessionId, sequence, seconds≈15, chapterId}` every 15 s while reading. One minute produced a "+1 Puan" notification. Idle and background behaviour were not measured.
- Finishing the last chapter shows no completion screen.

### Rendering

All editor formats, the embedded image and special characters render. Links lose `target="_blank"` and are unstyled (B-07). The reading font size setting (16/18/20 px) applies to paragraphs.

### Guests

Chapter 1 is readable. Next chapter → modal "Hikâyeye devam et" (create account / sign in / go back). The composer areas are replaced by sign-in prompts, except the quote popup (B-06).

## 4. Points to settle before Stage 3

1. Whether copy protection is real (S-01).
2. What pasted rich text is reduced to.
3. Exact `pageCount` formula (read `htmlPageSplitter` again with the observed 20 for 19,966 characters).
4. Size impact of base64 images on chapter payloads over mobile networks.
5. Quote offsets when a selection spans formatted text or several paragraphs.
