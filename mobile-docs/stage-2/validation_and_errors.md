# Validation and error behaviour — observed

## How errors reach the user

| Channel | Used for |
|---|---|
| Native browser validation (required fields, `type=email/url/number`, min/max) | Login, register, contact, newsletter consent, session access reason, printed-book form, rating select, admin reason. The request is never sent |
| Toast | Server-side refusals and client checks ("Mevcut şifre hatalı.", "Şifreler eşleşmiyor.", "Telefon: 10–20 karakter gerekli.", "Bu kullanıcı mesaj almayı sınırlandırmış.") |
| Inline text near the form | Login failure, create-book error list, session modal ("… zorunludur.", "… en az 4 karakter olmalıdır."), access code ("Erişim kodu hatalı."), newsletter result |
| Disabled submit button | Comment/reply/entry/message composers when empty, checkout until valid, print application until declarations are ticked, publish with no text |
| Native `confirm` dialog | Destructive or state-changing actions (see below) |
| Full-screen state | 404 page, "Profil yüklenemedi", "Sayfa yüklenemedi" |
| Status badge | Editor autosave failure |

GraphQL errors in this development setup mostly carry code `INTERNAL_SERVER_ERROR` with a Turkish message meant for the user; `BAD_USER_INPUT` and `UNAUTHENTICATED` were also seen. The site shows the message text as-is.

## Form rules observed

| Form | Rules seen | Result on violation |
|---|---|---|
| Login | e-mail and password required | Native; wrong credentials → "Giriş yapılamadı. Bilgilerinizi kontrol edin." |
| Register | all five fields required incl. terms; password meter with 5 rules | Native; no request without terms |
| Verification code | 6 digits, valid 10 minutes, resend after 60 s | Wrong code keeps step 2 |
| Reset password | two matching fields | Mismatch sends nothing; bad token → "Geçersiz veya süresi dolmuş bağlantı." |
| Change e-mail | new e-mail + current password | "Mevcut şifre hatalı." |
| Change password | current + new ×2 | "Şifreler eşleşmiyor." |
| Delete account | must type "hesabımı sil" | Button stays inactive |
| Create book | cover, title, format, ≥1 genre (≤3), description | Toast with the full list + inline messages |
| Chapter title | non-empty | Silently ignored |
| Comment / reply / paragraph comment / session entry / message | non-empty after trimming | Button disabled |
| Quote selection | 10–1000 characters | Nothing under 10 |
| Session | title required; private code ≥ 4 characters | Inline message |
| Session access | reason required | Native |
| Contact | name ≤100, e-mail ≤254, subject ≤150, message ≤5000, all required; hidden honeypot field | Native |
| Newsletter | e-mail + consent | Native |
| Printed book | title, author, publisher, year, pages, format, ≥1 genre, description, evidence URL required; ISBN format checked on lookup | Native; lookup error → B-01 |
| Printed rating | score 1–5 required, review optional | Native |
| Author claim | explanation required, URL optional | Native |
| Print application | print run 1–100000, DPI 300–2400, bleed 3–20 mm, tariff, cover PDF ≤10 MB, three declarations | Button disabled |
| Checkout | donation ₺50–₺100.000 or copies ≥1; address fields and two consents; phone 10–20 characters (server) | Button disabled; server message as toast |
| Admin approval of print application | reason, quote reference, pages 1–20000, 14 money fields, preflight checkbox | Native |
| Admin record edit | reason required | Native |
| Profile edit | username required | Not probed further |
| Author settings | copyright note ≤300, weekly goal number | Not probed further |

Server-only limits listed in Stage 1 (username format, entry length 5000, full-name length) were not probed, except that a 3000-character chat message was accepted.

## Confirmations

| Action | Confirmation |
|---|---|
| Delete chapter | `confirm`: "Bu bölümü silmek istediğinize emin misiniz?" |
| Delete own comment | `confirm`: "Silmek istediğinize emin misiniz?" |
| Publish | `confirm`: "Kitap herkese görünür olacak. Onaylıyor musunuz?" |
| Unpublish | `confirm`: "Kitap yayından kaldırılıp taslağa çekilecek. Onaylıyor musunuz?" |
| Complete writing | `confirm`: "Kitabın yazım aşamasını bitirdiniz mi?" |
| Delete book | `confirm`: "Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?" |
| Close session | `confirm`: "Oturumu kapatmak istediğinize emin misiniz?" |
| Deactivate account | Inline: "Emin misiniz? …" EVET, DEVRE DIŞI BIRAK / VAZGEÇ |
| Delete account | Inline typed phrase |
| **No confirmation:** | delete paragraph comment, delete message, delete session entry, undo repost, cancel follow request, remove bookmark, cancel payment, hide chapter, logout |

## Session and access errors

| Situation | Result |
|---|---|
| Protected page as guest | Redirect to `/login` (admin pages → `/`) |
| Corrupted token, or session invalidated by password reset / e-mail change / password change | First authenticated call fails with `UNAUTHENTICATED` "Giriş yapmalısınız."; storage is cleared; redirect to `/login` |
| Deactivated account | Others get 404 for the profile; signing in reactivates |
| Deleted account | Sign-in refused with the generic message |
| Missing book, user, session, hidden chapter, other's draft | 404 page |
| Missing quote | Inline "Bu alıntı artık mevcut değil veya herkese açık değil." |
| Private session | Code gate |
| Followers-only session as non-follower | Generic load failure (B-02) |
| Private profile | Limited header + explanation; message button disabled |
| Messaging closed by recipient | Toast on send |
| Writing to another author's book | Save-failure badge (B-03) |

## Network errors

| Situation | Result |
|---|---|
| Offline while typing in the editor | Failure badge; recovers after reconnect |
| Offline while changing read state | Stored locally, sent later |
| Offline when opening a page not yet loaded | "Sayfa yüklenemedi / Bağlantınızı kontrol edip sayfayı yeniden yükleyin. / Yeniden yükle" |
| Profile query failure | "Profil yüklenemedi" with retry, home and logout buttons |

## Not tested

Rate limiting (HTTP 429 and its message), production-mode error masking, request time-outs, upload failures, payment provider errors beyond the mock outcomes, WebSocket reconnection after a drop.
