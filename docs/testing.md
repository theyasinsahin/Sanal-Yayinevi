# Testleri çalıştırma

Komutları proje ana klasöründe (`Betik`) PowerShell ile çalıştırın. Windows'ta yürütme ilkesi `npm.ps1` dosyasını engelleyebildiği için örnekler `npm.cmd` kullanır. Diğer işletim sistemlerinde `npm` yazabilirsiniz.

## İlk kurulum

Node.js ve npm kurulu olmalı. Bağımlılıklar henüz kurulmamışsa:

```powershell
npm.cmd --prefix Server ci
npm.cmd --prefix Client ci
```

Backend testleri `mongodb-memory-server` ile geçici, ayrı bir MongoDB replica set başlatır. Uygulama sunucusunu veya yerel MongoDB servisini çalıştırmanız gerekmez. İlk çalıştırmada MongoDB test ikilisinin indirilmesi için internet gerekebilir. Bu test ikilisi sonraki çalıştırmalarda önbellekten kullanılır.

Testlerin kendi test veritabanı, JWT anahtarı veya mock kullandığı akışlarda canlı hesap/ödeme bilgisi girmeniz gerekmez. Gerçek Google girişi, ödeme sağlayıcısı, SMTP teslimatı ve dosya yükleme için aşağıdaki manuel kontroller ayrıdır.

## Bütün otomatik testler

```powershell
npm.cmd --prefix Server run test:ci
npm.cmd --prefix Client run test:ci
```

`test:ci`, izleme moduna girmeden bir kez çalışır. `--runInBand` test dosyalarını sırayla çalıştırır; her backend test grubunun geçici veritabanı başlatması nedeniyle bu mod yerelde daha az kaynak kullanır. İkinci komut birinci komutun başarısızlığını gizleyebileceğinden her komutun sonucunu ayrı kontrol edin. PowerShell'de son komutun çıkış kodu `$LASTEXITCODE` ile görülebilir; başarılı sonuç `0` olur.

Sadece test özeti için komutların sonuna `-- --silent` ekleyebilirsiniz. Bu seçenek testleri atlamaz; test içindeki konsol çıktılarını bastırır. İlk hata incelemesinde `--silent` kullanmayın.

## Seçili testler

JWT doğrulama ve oturum oluşturma izinleri:

```powershell
npm.cmd --prefix Server run test:ci -- tests/authentication.test.js tests/sessionAccess.test.js
```

Arayüzde otomatik çıkış, gerçek masaüstü/mobil menüler ve admin sayfası koruması:

```powershell
npm.cmd --prefix Client run test:ci -- --runTestsByPath src/context/AuthContext/AuthContext.test.jsx src/components/Navigation/NavigationBar/NavigationBar.test.jsx src/components/Route/AdminRoute.test.jsx src/utils/authLink.test.js
```

Backend performans regresyonları:

```powershell
npm.cmd --prefix Server run test:performance
```

Bu testler sorgu sayıları ve veri büyüklükleri gibi yapısal sınırları kontrol eder; gerçek sunucu üzerinde yük testi yerine geçmez.

## Test kapsamı raporu

```powershell
npm.cmd --prefix Server run test:coverage
npm.cmd --prefix Client run test:coverage
```

Terminalde satır, dal, fonksiyon ve ifade kapsamı gösterilir. Tarayıcıda dosya/satır bazında incelemek için raporları açın:

```powershell
Start-Process .\Server\coverage\index.html
Start-Process .\Client\coverage\index.html
```

Makineyle okunabilir özetler `Server/coverage/coverage-summary.json` ve `Client/coverage/coverage-summary.json` içindedir. Backend raporu `src` altındaki JavaScript dosyalarını içerir; operasyonel `src/scripts` komutları hariçtir. Frontend raporu Create React App'in kaynak kapsamı kurallarını kullanır. Raporlar Git'e eklenmez.

Kapsam yüzdesi tek başına doğruluğu kanıtlamaz. Özellikle mock kullanılan bir test, gerçek dış servis bağlantısının çalıştığını göstermez. Henüz bütün projeyi temsil edecek kapsam eşiği belirlenmediği için düşük kapsam testleri otomatik olarak başarısız yapmaz.

### 31.10.2026 doğrulama sonucu

