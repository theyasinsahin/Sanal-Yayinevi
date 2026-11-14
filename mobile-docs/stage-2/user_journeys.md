# User journeys exercised

All journeys ran in the sandbox with real browser interaction. Screenshot names are under `screenshots/`. Field-level detail is in `domains/observations_by_domain.md`.

## J-01 Register → verify → profile

- **Precondition:** guest. **Entry:** `/register`.
- **Steps:** fill name, username, e-mail, password (meter turns Güçlü), tick terms → "Doğrulama Kodu Gönder" → step "E-postanı Doğrula" (60 s resend countdown, "Bilgileri Düzenle") → enter the 6-digit code from the mail → "Kayıt İşlemini Tamamla".
- **Success:** signed in, lands on `/profile`.
- **Failure:** empty fields stop at native validation; unticked terms blocks; a wrong code keeps the user on step 2.
- **Shots:** `auth/register_password_meter`, `auth/register_code_step`, `auth/after_register`.

## J-02 Forgot → reset → sign in

- **Entry:** `/sifremi-unuttum`. Any e-mail gives the same confirmation. The mailed link opens `/reset-password/<token>`; two password fields with meter.
- **Success:** "Şifreniz güncellendi! Giriş sayfasına yönlendiriliyorsunuz..."; older sessions are signed out on their next request.
- **Failure:** invalid or reused link → "Geçersiz veya süresi dolmuş bağlantı."
- **Shots:** `auth/forgot_sent`, `auth/reset_done`.

## J-03 Create → write → publish → complete (author)

1. `/create-book`: cover, title, format, 1–3 genres, description → "TASLAK OLARAK KAYDET" → `/dashboard/<id>` ("HOŞGELDİNİZ").
2. Add a chapter, select it, write; autosave.
3. Publish bar: draft without text — button disabled, "Yayınlamak için en az bir bölüme metin ekleyin." → with text "Yayınla (Görünür Yap)" + confirm → "Kitabınız okuyuculara açık" (Taslağa Çek / Yazımı Tamamla) → confirm → "Kitabınızın yazımı tamamlandı" (Taslağa Çek / Destek Fonu İçin Başvur).
4. Book appears on the feed, the author's profile and the authors directory.
- **Reverse:** "Taslağa Çek" + confirm hides the book (guests get 404); it can be published again.
- **Shots:** `writing/create_book_validation`, `writing/create_book_filled`, `writing/after_publish`, `writing/after_complete`.

## J-04 Discover → read → interact (reader) → author is notified

1. Feed or landing → book card → detail.
2. Like, save, follow book; comment with @mention.
3. "KİTABI OKU" → reader: bookmark, paragraph comment, quote, complete chapters.
4. Author: bell badge rises within ~15 s; panel lists the mention and like; tapping the mention opens the book at that comment; author replies; reader gets "yorum yanıtında etiketlendin".
- **Shots:** `books/detail_after_interactions`, `comments/mention_autocomplete`, `reader/quote_popup`, `notifications/panel_author`, `comments/thread_with_reply`.

## J-05 Guest reading gate

Guest opens a book → reads chapter 1 → "Tamamla ve Devam Et" → modal "Hikâyeye devam et" with create-account / sign-in / back. Like on the detail page gives the "Beğenini paylaş" modal. **Shots:** `reader/guest_gate_after_next`, `auth/guest_action_prompt`.

## J-06 Follow request

Reader on author's profile: "TAKİP İSTEĞİ GÖNDER" → "İSTEĞİ GERİ ÇEK". Author: badge, panel "Takip İstekleri (1)" → "KABUL ET". Reader's button becomes "TAKİBİ BIRAK" without reload; both receive notifications; counters update. **Shots:** `notifications/follow_request_in_panel`, `profile/followers_modal`.

## J-07 Direct message

Profile → "MESAJ GÖNDER" → `/messages/<id>` → type, Enter. With both chats open the message appears instantly on the other side and is marked read. Own bubble "···" → Sil. **Shots:** `messaging/chat_opened_from_profile`, `messaging/chat_reader`, `messaging/bubble_menu`.

## J-08 Writing session

