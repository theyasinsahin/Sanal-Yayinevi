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

## Kalan test eksikleri

- Gerçek tarayıcı üzerinde uçtan uca test altyapısı yok. React/JSDOM testleri gerçek mobil tarayıcı, çerez/depolama davranışı, görsel yerleşim ve tarayıcı geri/ileri önbelleğini bütünüyle doğrulamaz.
- Google OAuth yönlendirmesi, Iyzico ödeme başlatma/callback, Cloudinary yükleme ve gerçek SMTP teslimatı için ayrı test ortamında entegrasyon doğrulaması gerekir. Şablon veya mock testleri dış servis başarısının kanıtı değildir.
- Coverage raporunda kapsanmayan ekranlar/işlevler vardır; örneğin bağış/ödeme ekranları, mesajlaşmanın bütün kullanıcı akışları ve bazı ana sayfa/akış bileşenleri. Bunlar için yeni davranış testleri ve ardından tarayıcı testleri önceliklidir.
- Derleme kontrolü testlerden ayrıdır: `npm.cmd --prefix Client run build`. Projedeki mevcut ESLint uyarıları `CI=true` ortamında derlemeyi durdurabilir; testlerin başarılı olması derlemenin de temiz olduğunu göstermez.

## Yayın öncesi manuel kontrol

1. Normal kullanıcıyla giriş yapın, token'ı tarayıcının depolama panelinden kaldırın. Açık ekranda masaüstü/mobil menülerin misafir durumuna geçtiğini ve korumalı sayfaların kapandığını kontrol edin.
2. Oturum izni isteyin. Ayrı admin hesabıyla başvuruyu onaylayın; kullanıcı yeniden giriş yapmadan oturum açabilmeli. İzni kaldırınca yeni oturum oluşturamamalı.
3. Başvuruyu reddedip gerekçenin kullanıcıya göründüğünü ve yeniden başvurunun yeni inceleme olarak ele alındığını doğrulayın.
4. Test ortamında Google girişi, dosya yükleme, e-posta ve ödeme sonucunu gerçek servislerle kontrol edin. Üretim ödemesi oluşturmayın.
