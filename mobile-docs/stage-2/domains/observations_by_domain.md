# Observations by domain (detailed runtime record)

## Environment
- No Docker on host. Sandbox = scratchpad/betik-sandbox: rsync copy of Server+Client (no android), npm ci inside copy, mongodb-memory-server replset rs0 on 127.0.0.1:27055 db betik_stage2 (data in sandbox), local SMTP sink 127.0.0.1:2555 (STARTTLS self-signed, NODE_EXTRA_CA_CERTS), API :5055 (binds all interfaces — app code has no host option outside print-sandbox mode), web :3055 (127.0.0.1).
- Secrets generated fresh; project root .env (contains real-looking SMTP/Google/Cloudinary values, DEV_EXTERNAL_INTEGRATIONS=true) NOT used.
- Cloudinary: client configured with synthetic cloud name; uploads intercepted in the browser (Playwright route) and answered with res.cloudinary.com/betik-sandbox-mock/... URL; images served from a local PNG.
- Google login: no client id → button not rendered. BLOCKED.
- Seed gaps found: (1) seeded draft book has no description → GetUserById fails "Cannot return null for non-nullable field Book.description" → author's own profile shows "Profil yüklenemedi" (screenshot profile/own_author_error_state). Fixed in sandbox DB by setting description. (2) classification terms/genres not seeded → create-book format select empty, cannot create book; ran app's seedClassification(). (3) badges collection empty; ran seedBadges.js.

## Guest
- Guards: /profile,/create-book,/messages,/publisher,/funding-history,/payment/success → /login ; /admin → / .
- /newsletter without token: "Geçersiz bağlantı. Size gönderilen e-postadaki bağlantıyı kullanın."
- Leaderboard empty: tabs Genel/Aylık/Haftalık/Günlük, no empty-state text.
- Mobile feed: filter panel occupies whole first screen before any book.

## Dashboard / editor (author)
- Dashboard has own layout (no top nav): left sidebar (cover, title, N Bölüm, SINIFLANDIRMAYI DÜZENLE, OKUYUCU MODU, PROFİLE DÖN, new chapter input + EKLE + "Yeni bölümü gizli oluştur" checkbox, chapter list with delete buttons), top publish bar, editor.
- EKLE with empty title: nothing happens (no mutation, no message). New chapter is NOT auto-selected.
- Quill toolbar: header picker (Normal/H1/H2), bold, italic, underline, strike, blockquote, ordered list, bullet list, link, image, clean. Placeholder "Hikayenizi buraya yazın...".
- HTML emitted: <p>, <strong>, <em>, <u>, <s>, <blockquote>, <ol><li>, <ul><li>, <h1>, <h2>, <a href rel="noopener noreferrer" target="_blank">, <p><br></p> for empty line, <img src="data:image/png;base64,..."> (image button = native file chooser accept image/png,gif,jpeg,bmp,x-icon; embedded as base64 data URI inside chapter HTML, no Cloudinary).
- Autosave: UpdateChapter{chapterId,content,pageCount} ~1.6s after last keystroke; badge KAYDEDİLDİ. Cmd/Ctrl+S: no special handling.
- Switching chapter or clicking PROFİLE DÖN with pending changes: immediate flush save then navigate, no dialog. Browser reload with pending: beforeunload prompt.
- Offline: badge "KAYDEDİLEMEDİ — KAYDET İLE TEKRAR DENEYİN."; after reconnect → KAYDEDİLDİ.
- 19,966 chars text / 43 paragraphs → pageCount 20; book pageCount = sum incl. hidden chapter (24).
- ⋯ menu (<details>): "Okuyuculardan gizle" ↔ "Okuyuculara aç" (SetChapterVisibility), "Bölümü paylaş" (share dialog). Hidden chapter shown "· Gizli" in list.
- Delete chapter: window.confirm "Bu bölümü silmek istediğinize emin misiniz?" → DeleteChapter → toast "Bölüm silindi".
- Publish bar states: DRAFT no text → "Yayınlamak için en az bir bölüme metin ekleyin." button disabled; DRAFT with text → "Yayınla (Görünür Yap)" confirm "Kitap herkese görünür olacak. Onaylıyor musunuz?" → UpdateBookStatus WRITING; WRITING → "Taslağa Çek" / "Yazımı Tamamla" (confirm "Kitabın yazım aşamasını bitirdiniz mi?") → COMPLETED → "Taslağa Çek" / "Destek Fonu İçin Başvur / Başvurumu Gör".
- Create book: required cover, title, format, ≥1 genre (max 3; others disabled at 3), description. Empty submit → toast list of errors + inline. Cover: file chooser accept jpeg/png/webp → upload → preview. After create → /dashboard/<id> with "HOŞGELDİNİZ".
- Console: React prop-type warnings (Input name, Toast type, Button variant) — cosmetic.

