# Docker ile yerel geliştirme

Bu yapı yalnız yerel geliştirme ve otomatik doğrulama içindir. Render/Vercel,
canlı Atlas ve mevcut deployment ayarlarını değiştirmez. Node 26.13.0 ve npm
11.13.0 konteynerlerde sabittir; Ubuntu'ya Node, Java veya MongoDB kurulmaz.

## İlk çalıştırma

Windows'taki VS Code ile WSL: Connect to WSL using Distro komutundan
Ubuntu-24.04'e bağlanın ve /home/yasinsahin/projects/Betik klasörünü açın.
Windows'taki code komutu Cursor'a yöneliyorsa VS Code'u Başlat menüsünden açın.
Proje /mnt/c altında çalıştırılmaz.

Ubuntu terminalinde proje klasöründen:

    ./dev init
    ./dev doctor
    ./dev up

Arayüz http://localhost:3000, API http://localhost:5000 adresindedir.
MongoDB hosta açılmaz. Servisler hazır olana kadar up komutu bekler.
İlk açılış bağımlılık ve imaj indirmeleri nedeniyle daha uzun sürebilir.

    ./dev logs server
    ./dev logs client
    ./dev down

down veritabanı veya bağımlılık volume'larını silmez. Genel Docker prune
komutları bu akışın parçası değildir.

## Yeni yerel ayarlar

./dev init yalnız docker/.env.example şablonundan docker/.env.local oluşturur.
Root .env, Compose'un aynı dosyayı okuyabilmesi için bu dosyaya yerel symlink'tir.
Önceden var olan ilgisiz bir root .env üzerine yazılmaz.
Dosya 0600 izinlidir ve Git/Docker context dışında tutulur.

JWT_SECRET, PRINT_SANDBOX_WEBHOOK_SECRET, PRINT_ADDRESS_ENCRYPTION_KEY ve
DEV_SEED_PASSWORD birbirinden bağımsız üretilir. Tekrar init çalıştırmak
anahtarları değiştirmez. Özellikle adres şifreleme anahtarını volume kullanılırken
yenilemeyin. Eski Server/.env veya Client/.env dosyalarını buraya kopyalamayın.
Veri volume'u mevcutken ayar dosyası kaybolursa init yeni anahtar üretmez;
önce özgün geliştirme ayarları geri yüklenmelidir. Veri yedeğiyle birlikte bu
dosyayı ayrı ve erişimi kısıtlı bir yerde koruyun.
Değerleri sohbet, PR, log veya CI secret'ı olarak paylaşmayın.

Metadata olarak LOCAL_UID, LOCAL_GID, DOCKER_GID ve BETIK_WORKSPACE_PATH
bulunduğunuz Linux ortamından yazılır. Her servise yalnız açıkça listelenmiş
environment değişkenleri verilir; backend parolaları frontend'e verilmez.
Web servisleri yalnız kendi kaynak klasörünü salt okunur bağlar; ortak gizli
ayar dosyası bu konteynerlerin dosya sisteminde bulunmaz. Düzenleme çalışma
konteynerinden yapılır; Node bağımlılık volume'ları yazılabilir kalır.
REACT_APP değişkenlerinin tarayıcı paketinden görülebildiğini unutmayın.

## Örnek hesaplar ve veriler

Yerel hesaplar admin@betik-dev.invalid, author@betik-dev.invalid,
reader@betik-dev.invalid ve publisher@betik-dev.invalid adreslerindedir.
Ortak demo parolası yalnız yerel ayar dosyasındaki DEV_SEED_PASSWORD değeridir.
Bu hesaplardan e-posta gönderilmez.

Seed; üç açık bölümlü ve başında gizli bölümü olan kitap, taslak, basılı kitap,
yerel sandbox tarifesi ve artifacts/development altında örnek PDF'ler oluşturur.
Gerçek ödeme, eser veya teslimat içermez. ./dev seed tekrar çalıştırıldığında
mevcut hesap parolalarını, kitapları, bölüm görünürlüğünü ve tarifeleri değiştirmez.
Basım akışları için docs/print-funding.md ve mevcut sandbox rehberi kullanılabilir.

