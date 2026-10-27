# Okuduğum Basılı Kitaplar

Profildeki `Dijital Kitaplık`, kaydedilmiş dijital kitapları gösterir. Ayrı `Okuduğum Basılı Kitaplar` sekmesi yalnızca kullanıcının okundu kaydı oluşturduğu basılı kitapları listeler; mevcut kaydedilmiş kitaplardan otomatik okundu kaydı üretilmez.

## Kullanım

Onaylanmış bir basılı kitabın detayında `Okudum ve değerlendirdim` bölümünden 1–5 tam sayı puan seçilir ve isteğe bağlı, en fazla 3000 karakterlik yorum eklenir. `Okudum, kitaplığıma ekle` kitabı profile ekler. Aynı bölümden puan/yorum güncellenebilir veya kayıt kaldırılabilir. Profil sahibi kendi listesinden de kitabı kaldırabilir; düzenleme bağlantısı kitap detayına gider.

Profil kartlarında kitap kapağı, adı, basılı yazar/yayınevi, yıldız puanı, yorum ve okundu olarak eklendiği tarih bulunur. Liste 12 kayıtlık sayfalarla sunulur. İlk eklenme tarihi puan düzenlemelerinde korunur; bu tarih kullanıcının kitabı gerçekten bitirdiğinin doğrulaması değildir. Fiziksel okumaya otomatik puan/rozet verilmez.

## Backend

`PrintedBookReading` koleksiyonu kullanıcı/kitap çiftinde benzersiz indeks taşır. Kayıt ekleme/güncelleme idempotenttir; yinelenen istekler ikinci bir kitap oluşturmaz. Silme ilişkiyi `isDeleted` ile gizler ve diğer kullanıcıların kayıtlarına dokunmaz. Yeniden ekleme aynı ilişkiyi kullanır.

- `myPrintedBookReading(bookId)` yalnızca giriş yapan kişinin kaydını verir.
- `savePrintedBookReading(bookId, rating, review)` giriş yapan aktif kullanıcının değerlendirmesini kaydeder.
- `removePrintedBookReading(bookId)` yalnızca kişinin kendi kaydını kaldırır.
- `getPrintedReadings(userId, page)` profil kitaplığını sayfalı getirir.

Yalnızca onaylanmış, yayında olan `PRINTED` kitaplara kayıt eklenebilir. Yayından kaldırılmış/onaysız kitaplar liste ve toplamlarından çıkarılır. Geçersiz puan, yorum ve kimlikler backend'de doğrulanır. Kullanıcı ve görüntüleyenin güncel hesap durumu veritabanından okunur.

## Gizlilik ve yönetim

Liste mevcut `isProfilePublic` ve `isLibraryPublic` ayarlarına uyar. Kendi kitaplığını görme ve onaylı takipçi erişimi mevcut profil kurallarıyla aynıdır. Gizli kitaplığın içerikleri, puanları, yorumları ve toplamı API'den de verilmez (`canView: false`).

Admin panelindeki `Bütün Veriler → Okunan basılı kitaplar` üzerinden uygunsuz kayıtlar yayından kaldırılabilir. Kullanıcı değerlendirmeyi yeniden kaydederek yönetim kararını aşamaz. Adminin genel veri inceleme yetkisi ayrı kalır; profil liste API'si kitaplık gizliliğini korur.

## Yayına alma ve test

Yeni koleksiyon ilk kullanımda oluşur; eski kullanıcılar boş fiziksel kitaplıkla başlar. Veri taşıma komutu gerekmez. Backend frontend'den önce yayımlanmalıdır.

```powershell
npm.cmd --prefix Server run test:ci -- tests/printedReadings.test.js
npm.cmd --prefix Client run test:ci -- --runTestsByPath src/components/Books/PrintedReadingEditor/PrintedReadingEditor.test.jsx src/components/Books/PrintedReadingLibrary/PrintedReadingLibrary.test.jsx src/pages/UserProfilePage/UserProfile.test.jsx
```