| Paket | Önce | Son doğrulama | Satır kapsamı önce → sonra |
| --- | ---: | ---: | ---: |
| Sunucu | 348 test | 38 dosyada 600 test geçti | %82,60 → %89,80 |
| Arayüz | 296 test | 70 dosyada 455 test geçti | %59,45 → %78,65 |
| Edge masaüstü ve telefon boyutu | Yok | 6 tarayıcı testi geçti | Ayrı ölçülür |

Toplam 417 yeni test senaryosuyla 1.061 test geçti. Bunların 179'u istemci GraphQL işlemlerinin gerçek şemayla uyumunu denetler. Üretim derlemesi tamamlandı; projedeki mevcut bağımlılık/lint uyarıları devam ediyor. Değiştirilen istemci JavaScript dosyalarının ayrı lint kontrolü hatasız tamamlandı.

Testlerin yakaladığı ve regresyon testleriyle düzeltilen davranışlar: populate edilmiş yazar kimliklerinin yüklenmesi, canlı mesajın gönderici/kitap eki bilgilerinin serileştirilmesi, kapalı özel oturuma yeni ileti kabul edilmemesi, başarısız oturum iletisinde taslağın korunması, iç içe profil bağlantıları, boş son sayfadan sonra sayfalamanın durması, bildirimlerin birbirinden bağımsız süreleri ve eski yorum/işlem sorgularının şema uyumu.

## Geliştirme sırasında izleme

```powershell
npm.cmd --prefix Client test
npm.cmd --prefix Server test -- --watchAll
```

Bu komutlar açık kalır; testlerden çıkmak için `Ctrl+C` kullanın. Kapsam ölçümü veya tek seferlik doğrulama için `test:ci` / `test:coverage` kullanın.

## Kapsanan kritik senaryolar

- Gerçek imzalı JWT: süresi dolmuş, bozuk, yanlış imzalı ve henüz geçerli olmayan token; silinen/pasif hesap; değişmiş `authVersion`; veritabanındaki güncel rol; parolanın dışarı çıkmaması.
- Otomatik çıkış: token silinmesi/süresinin dolması, sekmeler arası değişiklik, gecikmiş yanıtlar, geçici bağlantı hataları; gerçek masaüstü ve mobil menülerde özel seçeneklerin kaybolması.
- Admin sayfası koruması: misafir/normal kullanıcı yönlendirmesi, doğrulama sürerken içeriğin gizli kalması, açık sayfada oturum veya rol kaybı.
- Ücretsiz oturum izni: başvuru–onay–oluşturma, ret–yeniden başvuru, izin kaldırma, başvuru gizliliği, sayfalama, çift istek, eşzamanlı kararlar ve işlem geçmişinin atomik kaydı.
- Mevcut testler ayrıca kitap/bölüm işlemleri, otomatik kayıt, basılı kitap ve hak talepleri, okuma ilerlemesi/puanlar, takip ve gizlilik, paylaşım, e-posta şablonları ve admin işlemlerini kontrol eder.

## Genişletilen davranış testleri

| Alan | Denetlenen davranışlar |
| --- | --- |
| Mesajlaşma | Konuşmayı yeniden kullanma, katılımcı yetkisi, alıcı gizliliği, okunmamış sayıları, düzenleme/silme, sayfalama, gerçek GraphQL aboneliği, gönderici ve kitap eki serileştirmesi |
| İstemci mesaj önbelleği | İyimser ekleme ve başarısız istekte geri alma, tekrarlanan canlı iletileri ayıklama, son sayfada durma, konuşma önizlemesini güncelleme |
| Oturumlar | Erişim kodu, takipçi erişimi, kapatma, katılımcı sayısı, ileti silme/beğenme, etiketleme bildirimleri, hesap silme temizliği, başarısız gönderimde taslağı koruma |
| Yorumlar ve takip | Paragraf eşleştirmesi, görünürlük, beğeni/silme yetkileri, paragraf sayıları, kitap takip sayıları ve yeni bölüm bildirimleri |
| Alıntılar | Beğeni/bildirim tercihleri, yorumlar, yeniden paylaşma ve geri alma, silme temizliği, kitap bazında önbellek geçersizleştirme, arama ve sonsuz kaydırma |
| Hesap | Giriş/kayıt, e-posta kodu, parola kuralları, şifre sıfırlama, Google dönüşü, hesap devre dışı bırakma/silme onayı ve başarısız işlemlerde oturumu koruma |
| Okuma ve keşif | Filtreler ve sıralama, kanonik profil/kitap yolları, dönüş adresi, HTML sayfalama, ayraç ve okuma geçmişi, tercihler ve öneriler |
| Bildirim ve arayüz | Bağımsız bildirim süreleri, okundu işaretleme hatası, lider tablosu, PWA kurulum adımları, okuma boyutu ve tercih kalıcılığı |
| API sözleşmesi | İstemci kaynaklarındaki adlandırılmış GraphQL işlemlerini gerçek sunucu şemasına karşı doğrulama; Google HTTP callback alan sınırları ve eski ödeme callback'inin kapalı kalması |

