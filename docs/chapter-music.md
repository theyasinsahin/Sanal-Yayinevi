# Bölüm müziği

Her dijital bölüm isteğe bağlı tek MP3 parçası içerebilir. Yazar veya yönetici,
bölüm editöründeki müzik panelinden dosya yükler, önizler, değiştirir veya kaldırır.
İlk sürüm YouTube/Spotify bağlantısı, çalma listesi, paragraf senkronizasyonu ve
arka planda sistem oynatımı içermez.

## Yerel deneme

Docker Desktop ve WSL entegrasyonu açıkken proje kökünden `./dev up` çalıştırın.
`docker/.env.local` içinde `DEV_EXTERNAL_INTEGRATIONS=true`, `CHAPTER_MUSIC_ENABLED=true` ve Cloudinary için
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` dolu olmalı.
Anahtarlar yalnız backend'e aktarılır; unsigned görsel preset'i ses için kullanılmaz.
Üretim ayarlarını buraya kopyalamayın. Mevcut dosyadaki anahtarlar değiştirilmez.

1. http://localhost:3000 adresinde `author@betik-dev.invalid` ile giriş yapın.
   Parola yerel ayarlardaki `DEV_SEED_PASSWORD` değeridir.
2. **Docker Örnek Hikâye → Örnek bölüm 1** bölümünü düzenleyin.
   Standart yerel seed bu kitabı ve bölümü yoksa oluşturur, mevcut düzenlemeleri
   değiştirmez. Başka birinin kitabı yerine bu demo yazar hesabını kullanın.
3. En fazla 15 MiB ve 10 dakika uzunluğunda, kullanım hakkına sahip olduğunuz bir
   MP3 seçin; hak onayını verip yükleyin.
4. Okuma ekranında müziği elle başlatın. Bölüm değiştirince veya okuyucudan çıkınca
   ses durmalıdır. Müziği kaldırınca bölüm metni korunmalıdır.

Dosya yükleme Cloudinary bağlantısı gerektirir; demo kitap için hazır müzik
yüklenmez ve üçüncü taraf şarkı kopyalanmaz. Gizli bölüm ve misafir erişim
sınırlarını denemek için aynı kitaptaki diğer örnek bölümler kullanılabilir.

## Davranış ve sınırlar

- Bölüm metninin otomatik kaydı ile müzik yükleme ayrı işlemlerdir.
- Okuyucu sesini kendisi başlatır. Oynatıcı ilerletme, duraklatma, ses ve isteğe
  bağlı döngü kontrolü sunar; müziksiz bölümlerde gösterilmez.
- Eski bölümler müzik eklenmeden çalışmaya devam eder; toplu migration gerekmez.
- Sunucu kitap sahipliğini ve bölüm erişimini kontrol eder; dosya boyutu, biçimi
  ve süresi sağlayıcı yanıtıyla doğrulanır. İstemciden keyfi müzik URL'si alınmaz.
- Cloudinary yüklemeleri backend üzerinden imzalanır. API secret'ı frontend
  yapılandırmasına veya `REACT_APP_*` değişkenlerine koymayın.
- Parça değiştirme/kaldırma sonrası eski dosya için temizlik denenir. Sağlayıcı
  kesintisinde artık dosyalar kalabilir; hesap kullanımını izleyin.
- Gizli bölümün müzik alanı yetkisiz API yanıtlarında gösterilmez. Daha önce
  edinilmiş Cloudinary bağlantıları geri alınabilir DRM değildir; bu sürüm özel,
  kısa ömürlü imzalı medya teslimi sunmaz.
- Web ve Android WebView aynı oynatıcıyı kullanır; kilit ekranı/arka plan ses
  hizmeti ve çevrimdışı müzik indirme kapsam dışındadır. Fiziksel Android cihaz
  doğrulaması ayrıca yapılmalıdır.

Cloudinary sesleri `video` kaynak türüyle işler:
[ses dokümantasyonu](https://cloudinary.com/documentation/audio_transformations).
Tarayıcı sesli otomatik oynatımı sınırlayabilir:
[MDN autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

## Doğrulama (12 Kasım 2026)

- İzole Docker testlerinde backend: 8 grup / 80 test başarılı (müzik servis,
  HTTP, gerçek geçici veritabanı, görünürlük, misafir sınırı ve mevcut bölüm akışları).
- Frontend: 6 grup / 65 test başarılı (yükleme/kaldırma, sınırlar, hata,
  oynatıcı, bölüm geçişi ve mevcut otomatik kayıt).
- Backend/frontend lint: hata yok; proje genelinde önceden bulunan 12 frontend
  uyarısı sürüyor. Frontend üretim derlemesi başarılı, mevcut uyarılar sürüyor.
- Yerel servisler sağlıklı. Demo bölümün GraphQL müzik alanı, yapılandırmanın
  backend'e aktarılması ve hak onayı olmayan yüklemenin reddi doğrulandı.
- Gerçek Cloudinary dosya yüklemesi ve fiziksel Android cihaz testi yapılmadı;
  sağlayıcı yanıtları otomatik testlerde taklit edildi. Yerel demo bölüme hazır
  müzik eklenmedi; kullanım hakkına sahip olduğunuz MP3 ile deneyebilirsiniz.
