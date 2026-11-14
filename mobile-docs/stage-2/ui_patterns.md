# UI patterns and visual identity — observed

Based on the screenshots in `screenshots/` (desktop 1440×900, tablet 834×1112, mobile 393×852). Exact colour values and font files were not extracted; take them from the CSS in Stage 3.

## Identity

- **Mood:** printed page. Warm off-white and ivory backgrounds, near-black text and borders, very little colour. Sections alternate between lighter and slightly darker paper tones.
- **Logo:** black "B" glyph with a small red bookmark, wordmark "BETİK" in a heavy serif with a dotted underline.
- **Typography:** two families. A serif for headings, book titles, body copy, reader text and many labels (often italic for taglines and helper text); a sans-serif for navigation, buttons, form labels and metadata, usually uppercase with letter-spacing.
- **Accent colours (sparingly):** brown/rust for radio buttons and focus, orange for the bookmark marker, green for the message badge and success panels, red for the notification badge and destructive actions, blue for dashboard info banners and the selected chapter.
- **Decoration:** thin horizontal rules with a small centred ornament, large faded step numbers, faint fox/leaf mascots in page corners.

## Components

| Component | Look and behaviour |
|---|---|
| Primary button | Solid black, white uppercase label |
| Secondary button | White with a 2 px black border, uppercase label, often an icon on the left |
| Ghost / link button | Text with arrow or underline ("Tüm Kitapları Gör →") |
| Destructive button | Outlined; red text or red border |
| Disabled button | Grey fill, used until a form is valid (comment, checkout, save) |
| Text field | Light field, thin border, uppercase label above with a red asterisk for required |
| Toggle | Pill switch inside a "settings row" (label, sub-label, control on the right) |
| Radio / checkbox | Brown accent; long consent texts sit beside checkboxes |
| Book card | Framed cover (placeholder cover drawn with "Betik" when none), page-count chip ("23S."), classification chips, uppercase serif title, "Yazar:" line, italic description, reading-time chip ("~8 DK OKUMA"), counters for views, comments, likes, share icon; optional campaign strip |
| Quote card | Large quotation marks, quote text, note in quotes, source row (book, chapter), user, relative time, three counters, share |
| Session card | Type badge, date, uppercase title, description, #tags, creator with initial avatar, participant count |
| Entry / comment | Avatar (initial or icon), name link, date, text with mention links, like counter, actions |
| Chat bubble | Own bubbles right with "···" menu; time and "Bugün" labels |
| Payment card | Amount, status, sandbox note, ids and timestamps, breakdown, action buttons |
| Stat grid (profile) | Bordered cells: Kitaplar, Takipçiler, Takip Edilenler, ⭐ Puan |
| Badges | Emoji row under the bio |
| Counters | Compact numbers with an exact value for assistive text ("0 beğeni") |
| Toast | Stack at the edge; success/error/info; closes itself after about 3 s or by its close button |
| Share dialog | Title "Paylaş", preview text, WhatsApp, Telegram, X, copy link, story image download, copy text + link |
| Guest prompt modal | Headline tied to the action, three choices: create account, sign in, go back |
| Empty state | Short sentence, sometimes an emoji and a second line ("Henüz alıntı yok / Kitap okurken beğendiğin bölümleri alıntıla!") |
| Error state | "Profil yüklenemedi … TEKRAR DENE / ANA SAYFAYA DÖN"; "Sayfa yüklenemedi … Yeniden yükle" |
| 404 | "❝404❞ Bu Sayfa Kitapta Yok" with two buttons |

## Interaction states seen

- Save badge in the editor: KAYDEDİLDİ (green outline) / failure text.
- Liked state adds a `liked` style to the heart; bookmarked paragraph gets a side line and label.
- Follow button cycles through three labels.
- Notification and message badges are numeric.
- Countdown text on the resend-code button.
- Selected tab is underlined or filled; selected chapter row is tinted.
- Loading text "Kitap yükleniyor…"; skeleton rows exist in the paragraph-comment and session lists (not captured as images).

## Dates, numbers and language

- UI language is Turkish throughout; uppercase labels rely on Turkish casing (İ/ı).
- Dates: `14.11.2026`, `14.11.2026 16:57:11`, `14 Kasım 16:04`; relative times `Az önce`, `1dk`, `15dk önce`; chat labels `16:02` + `Bugün`.
- Money: `₺4.500,00` in funding screens, `4.500,00 TL` on feed cards; percentages `%2.2`.
- Reading size: "3.169 kelime · 20 sayfa", "~8 DK OKUMA", "23S.".

## Responsive transformations

| Element | Desktop | Mobile |
|---|---|---|
| Top navigation | Inline links | Hamburger slide-out |
| Feed filters | Side column | Full-width panel above the list (fills the first screen) |
| Book grid | Multi-column | Single column |
| Reader sidebar | Fixed left column | Drawer behind "Bölümler (N)" |
| Dashboard sidebar | Fixed left column | Drawer behind "Bölümler (N)" |
| Messages | List and chat side by side | One at a time |
| Profile header | Wide card | Stacked: avatar, name, stat grid 2×2, full-width buttons |
| Footer columns | Four columns | Stacked |

No horizontal scrolling appeared on any of the 15 screens checked at mobile and tablet widths.

## Patterns that repeat and should be kept consistent

1. Back link at the top-left of every deep screen.
2. Uppercase sans labels over serif content.
3. Inline panels for secondary input instead of navigation.
4. A sandbox notice on every funding surface ("SANDBOX · Gerçek para alınmaz").
5. The hint "Birini etiketlemek için @ yaz." under every field that supports mentions.
6. Counters shown as icon + number on cards, with words in the detail view.