## Reader (member)
- Layout: left sidebar (back to detail, title, "4 bölümden N tanesi okundu", progress bar, chapter list with read checkboxes, word count · pages), top bar (back arrow, "Alıntı nasıl eklenir?" help), help card dismissable, chapter header "Bölüm i / n", title, BÖLÜMÜ PAYLAŞ, paragraphs each with bookmark + comment buttons (always visible), bottom nav Önceki Bölüm / Tamamla ve Devam Et (last: Tamamla).
- URL stays /kitap/<slug>/oku for every chapter. Hidden chapter not listed for reader.
- Bookmark: SetBookmark{bookId,chapterId,chapterIndex,paragraphIndex,chapterTitle}; one per book (setting another moves it); label "Kaldığın yer"; RemoveBookmark{bookId}; persists across reload.
- Paragraph comments: inline dark panel "Paragraf Yorumları"; empty "Henüz yorum yok. İlk yorumu sen yap!"; send disabled when empty; Enter does not send; AddParagraphComment{bookId,chapterId,paragraphIndex,content}; delete without confirmation.
- Quote: selection <10 chars → nothing; 10–1000 → popup "Alıntı kaydet" (preview, visibility Herkese açık / Sadece ben (özel), note with @mention, "Sürprizbozan içeriyor", Kaydet); CheckQuoteExists first; CreateQuote{visibility,text,note,bookId,chapterId,chapterTitle,chapterIndex,location{startOffset,endOffset},isSpoiler}; duplicate → "Bu alıntı zaten kayıtlı. Profilimdeki alıntılar".
- Copy protection: synthetic copy/contextmenu not prevented, user-select:text (needs source check).
- Completion: SaveReadingProgress{bookId,chapterId,completedChapterIds}; checkbox toggles read state; localStorage book-progress-<user>-<book> v2 + betik:reading:<user>:<book>:<session>.
- Resume: reopening /oku lands on last chapter, scroll at top (no scroll restore). Top reading-progress bar tracks scroll %.
- Reading time: StartReadingSession{bookId,chapterId} then ReportReadingTime{sessionId,sequence,seconds≈15,chapterId} every ~15s while active.
- Reader strips target=_blank from links; base64 image renders.
- Share chapter link: http://localhost:5055/share/chapter/<chapter-slug>?webOrigin=...

## Guest gating / book detail
- Guest clicking like → modal "Beğenini paylaş / Beğenmek için ücretsiz hesap oluştur." buttons: Ücretsiz hesap oluştur · Zaten hesabım var — Giriş yap · Şimdilik geri dön (registration intent).
- Guest reader: chapter 1 readable; chapters 2+ labelled "Ücretsiz üyelikle oku"; next → modal "Hikâyeye devam et / “<book>” · Sonraki bölümleri okumak için ücretsiz hesap oluştur." Help card adds "Alıntı kaydetmek için giriş yapmalısınız." but selecting text still opens the quote popup with Kaydet.
- Hidden chapter URL as guest → 404 page. Legacy /book-detail/<id> → redirects to /kitap/<slug>.
- Detail (member): LikeBook toggle (no toast), ToggleSaveBook (toast "Kitaplığına eklendi"), ToggleBookFollow ("Kitabı Takip Et" → "Kitabı Takip Ediyorsun"), DESTEK OL → /donate/<id> ("Kitabın onaylı destek kampanyası yok." + sandbox notice), share dialog (WhatsApp, Telegram, X, copy link, Story/Durum image download, copy text+link; link = API /share/book/<slug>?webOrigin=).
- Detail shows classification block "Eser hakkında" with "Belirtilmedi" placeholders; print interest panel.

