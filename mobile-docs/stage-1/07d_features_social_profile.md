# 07d — Features: Profile, Settings, Follow, Quotes, Messaging, Sharing, Leaderboard

Part of the feature inventory (index: `07_feature_inventory.md`; field key in `07a`). Static analysis only. Paths relative to `Client/src/`.

---

## J. Profile

### F-PROF-01 — View a profile (own or other)
- **Entry:** `/profile` (own, protected), `/yazar/:username` (legacy `/user/:userId`), any author/user link. **UI:** `pages/UserProfilePage`.
- **Shows:** avatar, “Doğrulanmış” badge (`isVerified`), full name, `@username`, bio, badge emojis with tooltip `name: description`, own e-mail (self only), counters — books (self: all, others: non-draft), followers, following (“Gizli” when the follow list is private), ⭐ total points, total views and likes summed over the user's books (**FE computation**).
- **Tabs:** `Yayınlananlar` (published books carousel) · `Dijital Kitaplık` (saved digital books; only if library visible) · `Okuduğum Basılı Kitaplar` (07e F-PRINTED-06; if library visible) · `Taslaklar` (self; count badge) · `Alıntılar` (count badge; private quotes only for self) · `Takip` (self: followed books) · `Ayarlar` (self).
- **Privacy:** when `canViewProfile` is false → “Bu profil yalnızca takipçilere açık. İçerikleri görmek için kullanıcıyı takip edin.” Web-only: sets `<meta name="robots">` from `isSearchIndexable`.
- **API:** `getUserById` (profile selection incl. `usersBooks`, `followers`, `following`, flags), `getQuotesByUser`, `getUserById.savedBooks` (lazy, on tab), `getUserScore`, `getUserBadges` (both polled 15 s), `getFollowedBooks` (self).
- **States:** spinner; “Profil yüklenemedi” (+ Tekrar Dene) / “Kullanıcı Bulunamadı” (+ Ana Sayfaya Dön; own profile also offers Çıkış Yap). If own profile resolves to `null` → toast “Oturumunuz geçersiz…” and logout.
- **Perm:** public subject to privacy. **Resp:** SH. **Src:** `pages/UserProfilePage/index.jsx`, `Server/src/utils/profileAccess.js`.
- **Verify:** every privacy combination (profile/library/follow list) for guest, follower, non-follower.

### F-PROF-02 — Edit own profile
- “Düzenle” → inline form: avatar upload, Ad Soyad, Kullanıcı Adı (required: “Kullanıcı adı zorunludur.”), Hakkımda → “Kaydet” / “İptal”. Success toast “Profil başarıyla güncellendi.”; if the username changed on a slug URL, the route is replaced with the new `/yazar/<username>`.
- **API:** `updateProfile(username, fullName, bio, profilePicture)`. The form also holds `website`, but the mutation has no such argument and no input is rendered → not editable (**VERIFIED**).
- **Validation:** client only checks non-empty username; server has **no format/length validation** on this path (only unique index) — see risks.
- **Avatar:** uses the generic `ImageUpload` with its **default 2:3 aspect ratio** (no aspect prop passed) → Cloudinary URL. `utils/cropImage.js` + `react-easy-crop` exist but are not used by this page (**INFERRED unused**). **Verify** avatar cropping at runtime.

### F-PROF-03 — Followers / following lists
- Tapping the counters (when visible) opens a modal list (avatar, name, `@username`) → tap navigates to that profile. Empty: “Burada henüz kimse yok.” On own followers list each row has **“Takipçiyi Çıkar”** (F-FOLLOW-04).
- **API:** data comes from the profile query (`followers`, `following`). No pagination.

### F-PROF-04 — Message a user from their profile
- “Mesaj Gönder”; disabled with tooltip “Bu kullanıcı mesaj almayı sınırlandırmış.” when `canMessage` is false; guests get toast “Mesaj göndermek için giriş yapmalısınız.” → opens/creates the conversation and navigates to `/messages/<id>`.
- **API:** `getOrCreateConversation`.

### F-PROF-05 — Share profile
- “Profili paylaş” → F-SHARE-01 (`PROFILE`).

### F-PROF-06 — “Desteklerim” shortcut
- Own profile → `/funding-history` (07e).

### F-PROF-07 — Grouped quotes on profile
- `components/Quote/ProfileQuoteGroups` renders the user's quotes grouped (by book — **INFERRED** from name; verify) using `QuoteCard`.

## K. Follow system

All follows are **request-based**: every follow needs the target's approval, regardless of profile privacy (VERIFIED: `Server/src/services/followService.js`).