1. Author on `/sessions`: reason → "OTURUM AÇMA İZNİ İSTE" → pending.
2. Admin `/admin/session-access` → "ONAYLA".
3. Author: "+ OTURUM AÇ" → title, description, type, tags → session card.
4. Detail: post entries (button or Ctrl+Enter); other viewers see them instantly; like; delete own.
5. Private session: visitor enters the access code. Followers-only: listed for all, opens for followers.
6. Owner: "OTURUMU KAPAT" + confirm → session leaves the list.
- **Shots:** `sessions/access_requested`, `admin/session_access_queue`, `sessions/create_modal`, `sessions/detail_reader_entries`, `sessions/private_gate`, `sessions/closed`.

## J-09 Quotes

Quote created in the reader → appears on `/quotes` and under the profile's ALINTILAR tab (grouped by book) → another user likes, reposts with a comment, comments → owner notified → detail page and share dialog. **Shots:** `quotes/feed_one_quote`, `quotes/card_comments`, `quotes/detail`.

## J-10 Privacy

Reader sets profile private, hides library and follow lists, closes messages → Kaydet. A non-follower then sees "Bu profil yalnızca takipçilere açık…", "Gizli" counters, a disabled message button, and cannot @mention the user. Reverted afterwards. **Shot:** `profile/private_profile_as_non_follower`.

## J-11 Account changes and closure (disposable user)

Change e-mail (password check, info mail, signed out) → sign in with new e-mail → change password (signed out) → deactivate (inline confirm; profile becomes 404 for others) → sign in reactivates → delete (type "hesabımı sil") → sign-in refused. **Shots:** `settings/overview`, `settings/deactivate_confirm`, `settings/delete_confirm`.

## J-12 Printed book: submit → approve → use → claim

Member submits a printed book → admin approves → member gets "Kitabın kataloğa eklendi" → detail: rate and review, comment, add a quote with page number → shelf on profile → another member files an author claim → admin approves → claimant sees "Bölüm ekle / düzenle" and the book on their profile. **Shots:** `printed/submit_form`, `admin/printed_review`, `printed/detail_with_review_quote`, `profile/printed_shelf`, `printed/my_submissions`.

## J-13 Print funding (mock sandbox)

1. Author (completed book): `/print/<id>` → specification, cover PDF, declarations → save (frozen version) → "BAŞVURUYU İNCELEMEYE GÖNDER".
2. Admin: decision "Onayla" with quote reference, confirmed pages, two PDFs, cost and unit-price fields → then "ONAYLI SANDBOX KAMPANYASINI AÇ".
3. Campaign card appears on book detail, feed card, checkout and publisher portal.
4. Supporter: `/donate/<id>` → donation and/or copies (+ address) → "TEST ÖDEME REZERVASYONU OLUŞTUR" → simulate success / failure / cancel.
5. `/funding-history` lists every payment with its state.
6. Admin: "TAM İADE İSTE" → maintenance run → supporter sees "İade edildi".
- **Shots:** `funding/print_application_saved`, `admin/print_application_approve_form`, `admin/print_funding_campaigns`, `funding/checkout`, `funding/payment_success`, `funding/history_after_refund`.

## J-14 Admin moderation

`/admin/data/Comment` → "İNCELE / DÜZENLE" → tick "Yayından kaldırılmış", give a reason → saved; the comment disappears from the site; unticking restores it; both actions are in the audit list. **Shots:** `admin/data_comments`, `admin/record_editor`.

## J-15 Community forms

Contact form → mail to the configured address. Footer newsletter → confirmation mail → `/newsletter?token…` → "ABONELİĞİMİ DOĞRULA". **Shots:** `community/contact_sent`, `community/newsletter_manage`.

## State that persists across navigation and reload

| State | Where | Observed |
|---|---|---|
| Sign-in | local storage (`token`, `user`, `userId`) | Survives reload; cleared on logout, invalid token, password/e-mail change |
| Reading progress | server + local storage | Survives reload and offline |
| Bookmark | server | Survives reload |
| Reading font size | local storage `app_font_size` | Device-only |
| Feed tab | URL `?tab=for-you` | Filters and search are not in the URL and reset on reload |
| Unsent editor text | memory until autosave | Flushed on in-app navigation; browser prompt on reload |
| Checkout cart | memory | A pending reservation is not shown again on `/donate`, only in history |