## İzole otomatik kontroller

    ./dev check
    ./dev test server
    ./dev test client
    ./dev test lint
    ./dev test e2e

Yerel ve CI aynı compose.test.yaml dosyasını kullanır. Test konteynerlerinde
dış ağ kapalıdır; geçici MongoDB ve test HTTP/WS/SMTP sunucuları aynı konteynerde
loopback üzerinden çalışır. Geliştirme volume'u, kaynak bind mount'u, gerçek
environment dosyaları ve Docker socket testlere verilmez.

MongoDB 8.0.34 ve Playwright'ın kilitli sürümüne ait Chromium imaj hazırlanırken
indirilir. Test sırasında yeni indirme yapılmaz. Çıktılar artifacts klasöründedir.
Frontend lint hataları CI'yi durdurur; mevcut uyarılar raporlanır.
CRA build adımında CI=false yalnız mevcut build uyarıları için kullanılır.

GitHub Actions main/develop push ve bu dalları hedefleyen PR'larda yalnız
lint/test/build çalıştırır. Deploy, migration, gerçek seed veya servis secret'ı
kullanmaz. Fork PR'ları için pull_request_target kullanılmaz.
Manuel workflow başlatma GitHub'ın varsayılan dalda workflow bulunması şartına
tabidir; bu çalışma tek başına main'e birleştirme veya yayın yetkisi vermez.

## Dev Container ve Docker socket

Dev Containers: Reopen in Container komutunu kullanın. initializeCommand yerel
ayarları hazırlar. Çalışma yolu host ve konteynerde aynı mutlak Linux yoludur;
bu sayede konteynerden Compose çağırmak yanlış source mount'u oluşturmaz.

Socket yalnız .devcontainer/compose.yaml içindeki workspace servisine verilir.
Normal web, MongoDB, test ve Android servisleri bu erişimi almaz.
Socket, Docker engine ve engine'in erişebildiği dosyalar üzerinde geniş yönetim
yetkisi verir. Non-root veya read-only socket mount'u bu API yetkisini sınırlamaz.
Bu çalışma alanını yalnız güvenilen kod ve eklentilerle açın.

Ubuntu kullanıcı parolasını terminalinizde belirlemek için Windows'tan:

    wsl -d Ubuntu-24.04 -u root -- passwd yasinsahin

Parolayı yalnız açılan terminalde yazın. Proje için sudo grubu verilmez.

## Manuel dış servis kontrolleri

Temel kurulumda DEV_EXTERNAL_INTEGRATIONS=false olduğu için Google, SMTP ve
Cloudinary kapalıdır. Eksik ayarlar canlı hesaplara düşmez.
Gerçek entegrasyon kontrolleri otomatik testlerden ayrıdır.

1. Ayrı geliştirme Gmail hesabında iki adımlı doğrulama ve uygulama parolası
   hazırlayın. EMAIL_USER, EMAIL_PASS ve CONTACT_EMAIL yalnız bu hesaba ait olsun.
2. Ayrı Google projesinde web OAuth istemcisi oluşturun. JavaScript origin'leri
   http://localhost ve http://localhost:3000; callback
   http://localhost:5000/auth/google/callback olsun.
3. Ayrı Cloudinary hesabında JPEG/PNG/WebP allowed_formats,
   disallow_public_id=true, unique_filename=true ve overwrite=false kullanın.
   Gelen görsel boyutlarını sınırlandırın; gereksiz eager/ücretli işlemler açmayın.
4. Yeni yerel dosyaya GOOGLE_CLIENT_ID, CLOUDINARY_CLOUD_NAME ve
   CLOUDINARY_UPLOAD_PRESET değerlerini girin. DEV_EXTERNAL_INTEGRATIONS=true
   yapıp ./dev up ile servisleri yenileyin.
