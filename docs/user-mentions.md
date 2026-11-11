# Kullanıcı etiketleme

Oturum açıklamalarında ve iletilerinde, dijital/basılı kitap yorumlarında ve yanıtlarında, paragraf yorumlarında, alıntı notlarında ve yeniden paylaşım yorumlarında `@` yazarak kullanıcı seçilebilir. Liste kullanıcı adı veya ad soyad ile aranır. Ok tuşlarıyla seçim yapılır; Enter, Tab veya dokunma seçili kullanıcıyı ekler. Escape listeyi kapatır. Etiketler profil bağlantısı olarak gösterilir.

Bir hesap herkese açıksa veya etiketleyen kullanıcıyı takip ediyorsa etiketlenebilir. Sunucu, elle yazılan kullanıcı adlarında da aynı kuralı uygular. Kullanıcının kendisine, silinmiş ya da pasif hesaplara bildirim gönderilmez. Tek içerikte aynı alıcıya bir bildirim gider; en fazla 30 farklı etiket işlenir, öneri listesi en fazla 8 hesap gösterir. E-posta adresleri ve URL içindeki `@` işaretleri etiket sayılmaz.

Kitap yorumunda **Yanıtla** seçildiğinde yanıt alanına hedef yorumun yazarının
`@kullanıcıadı` etiketi otomatik eklenir. Sunucu da bu etiketi kayıtta tamamlar;
alan temizlenmiş veya eski istemciden gönderilmiş olsa bile yanıt ilgili kişiyi
etiketler. Ana yoruma ve bir yanıtın altına yazarken doğrudan cevap verilen kişi
kullanılır. Metinde aynı etiket zaten varsa tekrarlanmaz; diğer etiketler ve
bildirim/gizlilik tercihleri korunur. Yalnız etiket içeren boş yanıt gönderilemez.
Yanıt alanını kapatıp açmak taslağı korur. Yazarı bulunmayan veya pasif bir
yorum için geçersiz etiket oluşturulmaz.

Bildirim tıklandığında ilgili ileti veya yorum açılır, ekrana kaydırılır ve odaklanır. Oturumun ilk 30 iletisinde bulunmayan hedef ileti ayrıca yüklenir. Paragraf yorumunda doğru bölüm ve paragraf paneli, alıntı yorumunda yorum listesi açılır. Mobil bildirimden geçişte menü kapanır.

Etiket, içeriğin erişim koşullarını değiştirmez. Takipçilere özel oturumlarda yalnızca oturum sahibinin takipçilerine; özel oturumlarda yalnızca mevcut katılımcılara bildirim gönderilir. Gizli bölüm yorumları için alıcının bölüm erişimi denetlenir. “Sadece ben” alıntı notları bildirim üretmez. Sonradan erişimi kaldırılan veya silinen içerik, bağlantıdan yeniden açılmaya çalışıldığında mevcut erişim denetimlerine tabidir.

Bildirim ayarlarında “Oturumda Bahsedilme” ve “Yorum ve Alıntıda Etiketlenme” ayrı ayrı kapatılabilir. Yeni yorum tercihi varsayılan olarak açıktır; mevcut hesaplar Mongoose varsayılanlarını kullanır, veri göçü gerekmez. Kitap yazarı veya oturum katılımcısı aynı içerik için etiket bildirimi aldıysa ikinci bir genel yorum/ileti bildirimi gönderilmez.

## Doğrulama

Sunucu testleri geçici MongoDB üzerinde; arayüz ve tarayıcı testleri örnek hesap/veriler ile çalışır. Üretim veritabanı veya dış servisler kullanılmaz.

4 Kasım 2026 doğrulaması: ilgili 12 sunucu dosyasında 313 test, 16 arayüz dosyasında 140 test ve masaüstü/mobilde 4 tarayıcı senaryosu geçti. Değişen 21 istemci uygulama dosyasının ESLint kontrolü hatasız ve uyarısız tamamlandı. Üretim derlemesi başarılı; önceki mesajlaşma/giriş/alıntı sayfalarındaki mevcut lint ve Create React App bağımlılık uyarıları sürüyor.

```powershell
npm.cmd --prefix Server run test:ci -- tests/mentions.test.js tests/sessionLifecycle.test.js tests/paragraphComments.test.js tests/quoteInteractions.test.js tests/resolvers/commentResolvers.test.js tests/profileSettings.test.js tests/quotePrivacy.test.js tests/chapterVisibility.test.js tests/sessionAccess.test.js tests/securityRegression.test.js tests/clientGraphqlDocuments.test.js tests/clientQueryBudget.test.js
npm.cmd --prefix Client run test:ci -- --runTestsByPath src/components/Mentions/Mentions.test.jsx src/pages/SessionDetail/SessionDetail.test.jsx src/components/Comments/CommentItem/CommentItem.test.jsx src/components/ParagraphComment/ParagraphCommentPanel/ParagraphCommentPanel.test.jsx src/components/ParagraphComment/ParagraphRenderer/ParagraphRenderer.test.jsx src/components/Quote/QuoteCard/QuoteCard.test.jsx src/components/Quote/QuotePopup/QuotePopup.test.jsx src/components/Settings/Settings.test.jsx src/components/Notification/NotificationBell/NotificationBell.test.jsx src/pages/SessionsPage/SessionsPage.test.jsx src/pages/BookDetail/BookDetail.test.jsx src/pages/BookReader/BookReader.test.jsx src/pages/PrintedBooks/PrintedBooks.test.jsx src/pages/QuotesPage/QuotesPage.test.jsx src/hooks/useSessions.test.jsx src/components/Navigation/NavigationBar/NavigationBar.test.jsx
npm.cmd --prefix Client run test:e2e -- e2e/mentions.spec.cjs e2e/book-reader.spec.cjs --grep mention
npm.cmd --prefix Client run build
```
