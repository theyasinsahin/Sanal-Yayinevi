# Reader and editor compatibility

Chapters are HTML written by Quill 1.3.7 on the website. The app must read that HTML, and anything it saves must stay readable and editable on the website. Four pieces of logic were ported and are checked against output generated from the website's own JavaScript.

## How the fixtures were made

`evidence/generate_web_golden.cjs` runs the website's sanitiser configuration (DOMPurify), its page splitter and Quill 1.3.7 in Node and writes `Client/mobile/test/fixtures/web_golden.json`. `test/richtext_golden_test.dart` (95 tests) compares the Dart ports with it.

## 1. Sanitiser — `core/richtext/rich_text.dart`

Same allow-list as the website's reader: the same tags and attributes; `target`, `rel`, `width`, `height`, `style` and event attributes removed; script-capable URLs removed. The server also sanitises on save; the app sanitises again before rendering.

## 2. Paragraph index — `core/richtext/paragraphs.dart`

Bookmarks and paragraph comments store a number. On the website that number is the ordinal of the **top-level `<p>` elements**; headings, lists, quotes and images do not count and cannot carry a bookmark or comment. The app does the same (decision D-07). The live test stored a bookmark and comments by index and read them back.

**Verification pass (17 Nov 2026) — contract confirmed and kept.** The current website source was re-read: `Client/src/components/ParagraphComment/ParagraphRenderer/index.jsx` walks `doc.body.childNodes` and increments `paragraphIndex` only for `node.nodeName === 'P'`. The app's `segmentChapter` is the same rule; it was not changed. On the iPhone simulator, a chapter whose first element is an `<h1>` showed exactly five bookmark buttons for its five top-level `<p>` elements, and bookmarking the second `<p>` stored `paragraphIndex: 1` in the database (not 2, which an "every top-level element" rule would give). A paragraph comment on the same paragraph was stored with index 1. Empty paragraphs (`<p><br></p>`) and image paragraphs (`<p><img></p>`) are `<p>` and therefore carry controls, on both the website and the app. Stage 2's "every top-level element" wording is superseded by the code; existing bookmarks and comments stay attached to the same text.

## 3. Page count — `core/richtext/page_count.dart`

Exact port of `htmlPageSplitter`: 1,200 characters per page, blocks fill pages in order, an oversized block is split. The app sends `pageCount` on save like the website. Checked by fixtures and by the live test.

## 4. Quill HTML ⇄ Delta — `core/richtext/quill_html.dart`

| Content | Stored HTML |
|---|---|
| Paragraph / empty line | `<p>…</p>` / `<p><br></p>` |
| Headings 1–3 | `<h1>`–`<h3>` |
| Bold, italic, underline, strike | `<strong>`, `<em>`, `<u>`, `<s>`, nested in Quill's fixed order |
| Link | `<a href="…" rel="noopener noreferrer" target="_blank">` |
| Quote | `<blockquote>` |
| Lists | `<ol>` / `<ul>` with `<li>`; nesting as `ql-indent-n` classes |
| Image | `<p><img src="…"></p>` |
| Divider | `<hr>` |

Loading: HTML → Delta. Saving: Delta → HTML. For every fixture, HTML → Delta → HTML is identical to Quill's output.

Before a chapter is opened for editing, the app converts it and converts it back. If the result differs from the stored HTML in more than serialisation details, the chapter opens **read-only** with a warning (D-16), so website content is never rewritten in a lossy way.

The server returns void elements as `<br />` and `<img … />`; both forms are treated as equal.

## Autosave

`features/writing/chapter_autosave.dart`: debounce after typing, one request in flight, the latest content wins, a failed save keeps the "unsaved" state and retries, and leaving the editor flushes. Unit-tested (serialised saves, latest edit kept, retry after failure).

## Verified and not verified

Updated by the verification pass (simulator/emulator; details and evidence in `verification_log.md`, Batches 3–4).

| Verified (where) | Not verified |
|---|---|
| Conversions and counts against website fixtures (unit) | Pasting **rich** text copied from other apps (only plain text pasted inside the editor was tested) |
| Toolbar H1 / normal / bold / italic / bullet list + typing → autosaved HTML is exactly Quill's form (iOS, Android) | Opening an app-edited chapter in the website's Quill editor in a browser (the website stack was not started in this pass) |
| Real Android soft keyboard (Gboard) typing and Enter into the editor, autosaved (Android emulator, normal debug run) | Real iOS soft keyboard typing (simulator cannot be typed into from the host; the iOS text-input channel path was tested) |
| Undo / redo (iOS, Android) | Image insertion from the photo library inside the editor (picker not drivable; the data-URI conversion is unit-tested) |
| Copy / paste through the editor's selection toolbar (iOS double-tap, Android long-press) — fixed V-07 on iOS | Very long chapters in the **editor** (performance) |
| Website-shaped chapter (h1, h2, inline formats, link, quote, ol, ul, base64 image, empty paragraph) edited and saved without losing markup (iOS, Android) | Physical devices |
| Chapter with h4 / span / pre opens read-only and is not rewritten (iOS, Android) | |
| Opening a chapter in the editor does not rewrite it (iOS, Android) | |
| Reader: headings, inline formats, link, quote, lists, image, empty paragraph (iOS) | |
| Long-press + drag selection → "Alıntıla" → quote saved with chapter id/index; <10 characters refused; duplicate detected (iOS) | Same selection gesture on Android (runs in the Android pass) |
| Copy protection: "Kopyala" gives the website notice + link; no system Share/Look up (iOS) | |
| 60-paragraph chapter scrolls, progress bar 0 → 1 (iOS) | |

## Reading progress

Per chapter, as the server stores it: there is no scroll offset in the contract. Resume order: bookmark, then server progress, then the first chapter. Guest progress is kept locally and sent after sign-up. Reading time is reported in verified intervals; the server rejects implausible values and the app accepts that silently.