5. Kendi geliştirme e-postanızla kayıt/doğrulama, Google dönüşü ve görsel yükleme
   deneyin. Cloudinary preset'ini yalnız bu test penceresinde unsigned yapın,
   test bitince tekrar kapatın.

CLOUDINARY_API_SECRET bu akışta kullanılmaz ve frontend'e aktarılmaz.
NEXT_PUBLIC_API_URL Next.js adlandırmasıdır; bu CRA projesinde kullanılmaz.
Preset yoksa geliştirme görsel yükleme kapalı kalır.

Preset, API secret'tan farklıdır. Cloudinary Console → Settings → Upload →
Upload presets → Add upload preset bölümünde oluşturulur; yalnız test sırasında
signing mode unsigned seçilir. Kopyalanacak değer preset'in adıdır.
Bu adımı ertelemek yerel giriş ve okuma özelliklerini engellemez.

Unsigned preset herkese açık istemci bilgisidir. Preset başına dosya boyutu
sınırı desteklenmez; uygulamadaki 8 MB denetimi doğrudan API çağrılarını engellemez.
Bu kısıtlar yetkilendirme veya kesin kötüye kullanım koruması sayılmaz. Hesap
kullanım bildirimlerini açın ve gerçek geliştirme preset'ini CI/preview'e koymayın.
Üretim Cloudinary ayarları bu çalışma kapsamında değiştirilmez.

## Veri yedeği ve geri dönüş

Yalnız yerel veriyi, proje klasöründen:

    docker compose -p betik-dev exec -T mongo mongodump --db betik_dev --archive > artifacts/betik-dev.archive

Geri yükleme yalnız bu yerel veritabanına yapılır; --drop kullanılmaz:

    docker compose -p betik-dev exec -T mongo mongorestore --nsInclude='betik_dev.*' --archive < artifacts/betik-dev.archive

Bu dosyalar yerel geliştirme verisidir; Git'e veya CI artifact'ına eklemeyin.
Aktif geliştirme klasörü değiştirilmeden önce değişiklikler ayrıca yedeklenir.
Başarısız bir aşamada servisleri durdurun; volume silmeden son çalışan
yapılandırmaya dönün. Korunan Windows klasörü geri dönüş seçeneğidir.

## Aşama kabulü ve geri dönüş

| Aşama | Kabul | Başarısızlıkta |
| --- | --- | --- |
| Yedek | Tüm worktree dosyaları, index, refs ve Git nesneleri bağımsız geri yükleme provasında eşleşir. | Aktarım durur; Windows kaynağı kullanılmaya devam edilir. |
| WSL/Git | Linux kaynağı, dallar ve yerel çalışmalar korunur; Windows yolları aktif metadata'ya taşınmaz. | Windows klasörüne dönülür; geçmiş yeniden yazılmaz. |
| Web/MongoDB | Temiz kurulum, HTTP/WS, hot reload, misafir sınırı, seed tekrarı ve yeniden başlatmada veri kalıcılığı geçer. | Servisler durdurulur; veri volume'u silinmeden son çalışan ayarlara dönülür. |
| Dev Container | Linux kaynağı, UID/GID ve Node/npm doğrudur; socket yalnız workspace servisindedir. | Container kapatılır; aynı kaynak WSL bağlantısından açılır. |
| Test/CI | Lint, birim testleri, build ve E2E dış ağ olmadan geçer; geliştirme verisi değişmez. | Başarısız koşu durdurulur; canlıya veya geliştirme verisine işlem yapılmaz. |
| Manuel entegrasyon | Ayrı hesaplarla e-posta, Google dönüşü ve preset kısıtları denenir; preset sonra kapatılır. | DEV_EXTERNAL_INTEGRATIONS=false yapılır, ./dev up çalıştırılır; yerel hesaplar kullanılabilir. |
| Android | Web kontrollerinden sonra debug APK ve imzasız AAB üretilir; emülatör/USB bağlantısı denenir. | Android profili kullanılmaz; web servisleri ve Windows Android kurulumu korunur. |