### F-FOLLOW-01 — Send follow request / cancel / unfollow
- **UI:** `components/Follow/UserFollowButton`. Button label by `followStatus`: `Takip İsteği Gönder` → (`PENDING`) `İsteği Geri Çek` → (`FOLLOWING`) `Takibi Bırak`. Server message shown as toast; profile refetched. While pending the profile polls every 15 s and shows “Takip isteği onay bekliyor.”
- **API:** `requestFollowUser`, `cancelFollowRequest`, `unfollowUser`. **Perm:** signed-in. (For guests the button still renders; the mutation fails with the auth error — **verify**.)

### F-FOLLOW-02 — Incoming requests: accept / reject
- In the notification panel → see 07a F-NOT-03.

### F-FOLLOW-03 — Notifications for follow events
- `FOLLOW_REQUEST` (to recipient), `FOLLOW_REQUEST_ACCEPTED` (to requester), `NEW_FOLLOWER` (to recipient, if setting on) — BE.

### F-FOLLOW-04 — Remove a follower
- `components/Follow/RemoveFollowerButton` in own followers modal; toast with server message. **API:** `removeFollower`.

## L. Settings (own profile → “Ayarlar” tab)

Sections: Hesap · Gizlilik · Bildirimler · Yazar · Görünüm · Hesabı Sil. Save buttons appear only when the section is dirty.

### F-SET-01 — Change e-mail
- Inputs: new e-mail, current password. Client checks both present and regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`; lower-cases. Success toast = server message. Note shown: “Yeni adresinize bilgilendirme e-postası gönderilir.”
- **API:** `changeEmail`. **Consequence:** server increments `authVersion` → the current session becomes invalid (next request signs the user out). **Verify.**

### F-SET-02 — Change password
- Inputs: current, new, confirm; “Şifreleri göster” toggle; strength label (`Zayıf/Orta/İyi/Güçlü` from number of rules passed); first failing rule is shown as toast; mismatch “Yeni şifreler eşleşmiyor.” Hint for Google accounts: use the reset link to create a password.
- **API:** `changePassword`. Same session-invalidation consequence. **Verify.**

### F-SET-03 — Privacy settings
- Toggles: Herkese Açık Profil, Arama Motorlarında Görün, Kitaplığı Göster, Takip Listesini Göster; radio Mesajlaşma: Herkes / Sadece Takipçiler / Kimse. Toast “Gizlilik ayarları kaydedildi.”
- **API:** `updatePrivacySettings`. **Resp:** SH (enforcement BE).

### F-SET-04 — Notification settings
- Toggles (7 exposed): Yeni Takipçi, Oturumda Bahsedilme, Yorum ve Alıntıda Etiketlenme, Kitaba Yorum, Kitaba Beğeni, Alıntıya Beğeni, Oturumda Yeni İleti. The schema's other 5 flags (`publishingOffer`, `offerUpdate`, `emailDigest`, `emailOffers`, `emailMarketing`) are **not exposed in the UI** and the client sends only the 7. Toast “Bildirim tercihleri kaydedildi.”
- **API:** `updateNotificationSettings`. These control **in-app** notifications only.

### F-SET-05 — Author settings
- Telif Notu (≤300, counter), Haftalık Kelime Hedefi (integer ≥0; empty = off; “Hafta pazartesi başlar.”) with progress “Bu hafta X / Y kelime yazdınız.” (`weeklyWritingWords`), Tercih Ettiğiniz Türler (genre names; affects recommendations). Toast “Yazar ayarları kaydedildi.”
- **API:** `getAllGenres`, `updateAuthorSettings`.

### F-SET-06 — Appearance (reading font size)
- Radio Küçük/Orta/Büyük with preview sentence; **stored on the device only** (07a F-NAV-11). No backend.

### F-SET-07 — Deactivate account
- “Devre Dışı Bırak” → inline confirm “Evet, Devre Dışı Bırak” / “Vazgeç” → toast, logout, `/login`. Reversible by logging in again.
- **API:** `deactivateAccount`. **Destructive (reversible).**

### F-SET-08 — Delete account permanently
- “Hesabı Sil” → must type exactly **`hesabımı sil`** (Turkish-locale lower-cased comparison) → “Kalıcı Olarak Sil” → toast, logout, `/`.
- **API:** `deleteAccount`. **Destructive (irreversible from the app).** Required by app-store policies as an in-app capability — already available.

## M. Quotes

### F-QUOTE-01 — Quotes feed
- **Entry:** `/quotes`. **UI:** `pages/QuotesPage`. Sort toggle **En Popüler** (likes) / **En Yeni**; 20 per page; **infinite scroll** (IntersectionObserver) with de-duplication; end marker “Tüm alıntılar yüklendi ✦”; empty “Henüz alıntı yok — Kitap okurken beğendiğin bölümleri alıntıla!”.
- **API:** `getQuotesFeed(limit, offset, sortBy)`. **Perm:** public.

### F-QUOTE-02 — Search quotes
- Search box “Alıntı, kitap veya yazar ara...”, debounce 400 ms, first 20 results, replaces the feed while non-empty (no pagination of results). **API:** `searchQuotes`.

### F-QUOTE-03 — Quote card
- **UI:** `components/Quote/QuoteCard`. Shows repost header (“@user yeniden paylaştı” + repost comment), quote text, **spoiler veil** (“⚠️ Sürprizbozan içeriyor — Görmek için tıkla”), note, original author for reposts, book source (cover, title, chapter title, “Sayfa N”) linking to the book, author link, relative time (`Ndk/Nsa/Ng önce`), actions. Private quotes show “Özel · Sadece ben”, have no actions, and are hidden entirely unless the viewer is the owner.
- **Verify:** `createdAt` format (client handles epoch-ms strings and a `{seconds}` object).

### F-QUOTE-04 — Like quote
- Optimistic; guest → intent `like` with `quoteId`. **API:** `toggleQuoteLike`.

### F-QUOTE-05 — Repost / undo repost
- Only on original quotes, signed-in: opens an optional comment input (mentions) → “Yeniden Paylaş”; when already reposted the same button undoes it. Optimistic counter. **API:** `repostQuote`, `unrepostQuote`.

### F-QUOTE-06 — Quote comments
- Toggle comment section; input with mentions, Enter submits; list with avatar, `@user`, time, delete on own (no confirm). Guest → intent `quote-comment` with draft. Anchor `#quote-comment-<id>` on the detail page auto-opens the section.
- **API:** `getQuoteComments`, `addQuoteComment`, `deleteQuoteComment`. `toggleQuoteCommentLike` is defined but **no like control is rendered** (VERIFIED in component source).

