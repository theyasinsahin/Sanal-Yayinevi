# Kitap editöründe otomatik kayıt

Metin değişiklikleri, son düzenlemeden 1,5 saniye sonra mevcut `updateChapter` mutasyonu üzerinden kaydedilir. Kesintisiz yazımda en geç 10 saniyede bir kayıt başlatılır. Aynı editör oturumundaki istekler sırayla gönderilir; bir kayıt sürerken yazılan metin korunur ve sonraki kayıtta gönderilir. Bölüm kimliği ve gönderilen metin istek başında sabitlenir.

Kaydet düğmesi bekleme süresini atlar. Bölüm değiştirme, ekleme, silme, yayın durumunu değiştirme ve baskı maliyeti hesaplama işlemleri önce bekleyen kayıtları tamamlar. Sayfa sayısı mevcut sayfalama hesabıyla birlikte kaydedilir. Kitabın tekrar sorgulanması, oturum içinde düzenlenen metni eski sunucu verisiyle değiştirmez.

Editörde bekleyen kayıt, devam eden kayıt, başarı ve hata durumları gösterilir. Hata durumunda metin bellekte tutulur; Kaydet düğmesiyle, yeni bir düzenlemeyle veya bağlantı geri geldiğinde yeniden denenir. Başarısız istekler sürekli tekrarlanmaz.

Uygulama içi sayfa geçişi kaydı bekler. Kayıt başarısızsa kullanıcı ayrılmayı iptal edebilir. Sekme gizlendiğinde kayıt başlatılır; sekme kapatılırken veya yenilenirken bekleyen değişiklikler varsa tarayıcıdan ayrılma uyarısı istenir. Tarayıcı veya işletim sistemi zorla kapatılırsa ağ isteğinin tamamlanması garanti edilemez; taslaklar kalıcı bir çevrimdışı depoda tutulmaz.

Doğrulama: `chapterAutosave.test.js`, `useChapterAutosave.test.js`, `BookDashboard.test.jsx` ve sunucudaki `chapterResolvers.test.js`. Testler ilk düzenlemeyi, gecikmeyi, kesintisiz yazımı, eşzamanlı düzenlemeleri, geri alma davranışını, hata/yeniden denemeyi, boş metni, bölüm geçişini, ekleme/silmeyi, yayınlamayı, maliyet hesabını ve sayfadan ayrılmayı kapsar.