## Android aşaması

Android araçları web, MongoDB, Dev Container ve otomatik test kabulünden önce
kurulmaz veya indirilmez. Web kabulünden sonra ayrı compose.android.yaml profili
kullanılır. JDK 21 imajı digest ile sabittir; Node/npm web ile aynıdır.
SDK 36 ve Build Tools 35.0.0 ayrı Android volume'unda, Gradle 8.14.3 ise mevcut
wrapper üzerinden kullanılır. Command-line tools ve Gradle indirmeleri resmi
SHA-256 değerleriyle doğrulanır. Framework, Gradle ve AGP yükseltilmez.

Ubuntu proje terminalinizde:

    ./dev android setup

Önce araç imajı hazırlanır; bu adım SDK indirmez. Ardından SDK lisans bağlantısı
gösterilir. Lisansı okuyup kabul ediyorsanız yes yazın; paket kurulumu sırasında
gösterilen gerekli lisansları da kendiniz yanıtlayın. Yerel kurulum otomatik
lisans onayı vermez. Lisanslar: https://developer.android.com/studio#terms-and-conditions

Mevcut Windows debug imza kimliğinizi ilk derlemeden önce koruyun:

    ./dev android import-debug-key /mnt/c/Users/Talha/.android/debug.keystore
    ./dev android doctor
    ./dev android build emulator

İçe aktarma yalnız varsayılan androiddebugkey kimliğini kabul eder; mevcut
Docker debug anahtarının üzerine yazmaz. Anahtar ayrı özel volume'da kalır;
Git, imaj, çıktı klasörü veya CI'a aktarılmaz. Windows anahtarı yoksa ilk debug
derlemesi volume'da yeni anahtar üretir. Üretim imza anahtarları kullanılmaz.

Emülatör APK'sı API'ye http://10.0.2.2:5000 üzerinden bağlanır. USB telefon için:

    ./dev android build usb

USB hata ayıklamayı telefonda açıp Windows ADB bağlantısına izin verin.
Windows platform-tools içindeki adb ile cihazı seçerek adb reverse tcp:5000
tcp:5000 çalıştırın. USB APK'sı http://localhost:5000 adresini kullanır.
Emülatör, ADB ve telefon yetkilendirmesi Windows'ta kalır. Web servisleri
./dev up ile açık olmalıdır.

Çıktılar artifacts/android/emulator veya artifacts/android/usb altında
betik-debug.apk ve betik-unsigned.aab dosyalarıdır. APK'nın imzası ve AAB'nin
imzasız olduğu derleme sonunda denetlenir. AAB yerel test adreslerini içerir;
mağaza yayını değildir. Debug uygulaması Betik Dev adı ve com.betik.app.dockerdev
paketiyle kurulur; mevcut telefon uygulamanızın üzerine yazılmaz.
Kaynaklar imaja alınır; build ve Capacitor sync yalnız
geçici konteyner kopyasını değiştirir. Android'e kaynak bind mount'u, Docker
socket, gerçek environment dosyası veya geliştirme veritabanı verilmez.

Manual Android build workflow'u yalnız elle başlatılır. SDK lisansını kabul
ettiğinizi belirten seçenek açılmadan iş çalışmaz. Yalnız APK/AAB çıktıları
yüklenir; deploy veya mağaza yayını yoktur. GitHub workflow_dispatch için dosyanın
varsayılan dalda bulunmasını gerektirdiğinden, develop'a eklemek tek başına
bu düğmeyi etkinleştirmez; main yayını ayrı onaya tabidir.

Geri dönüşte Android profilini kullanmayı bırakın. SDK, Gradle ve debug-key
volume'larını silmeyin; web ortamı ve Windows kurulumu etkilenmez.