### F-QUOTE-07 — Quote detail
- **Entry:** `/quotes/:quoteId` (share links, notifications). One `QuoteCard`, “← Alıntılara dön”. **API:** `getQuoteById`.

### F-QUOTE-08 — Delete own quote
- Backend `deleteQuote` exists and `DELETE_QUOTE_MUTATION` is defined in `graphql/mutations/quote.js`, but **no component imports it** (VERIFIED by repository search) → quotes cannot be deleted from the web UI (only un-reposted). Not required for parity; a candidate improvement to raise with the product owner.

### F-QUOTE-09 — Add a quote from a printed book
- Manual quote entry with page number for printed-catalogue books → 07e F-PRINTED-04.

## N. Messaging (1-to-1 direct messages)

### F-MSG-01 — Conversation list
- **Entry:** `/messages` (protected). **UI:** `pages/MessagesPage`, `components/Messaging/ConversationList`. Two-pane on desktop; on small screens list ↔ chat by route (`/messages/:conversationId`).
- Rows: avatar/initials, other participant, time (today `HH:mm`, “Dün”, weekday, `dd.MM`), preview (`Sen: ` prefix; “📖 Kitap paylaştı” / “💬 Alıntı paylaştı”; “Henüz mesaj yok”), unread badge (`99+`).
- **API:** `getConversations`. Empty: “Henüz konuşman veya mesaj kabul eden bir takibin yok.”

### F-MSG-02 — Start a conversation
- One search box (≤120 chars, 250 ms debounce) filters existing conversations client-side (Turkish-insensitive) **and** queries “Takip ettiklerin” — users the member **follows** who accept messages; 30 per page (“Daha fazla kişi göster”). Tap → `getOrCreateConversation` → opens chat.
- **Rule:** new conversations can only be started from this list or from a profile whose `canMessage` is true. **API:** `getMessageRecipients`, `getOrCreateConversation`.

### F-MSG-03 — Chat window
- Header with back arrow and the other user's profile link; messages oldest → newest (server returns newest first; client reverses); “Daha eski mesajlar” loads 20 more by offset; auto-scroll to bottom on new messages; day label (“Bugün”/“Dün”/date) and time per bubble; empty “Henüz mesaj yok. Bir şeyler yaz!”.
- **API:** `getMessages`, `markMessagesAsRead` (on open → refetches unread count and conversations).