Sunucu testleri işlemleri gerçek şema ve geçici MongoDB üzerinde yürütür. İstemci testlerinde Apollo'nun gerçek önbelleği ve `MockedProvider` kullanılır; sayfaya özgü testlerde bağımsız veri hook'ları gerektiğinde kontrollü sınırlar olarak değiştirilir. HTML sayfalama testindeki `innerText` desteği JSDOM için sağlanır; bu, gerçek piksel ölçümü değildir.

## Gerçek tarayıcı testleri

```powershell
npm.cmd --prefix Client run test:e2e
```

Playwright testleri Windows'ta kurulu Microsoft Edge'i kullanır. Diğer sistemlerde ilk çalıştırmadan önce `Client` klasöründe `npx playwright install chromium` çalıştırın.

Test komutu kendine ait geliştirme sunucusunu `http://127.0.0.1:3100` üzerinde başlatır ve sonunda kapatır; bu port boş olmalıdır. Kullanıcının 3000 portundaki geliştirme sunucusu yeniden kullanılmaz. Gerçek uygulama masaüstü ve telefon ekranlarında açılır. Destek ve ödeme geçmişi başlıklarının navbar altında kalması, yatay taşma, bağlantı stilleri, geri gezinme ve misafir yönlendirmesi denetlenir.

Tarayıcı testleri yalnızca örnek kullanıcı/ödeme verileri kullanır. HTTP API yanıtları yakalanır ve dış istekler engellenir; bunlar gerçek ödeme, Google veya SMTP hesabıyla yapılan uçtan uca testler değildir. Birim/entegrasyon kapsam yüzdelerine tarayıcı testleri dahil edilmez. Başarısız koşuların ekran görüntüsü/izleri `Client/test-results`, HTML raporu `Client/playwright-report` altında tutulur; bu klasörler Git'e eklenmez.

## Kalan test eksikleri

- Playwright'ın masaüstü/telefon testleri Edge/Chromium ile sınırlıdır. Gerçek iOS/Safari, Android cihazı, tam uygulama–sunucu akışı ve bütün sayfaların görsel regresyonları henüz kapsanmaz.
- Google OAuth yönlendirmesi, Iyzico ödeme başlatma/callback, Cloudinary yükleme ve gerçek SMTP teslimatı için ayrı test ortamında entegrasyon doğrulaması gerekir. Şablon veya mock testleri dış servis başarısının kanıtı değildir.
- Kapsam raporunda henüz çalıştırılmayan dallar bulunabilir. Özellikle dış servislerin gerçek hata yanıtları, cihaz özellikleri ve operasyonel scriptler için yüzde yüz kapsam iddiası yoktur; yeni hata düzeltmelerine davranış testi eklenmelidir.
- Derleme kontrolü testlerden ayrıdır: `npm.cmd --prefix Client run build`. Projedeki mevcut ESLint uyarıları `CI=true` ortamında derlemeyi durdurabilir; testlerin başarılı olması derlemenin de temiz olduğunu göstermez.

## Yayın öncesi manuel kontrol

1. Normal kullanıcıyla giriş yapın, token'ı tarayıcının depolama panelinden kaldırın. Açık ekranda masaüstü/mobil menülerin misafir durumuna geçtiğini ve korumalı sayfaların kapandığını kontrol edin.
2. Oturum izni isteyin. Ayrı admin hesabıyla başvuruyu onaylayın; kullanıcı yeniden giriş yapmadan oturum açabilmeli. İzni kaldırınca yeni oturum oluşturamamalı.
3. Başvuruyu reddedip gerekçenin kullanıcıya göründüğünü ve yeniden başvurunun yeni inceleme olarak ele alındığını doğrulayın.
4. Test ortamında Google girişi, dosya yükleme, e-posta ve ödeme sonucunu gerçek servislerle kontrol edin. Üretim ödemesi oluşturmayın.