## Comments / mentions / notifications
- Comment box: empty GÖNDER does nothing. Typing "@dev" → SearchMentionUsers → listbox "Herkese açık hesaplar ve takipçilerin" with @username + full name; click inserts "@dev_author ". CreateComment{bookId,content}; toast "Yorum gönderildi"; mention rendered as link /yazar/<username>.
- Reply: "Yanıtla" opens inline single-line input prefilled "@<user> ", Gönder disabled until extra text; ReplyToComment{bookId,content,parentCommentId}; reply rendered with class is-reply (one level). Like: ToggleCommentLike. Delete own: confirm "Silmek istediğinize emin misiniz?" → DeleteComment. Book author has NO delete on others' comments.
- Author's book detail extra controls: Taslağa Çek, Yazımı Tamamla, YAZMAYA DEVAM ET (→dashboard), SİL, SINIFLANDIRMAYI DÜZENLE.
- Bell: unread badge number; polling GetUnreadNotificationCount ~15 s (follow request badge appeared after 7 s without reload). Opening panel = GetNotifications + GetIncomingFollowRequests + MarkNotificationsRead (badge clears). Panel sections: "Takip İstekleri" (KABUL ET / REDDET) then list (icon, title, message, relative time "1dk", "Az önce"). Overlay click closes.
- Notification types seen: Etiketlendin (yorum / paragraf yorumu / yorum yanıtı), Kitabın beğenildi (duplicate after like→unlike→like), +15 Puan (bölüm ekleme), +5 Puan (yorum), +1 Puan (1 dakika okuma), Yeni Rozet Kazandın (İlk Adım), Yeni takipçin var, Takip isteğin kabul edildi.
- Notification href uses legacy path (/book-detail/<id>#comment-<id>) → redirected to /kitap/<slug>#comment-<id>.

## Profile / follow
- Other profile: name, @username, counters (KİTAPLAR, TAKİPÇİLER, TAKİP EDİLENLER, ⭐ PUAN, görüntülenme, beğeni), PROFİLİ PAYLAŞ, TAKİP İSTEĞİ GÖNDER, MESAJ GÖNDER; tabs YAYINLANANLAR, DİJİTAL KİTAPLIK, OKUDUĞUM BASILI KİTAPLAR, ALINTILAR. Own profile adds e-mail, DESTEKLERİM, DÜZENLE, ÇIKIŞ YAP, tabs TASLAKLAR(n), TAKİP, AYARLAR.
- Follow is always a request (even default profile): TAKİP İSTEĞİ GÖNDER → toast "Takip isteği gönderildi." → İSTEĞİ GERİ ÇEK (cancel, no confirm) → after accept TAKİBİ BIRAK (state updated on requester page without reload within 10 s). Followers modal lists users.
- Legacy /user/<id> → /yazar/<username>.

## Messaging
- /messages: left list (search "Mesaj göndereceğin kişiyi ara", conversations with initials avatar, time, last message, section "Takip ettiklerin"), right pane empty state "Mesajların / Bir konuşma seç veya yeni bir tane başlat." MESAJ GÖNDER on profile → GetOrCreateConversation → /messages/<id>.
- Send: Enter or Gönder (disabled for empty/whitespace); SendMessage{input{conversationId,content,type:TEXT}}; 3000-char message accepted. WS graphql-ws: connection_init with bearer token; subscriptions MyScoreUpdated (global) and onNewMessage (when a chat is open). createdAt = ISO-8601 string.
- Live delivery when recipient has the chat open: <1 s, MarkMessagesAsRead fired. On the list view (no chat open) the list does NOT update live; only nav unread badge (poll). 
- Own bubble menu "···" → Sil (no confirm) → DeleteMessage; other side keeps showing the message until reload (no live removal). No menu on others' bubbles; no edit.

## Sessions
- /sessions without permission: inline form "Oturum açmak ister misin?" textarea (required, native validation) + OTURUM AÇMA İZNİ İSTE → RequestSessionAccess{reason} → "Oturum açma başvurunuz yönetici onayını bekliyor." + DURUMU YENİLE. Guest: "Başvurmak için giriş yapın".
- Admin /admin/session-access: status select (Onay bekleyenler / İzin verilenler / Reddedilen-izni kaldırılanlar), LİSTEYİ YENİLE, card with applicant, e-mail, date, reason, note textarea, ONAYLA / REDDET → ReviewSessionAccess{userId,revision,approve,note}. No notification observed for the applicant.
- Approved: "+ OTURUM AÇ" modal: optional cover (JPEG/PNG/WebP ≤ 8 MB), BAŞLIK (required: "... zorunludur."), Açıklama (@mention), type buttons Herkese Açık / Takipçilere Özel / Özel (+ ERİŞİM KODU ≥ 4 chars), tags + EKLE, İPTAL / OTURUM OLUŞTUR → CreateSession{input{title,coverImageUrl,description,type OPEN|FOLLOWERS_ONLY|PRIVATE,tags,accessCode}}. Stays on list.
- Card: type badge, date, title, description, #tags, creator, "N katılımcı", OTURUMU PAYLAŞ (only on open). Client-side search box filters; empty "Henüz oturum yok / Aramanıza...".
- Detail /oturum/<slug> (legacy /sessions/<id> redirects): back link, badge, tags, title, OTURUMU PAYLAŞ, (owner: KAPAK FOTOĞRAFINI DÜZENLE, OTURUMU KAPAT), description, creator · katılımcı · yazı, composer (textarea, @mention, "Göndermek için Ctrl + Enter", PAYLAŞ disabled when empty), entries newest first.
- AddSessionEntry{sessionId,content}; other viewers receive new entries instantly (WS). Likes (ToggleSessionEntryLike) and deletions are NOT pushed live. Own entry: badge SEN, "···" Seçenekler → Yazıyı Sil (no confirm) → DeleteSessionEntry. Session owner has no delete on others' entries.
- Deep link /oturum/<slug>#entry-<id> focuses the entry. Share link API /share/session/<slug>.
- Guest: can read open session; composer disabled.
- Private: gate "🔒 Özel Oturum / Bu oturuma katılmak için erişim kodu gereklidir." input + KATIL → VerifySessionAccessCode; wrong → "Erişim kodu hatalı."; right → session opens.
- Followers-only: listed for everyone; non-follower opening it got an empty main area (see screenshot sessions/followers_only_denied) — verify.
- Close: confirm "Oturumu kapatmak istediğinize emin misiniz?" → CloseSession → back to /sessions; closed session no longer listed.

## Quotes
- /quotes: search "Alıntı, kitap veya yazar ara..." (SearchQuotes, debounced; none → "Henüz alıntı yok / Aramanıza uygun sonuç bulunamadı."), tabs En Popüler / En Yeni (GetQuotesFeed), end marker "Tüm alıntılar yüklendi ✦".
- Card: quote text, note in quotes, source link (book + chapter), @user, relative time, comment count, repost count, like, share. ToggleQuoteLike{id}. Repost button opens inline form (optional comment textarea, İptal / Yeniden Paylaş) → RepostQuote{originalQuoteId,repostComment,isSpoiler}; clicking again → UnrepostQuote (no confirm). Comments expand inline (GetQuoteComments, input "Yorum yaz...", Enter sends AddQuoteComment{quoteId,content}; own comment has delete).
- /quotes/<id>: "← Alıntılara dön", "Kitaptan bir satır", same card. Unknown id → "Bu alıntı artık mevcut değil veya herkese açık değil." Share link API /share/quote/<id>.
- Owner sees no delete on own quote (F-QUOTE-08 confirmed not in UI). Profile ALINTILAR tab groups by book ("<book> / 1 alıntı").
- Followers-only session opened by a non-follower → "Sayfa yüklenemedi. Tekrar dene" (generic crash/boundary state rather than an access message).

## Profile edit / settings
- DÜZENLE = inline edit mode: Resim Yükle, AD SOYAD, KULLANICI ADI*, HAKKIMDA, KAYDET/İPTAL → UpdateProfile{fullName,username,bio,profilePicture} → toast "Profil başarıyla güncellendi.". Badges shown as emoji under bio.
- AYARLAR sub-tabs: HESAP, GİZLİLİK, BİLDİRİMLER, YAZAR, GÖRÜNÜM, HESABI SİL. Each form has its own Kaydet button that appears/enables when dirty.
- GİZLİLİK: toggles Herkese Açık Profil, Arama Motorlarında Görün, Kitaplığı Göster, Takip Listesini Göster; radio Mesajlaşma Herkes/Sadece Takipçiler/Kimse → UpdatePrivacySettings{privacySettings{isProfilePublic,isLibraryPublic,isFollowListPublic,allowMessages,showInSearchEngines}} toast "Gizlilik ayarları kaydedildi."
  Effect for non-follower: bio hidden, TAKİPÇİLER/TAKİP EDİLENLER show "Gizli", library & printed tabs removed, "Bu profil yalnızca takipçilere açık. İçerikleri görmek için kullanıcıyı takip edin.", MESAJ GÖNDER disabled; existing chat send → toast "Bu kullanıcı mesaj almayı sınırlandırmış." (GraphQL error code INTERNAL_SERVER_ERROR with user-facing message); mention search no longer returns the user ("Etiketleyebileceğin bir kullanıcı bulunamadı."). The private user's PUBLIC quote stays in the public quotes feed.
- BİLDİRİMLER: Yeni Takipçi, Oturumda Bahsedilme, Yorum ve Alıntıda Etiketlenme, Kitaba Yorum, Kitaba Beğeni, Alıntıya Beğeni, Oturumda Yeni İleti → UpdateNotificationSettings{notificationSettings{newFollower,mentionInSession,mentionInComment,bookComment,bookLike,quoteLike,sessionReply}} toast "Bildirim tercihleri kaydedildi."
- YAZAR: Telif notu (0/300), Haftalık kelime hedefi (number), Tercih ettiğiniz türler (searchable checkbox groups) → UpdateAuthorSettings{authorSettings{copyrightNote,weeklyWordGoal,preferredGenres[names]}}.
- GÖRÜNÜM: Küçük/Orta/Büyük (16/18/20 px) live preview + Kaydet → localStorage app_font_size=sm|md|lg, toast "Okuma yazı boyutu kaydedildi.", no server call; reader paragraphs use it. Device-local only.
- HESABI SİL: "Tehlikeli Bölge": DEVRE DIŞI BIRAK, HESABI SİL.

## Auth / account lifecycle (disposable user stage2_user, mail captured by local sink)
- Login: native required validation on empty; wrong password → Login error (code INTERNAL_SERVER_ERROR, message "Giriş bilgileri geçersiz.") shown as inline + toast "Giriş yapılamadı. Bilgilerinizi kontrol edin." No show-password toggle on login.
- Register step 1: fullName, username, email, password, terms checkbox (all required; native validation). Password meter: Çok Zayıf / İyi / Güçlü + 5 rules (8 chars, upper, lower, digit, special). Submit → SendRegistrationCode. With an already-registered username+e-mail: request returned no error, no mail was sent, form stayed (no visible message within 1.5 s) — verify.
- Step 2 "E-postanı Doğrula": code input (placeholder 000000), "Kayıt İşlemini Tamamla", "Kod 10 dakika geçerlidir…", KODU YENİDEN GÖNDER (60 s countdown, disabled), Bilgileri Düzenle. Mail subject "Betik · E-posta doğrulama kodun" (6-digit code). Wrong code → RegisterAndLogin returns failure, stays on step (message not captured). Right code → logged in → /profile.
- Forgot: same neutral confirmation for unknown and known e-mail ("E-postanızı kontrol edin. Kayıtlı bir hesabınız varsa… Bağlantı 1 saat geçerlidir." + YENİDEN DENE). Mail "Betik · Şifreni yenile" with CLIENT_URL/reset-password/<token>.
- Reset: Yeni şifre + tekrar with meter; mismatch blocked client-side; invalid/used token → BAD_USER_INPUT "Geçersiz veya süresi dolmuş bağlantı."; success → "Şifreniz güncellendi! Giriş sayfasına yönlendiriliyorsunuz...". Existing sessions invalidated (Me → UNAUTHENTICATED "Giriş yapmalısınız." → redirect /login).
- Change e-mail (HESAP): new e-mail + current password, E-POSTAYI GÜNCELLE; wrong password → toast "Mevcut şifre hatalı."; success → toast "E-posta güncellendi. Bilgilendirme e-postası gönderildi." (mail "Betik · E-posta adresin güncellendi" to the NEW address; no verification step); session invalid on next navigation → /login.
- Change password: mismatch → toast "Şifreler eşleşmiyor." (no request); success → toast "Şifre başarıyla değiştirildi."; session invalid on next navigation.
- Logout (profile ÇIKIŞ YAP): Logout mutation, localStorage cleared, → /login, no confirm.
- Deactivate: inline confirm "Emin misiniz? Hesabınız gizlenecek ve oturumunuz kapatılacak…" EVET, DEVRE DIŞI BIRAK / VAZGEÇ → DeactivateAccount + Logout → /login. Profile of deactivated user → 404 page for others. Logging in again reactivates silently.
- Delete: inline confirm requires typing "hesabımı sil" → KALICI OLARAK SİL / VAZGEÇ.
- Delete account: DeleteAccount + Logout → /login; later login → "Giriş yapılamadı. Bilgilerinizi kontrol edin."
- Contact: fields name(max100), email(254), subject(150), message(5000), hidden honeypot "website"; native required validation; SendContactMessage{input}; mail "Betik · Yeni iletişim mesajı" to CONTACT_EMAIL. Page shows contact e-mail, "Telefon bilgisi henüz yayımlanmadı."
- Newsletter (footer on every page): e-mail + consent checkbox (required) → SubscribeNewsletter{input{email,consent,website}} → inline "Adresiniz zaten kayıtlıysa aboneliğiniz korunur; aksi halde doğrulama bağlantısı gönderildi…" ; mail "Betik · Bülten aboneliğini doğrula" link /newsletter?token=…&action=confirm → page with ABONELİĞİMİ DOĞRULA → ManageNewsletter{token,action} → "Aboneliğiniz doğrulandı. İptal bağlantısını içeren e-postayı saklayın."

## Discovery
- Landing search box filters the landing list in place (GetBookFeed), does not navigate to /feed.
- Feed: search debounce ≈ 0.7 s (1 request for a typed phrase); empty → "0 kitap listeleniyor / ARAMANIZLA EŞLEŞEN KİTAP BULUNAMADI. Filtreleri değiştirmeyi deneyebilirsiniz."; filters: Eser biçimi, Tür ve konu, Anlatım özelliği, Hedef okur kitlesi (selects), Etiket ara, Destek durumu radios (Tüm / Desteği açık / Hedefini tamamlayan), Sırala radios (En Yeni, En Popüler, En Eski, En Son Güncellenen, Hedefe en yakın). Choosing "Hedefe en yakın" switches support filter to "Desteği açık kitaplar" and it stays when another sort is chosen (list remained empty until support filter reset manually). Filter state not in URL; tab is (?tab=for-you).
- Member with preferences sees "Tercihlerim / Düzenle / <genre chips>". "Senin için" tab: GetRecommendations, header "SENİN İÇİN / Tercihlerine göre seçildi", reason badge ("Yeni eklendi"), DAHA FAZLA GÖSTER. Member without preferences → onboarding "Hangi türleri seviyorsun? En az bir tür seç…" genre picker. Guest → "Sana özel kitaplar keşfet … Ücretsiz hesap oluştur / Zaten hesabım var — Giriş yap".
- Only 2 public books existed → cursor paging not exercised.

## Printed catalogue
- /printed-books: header, BASILI KİTAP EKLE (guest: "Kitap eklemek için giriş yapın"), search (title/author/publisher/ISBN), collapsible filters, "N basılı eser", grid, "Sayfa 1 / 1" paging.
- Submit form: ISBN + ISBN İLE BUL, title*, printedAuthor*, publisher*, publicationYear*, pageCount*, imageUrl, classification (format*, genres* ≤3, tags, features, audience, warnings), description*, purchaseUrl, publicationEvidenceUrl*. SubmitPrintedBook{input} → "İsteğiniz Betik'e iletildi. Onaydan sonra kitabınız burada listelenecek." + "Basılı Kitap Katkılarım (1)" list with status (ONAYLANDI).
- BUG: invalid ISBN lookup → server "Geçerli bir ISBN-10 veya ISBN-13 girin." but toast shows raw JS error "Cannot read properties of undefined (reading 'lookupPrintedBook')".
- Admin /admin/printed-books: "Kitap ekleme istekleri" card (preview link, evidence link, note, ONAYLA/REDDET → ReviewPrintedBook{bookId,approve,note}) and "Yazar hak talepleri" (ReviewBookClaim{claimId,approve,note}). Submitter gets notification "Kitabın kataloğa eklendi".
- Detail /kitap/<slug> (BASILI ESER): metadata (Yayınevi, Basım yılı, Sayfa, ISBN), classification, share, "Okudum ve değerlendirdim" (score select 1–5 required, optional review → SavePrintedReading{bookId,rating,review}; then DEĞERLENDİRMEYİ GÜNCELLE / OKUDUKLARIMDAN KALDIR), "Bu kitabın yazarı mısınız? Hak talebinde bulunun" (evidence*, url → RequestBookClaim), "Okur yorumları" (CreateComment), "Kitaptan alıntılar" → form KISA ALINTI*, sayfa numarası*, not, spoiler, visibility → CreatePrintedQuote{visibility,bookId,text,pageNumber,note,isSpoiler}.
- Profile tab OKUDUĞUM BASILI KİTAPLAR: "1 basılı kitap okundu", card with ★ rating, review, date, Değerlendirmeyi düzenle / KİTAPLIĞIMDAN KALDIR.
- After claim approval the author sees "Bölüm ekle / düzenle" (→ /dashboard/<id>) + SINIFLANDIRMAYI DÜZENLE on the printed book, and the book appears in the author's profile.

## Print funding (mock SANDBOX provider — no real money)
- Author: dashboard COMPLETED state → "Destek Fonu İçin Başvur / Başvurumu Gör" → /print/<bookId> "Basım başvurusu": status line (Dijital yayın · Yazım · Ücretsiz basım ilgisi), form: Kitap boyutu (13,5×21 / 16×24), Kapak türü (Karton/Sert), Kağıt (Enzo/Ivory/Kuşe), İç baskı (Siyah beyaz/Renkli), Tahmini baskı adedi (1–100000, default 100), Kapak DPI (300–2400), Taşma payı (3–20 mm), tarife select, Kapak PDF (≤10 MB, uploaded to own API), notes, 3 declarations (all required; button disabled until complete) → SavePrintApplication{input{bookId,tariffId,specification{dimension,paperType,coverType,color,printRun,coverAssetId,coverDpi,bleedMm,notes},declarations}}.
- After save: status "Başvuru hazırlanıyor", frozen version id + SHA-256, KAPAK PDF DOSYASINI İNDİR, collapsibles (Baskı özellikleri ve beyanlar, Tahmini maliyet ₺…, Son metin/önceki sürümler/geçmiş), BAŞVURUYU İNCELEMEYE GÖNDER (SubmitPrintApplication{applicationId,revision}) → "İncelemede", "Başvuruyu iptal et", edit form.
- Admin /admin/print-funding tabs: BAŞVURULAR / KAMPANYA VE ÜRETİM / ÖDEME, İADE VE TESLİMAT / FİYAT TARİFELERİ. Decision select Revizyon iste / Reddet / Onayla + reason. Onayla requires: teklif referansı, kesin sayfa, mizanpaj PDF, teklif PDF, 7 total cost fields, 7 unit price fields, preflight checkbox → ReviewPrintApplication{input{applicationId,revision,decision,reason,quote{source,confirmedPages,layoutAssetId,quoteAssetId,preflightConfirmed,components{…Minor},sale{unit…Minor}}}} (amounts in minor units/kuruş). Then "Kampanya süresi (gün)" + confirm checkbox → ONAYLI SANDBOX KAMPANYASINI AÇ → OpenFundingCampaign{input{applicationId,revision,days}}.
- Campaign card (admin tab, book detail, checkout): title, "Kampanya açık", "SANDBOX · Gerçek para alınmaz", "₺raised / ₺goal · %", Ödeme için ayrılan, Kabul edilebilir kalan, Destekçi, Kitap satış fiyatı, date range · production state, "Basım ve kampanya güncellemeleri", link "Destek ve ön sipariş seçenekleri →". Feed card shows "Desteğe açık / Test kampanyası / 0,00 TL / 4.500,00 TL hedef / Tamamlanma: %0"; feed filter "Desteği açık kitaplar" lists it.
- Checkout /donate/<bookId>: Sepet: Fiziksel kitap adedi, İlave karşılıksız destek (quick amounts ₺50/100/250/500, İLAVE DESTEK YOK; limits ₺50–₺100.000), delivery fields when quantity>0 (Alıcı adı soyadı, Telefon, İl, İlçe, Posta kodu, Açık adres + consent), terms checkbox, "Sepet toplamı", TEST ÖDEME REZERVASYONU OLUŞTUR (disabled until valid) → StartPrintCheckout{input{campaignId,idempotencyKey,quantity,donationMinor,shippingAddress{fullName,phone,city,district,postalCode,line,consent}}}. Server validation error e.g. BAD_USER_INPUT "Telefon: 10–20 karakter gerekli." shown as toast; page then offers AYNI İŞLEMİ GÜVENLE YENİDEN SORGULA / YENİ SEPET HAZIRLA (ÖNCEKİ İŞLEM AYRICA SÜRER).
- Payment card: amount, status (Bekliyor / Test ödemesi doğrulandı / Başarısız / İptal edildi / İade bekleniyor / İade edildi), İşlem id · time, Karşılıksız destek / Ön sipariş breakdown, Rezervasyon state (Rezerve until +15 min / Kullanıldı / Serbest bırakıldı), buttons TEST ÖDEMESİNİ BAŞARILI SONUÇLANDIR / BAŞARISIZ ÖDEME DENE / ÖDEMEYİ İPTAL ET (SimulatePrintPayment{paymentId,outcome CAPTURED|FAILED}, CancelPrintPayment{paymentId}), then YENİ TEST İŞLEMİ HAZIRLA. A pending reservation is NOT re-shown when /donate is reopened; it stays actionable in /funding-history.
- /funding-history "Desteklerim ve ön siparişlerim": list of payment cards (with pre-order sub-card "Ön sipariş · İptal edildi · Sipariş id"), paging ÖNCEKİ / Sayfa 1 / SONRAKİ.
- Admin payments tab: İadeler, Ödemeler (TAM İADE İSTE with reason → RequestPrintRefund{paymentId,reason} → "İade bekleniyor"), Ön sipariş ve teslimat (Yetkili teslimat bilgileri). Campaign tab: UZLAŞTIRMA VE İADE İŞLERİNİ ŞİMDİ ÇALIŞTIR (RunPrintMaintenance → "İşlem kaydedildi."; refund then shows "İade edildi" for the supporter), KAMPANYAYI KAPAT VE TAM İADE SÜRECİNE AL (needs reason; not executed), Denetim geçmişi. Tariffs tab: immutable versions, "Yeni örnek tarife sürümü" form.
- Not exercised: campaign reaching goal, production tracking, delivery states, campaign close, application revision/reject/cancel, new tariff creation.

## Admin / publisher / guards
- Admin has no extra item in the top nav observed; admin area has its own sidebar: Basım, Destek ve Ön Sipariş · Yönetim Paneli · Kullanıcılar · Kitaplar · Kitap Türleri · Bütün Veriler · Şemalar ve Alanlar · Finans · Oturum İzinleri · Basılı Kitaplar ve Hak Talepleri.
- /admin overview: counters (Kullanıcılar, Kitaplar, Kitap türleri, Oturumlar, Kitap yorumları, Alıntılar with "N aktif / arşiv dışı"), İnceleme bekleyenler, Başarılı ödemeler (legacy; "Henüz başarılı ödeme yok."), Son yönetim işlemleri (audit feed).
- /admin/users|books|transactions|genres|data|data/<Resource>: same generic browser: Veri grubu select (≈33 resources), tabs Kayıtlar / Şema ve alanlar, search + Durum (Tümü / Aktif-arşiv dışı / Kaldırılmış / Pasif) + ARA/YENİLE, table with İNCELE / DÜZENLE, paging. Raw ISO dates in some columns.
- Record editor (?record=<id>): editable fields, "Yayından kaldırılmış" checkbox, required "İşlem gerekçesi", DEĞİŞİKLİKLERİ KAYDET → SaveAdminRecord{resource,id,revision(hash),changes,reason}; "Tüm kayıt alanları", "İlişkili kayıtlar" links, audit search link. Without reason → blocked by required validation. Archiving a comment hid it on the site; restore brought it back. AdminAudit resource lists every action (UPDATE, APPROVE, ASSIGN_AUTHOR, SESSION_ACCESS_…).
- Schema view: table Alan / Tür / Zorunlu / Düzenleme (Düzenlenebilir vs İşlem akışı-Salt okunur) / İlişki.
- Admin on regular screens: book detail shows SİL + SINIFLANDIRMAYI DÜZENLE for others' books; NO delete button on others' comments; private session still asks for the code; admin can open any author dashboard.
- Publisher: nav gains "YAYINEVİ PORTALI"; /publisher "Yayınevi Portalı": search, Destek durumu select (Tüm dijital kitaplar / Kampanya açılmış / Desteğe açık / Hedefe ulaşan), list rows (writing status, title, author, dijital yayın date, campaign summary), "Destek tutarları 30 saniyede bir güncellenir", YENİLE, paging. Read-only (PublisherCatalog). Publisher → /admin redirects to /.
- Member → /admin and /publisher redirect to /.
- CLIENT GUARD GAP: any logged-in member can open /dashboard/<id> of another author's PUBLIC book and gets the full authoring UI (publish-bar buttons, editable Quill). Server rejects writes: "Bu kitaba içerik eklemek için onaylanmış yazar yetkisi gerekir." (badge KAYDEDİLEMEDİ). Hidden chapters are not exposed. For another author's DRAFT the dashboard stays on "Kitap yükleniyor…" indefinitely. /print/<id> for a non-owner shows only the public campaign card. Draft book detail as non-owner → 404 page.

## Mobile / tablet / edge cases
- 393×852 and 834×1112: no horizontal overflow on 15 key screens. Mobile nav: hamburger "Menüyü Aç/Kapat" → right slide-out over dimmed page: Keşfet, Alıntılar, Basılı Kitaplar, Aktiflik Tablosu, Oturumlar, Profilim, Kitap Oluştur, Mesajlar (green badge), Bildirimler (red badge), ÇIKIŞ YAP.
- Mobile reader: sidebar hidden off-canvas, top controls "Bölümler (N)", back arrow, "Alıntı nasıl eklenir?"; site nav bar stays visible. Mobile dashboard: "Bölümler (N)" drawer button, publish buttons, Quill toolbar.
- Leaderboard with data: podium (🥇🥈🥉 with @username and points) + ranked list (name, @username, points); tabs Genel/Aylık/Haftalık/Günlük.
- Share preview: API GET /share/<type>/<slug>?webOrigin= returns HTML with og:type/title/description/url/image and a script redirect to the web URL.
- Unknown book/user/session slug → 404 page. Corrupted token → Me UNAUTHENTICATED → storage cleared → /login.
- Navigation scrolls to top; browser Back also landed at top (no restoration observed).
- Dev server: manifest.json linked, no service worker, no install prompt.
- Offline: reader read-state change kept in localStorage (pending:true) and synced after reconnect (SaveReadingProgress); navigating to a lazy page offline → "Sayfa yüklenemedi / Bağlantınızı kontrol edip sayfayı yeniden yükleyin. / Yeniden yükle".
- Book status: Taslağa Çek confirm "Kitap yayından kaldırılıp taslağa çekilecek. Onaylıyor musunuz?" → DRAFT → guests get 404; Yayınla confirm → WRITING. Delete book (SİL on detail): confirm "Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?" → DeleteBook → /profile.
- Inline classification edit saves via UpdateBookClassification and updates "Eser hakkında".
- Book description containing "<i>&</i>" is shown as literal text (escaped) everywhere.