### F-MSG-04 — Send text message
- Enter sends, Shift+Enter newline; optimistic bubble; on failure the text is restored and the error shown (“Mesaj gönderilemedi.” / server message, e.g. recipient restricted). **API:** `sendMessage(type: TEXT)`.

### F-MSG-05 — Real-time incoming messages
- Subscription `onNewMessage(conversationId)` for the **open conversation only**; prepends to the cache and updates the list preview. Unread badge elsewhere relies on **30 s polling** of `getUnreadMessageCount`. **Verify:** latency of the unread badge; behaviour when the socket drops.

### F-MSG-06 — Delete own message
- “···” on own bubbles → “Sil” (no confirm). **API:** `deleteMessage`. The other participant's open chat is **not** updated in real time (no delete event).

### F-MSG-07 — Edit message
- Backend `editMessage` exists and `MessageBubble` accepts editing props, but `ChatWindow` does not wire them and the menu only offers “Sil” → **not reachable in the web UI** (VERIFIED in source). Not required for parity.

### F-MSG-08 — Share a book or quote into a chat
- **UI:** `components/Messaging/ShareModal` (“Kitabı paylaş” / “Alıntıyı paylaş”), opened from the share dialog's “Betik’te mesajla gönder”. Preview of the item, search over **existing conversations**, select one, optional message, “Gönder” → “Gönderildi ✓” and auto-close after 1.2 s.
- **API:** `sendMessage(type: BOOK|QUOTE, attachedBookId|attachedQuoteId)`. Only public quotes can be attached (server).

### F-MSG-09 — Attachment bubbles
- Book attachment card (cover, title, author, “Kitaba git →”) → book detail; quote attachment (first 200 chars, book · chapter) → the quote's book.

## O. Sharing

### F-SHARE-01 — Share dialog (book, chapter, quote, profile, session)
- **UI:** `components/Sharing/SocialShareDialog`, `SocialShareButton`; `utils/socialSharing.js`.
- **Flow:** `getSocialShare(type, id)` returns title, description, canonical path, preview image path and web origin. The client builds a **preview URL on the API host**: `<API>/share/<type>/<slug-or-id>?webOrigin=<web origin>` (this is the link that gets shared, so crawlers see Open Graph tags and humans are redirected to the web page).
- **Actions:** WhatsApp (`wa.me/?text=`), Telegram (`t.me/share/url`), X (`twitter.com/intent/tweet`), “Diğer uygulamalar” (Web Share API), “Bağlantıyı kopyala”, Story/Durum section: download the preview image, “Görsel ve bağlantıyı paylaş” (Web Share with file), “Metin ve bağlantıyı kopyala”, read-only link field, and “Betik’te mesajla gönder” (books and quotes, signed-in → F-MSG-08).
- Only public content is shareable; otherwise the server error message is shown with “Yeniden dene”.
- **Resp:** SH + BR (Web Share, clipboard, download). **Mobile note:** replace with the native share sheet (text + URL + optional image file) while keeping the **same shared URL format**; images live on the web host (`/social-share/*.jpg`, session covers).
- **Verify:** generated URLs per type; image availability.

## P. Leaderboard & scoring

### F-SCORE-01 — Leaderboard (“Aktiflik Tablosu”)
- **Entry:** `/leaderboard`. Period tabs Genel / Aylık / Haftalık / Günlük; podium for top 3; list of top 10 with avatar, name, `@username`, points; own row “Senin sıran #N” when the member is outside the top 10.
- **API:** `getLeaderboard(period)`, `getUserRank(userId, period)`; live refresh by 15 s polling + `leaderboardUpdated` subscription + window focus.
- **Perm:** public. **Resp:** BE (points), FE (refresh cadence).

### F-SCORE-02 — Earning points (server-side rules)
- Quote +10, comment +5, repost +3, chapter +15, session entry +5, first publication of a book +50, reading 1 point per verified minute. Each award creates a `POINTS_EARNED` notification (“+N Puan!”) and may unlock badges (`BADGE_EARNED`). **Src:** `Server/src/services/scoreAwards.js`, `readingService.js`.
- **Verify:** idempotency (e.g. deleting and re-creating content), badge thresholds (seed data `Server/src/scripts/seedBadges.js`).

### F-SCORE-03 — Live score refresh
- A global `myScoreUpdated` subscription (signed-in) triggers refetch of score-dependent queries (profile points, badges, notifications count). The socket is re-created when the signed-in user changes. **Src:** `components/Score/ScoreUpdates.jsx`, `hooks/useLiveScoreQuery.js`.

### F-SCORE-04 — Badges on profile
- See F-PROF-01. **API:** `getUserBadges`.
