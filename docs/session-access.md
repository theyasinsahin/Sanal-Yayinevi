# Oturum oluşturma izinleri

Oturum oluşturma ücretsizdir; yalnızca yönetici tarafından onaylanmış kullanıcılar yeni yazı oturumu açabilir. Mevcut oturumların görünürlüğü ve katılım kuralları değişmez.

## Akış ve veriler

- Kullanıcı `/sessions` sayfasından 10–1000 karakterlik açıklamayla izin ister.
- `User.sessionCreationAccess`: `NONE → PENDING → APPROVED / REJECTED`. Ret veya izin kaldırma sonrasında yeniden başvuru yapılabilir.
- Başvuru açıklaması, başvuru/karar tarihleri, karar notu, inceleyen yönetici kimliği ve artan revizyon numarası saklanır. Aynı anda yinelenen başvurular tek kayıt olarak kalır.
- Kullanıcı yalnızca kendi başvurusunu görebilir. Admin `/admin/session-access` ekranında başvuruları durum filtresi ve sayfalama ile inceler. Bekleyenlerin sayısı yönetim özetinde gösterilir.
- Onay bekleyen başvurular onaylanabilir veya gerekçeyle reddedilebilir. Onaylı izin gerekçeyle kaldırılabilir. Kaldırma, mevcut oturumları kapatmaz; yeni oturum oluşturmayı engeller.
- Kullanıcı durumu 30 saniyede bir, sekmeye dönüldüğünde ve elle yenilenir. Yeni giriş gerekmez. Backend her oluşturma isteğinde veritabanındaki güncel izni kontrol eder.

## Tutarlılık

Admin işlemleri güncel, aktif yönetici hesabını doğrular. Karar, başvuru revizyonuyla koşullu güncellenir; eski ekrandan verilen karar yeni başvuruyu veya başka yöneticinin kararını ezemez. İzin kararı ve `AdminAudit` kaydı aynı MongoDB transaction'ında yazılır; uygulamanın mevcut admin işlemleri gibi replica set gerektirir. İzin alanları genel kullanıcı düzenleme ekranından değiştirilemez.

## Yayına alma

Önce backend, sonra frontend yayımlanmalı. Eski kullanıcıların eksik izin kaydı `NONE` olarak okunur; veri taşıma komutu gerekmez. `isPremium` tarihsel uyumluluk için tutulur, oturum oluşturma yetkisi sağlamaz ve genel admin ekranından düzenlenemez. Eski Premium kullanıcıları da başvurup onay almalıdır; otomatik izin aktarımı yapılmaz. Ücretli üyelik yönlendirmesi kaldırılmıştır.
