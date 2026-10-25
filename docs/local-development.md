# Yerelde giriş yapma

Giriş/kayıt ekranındaki Google dönüş adresi `REACT_APP_API_URL` üzerinden
hesaplanır. Yerel API kullanıldığında Google, canlı siteye değil yerel
sunucuya döner. Yerel sunucu da `CLIENT_URL` adresindeki arayüze yönlendirir.

## Çalıştırma

İki ayrı terminalde:

```powershell
cd Server
npm.cmd run dev
```

```powershell
cd Client
npm.cmd start
```

Uygulamayı `http://localhost:3000` üzerinden açın. İstemci yapılandırması
değiştirildiğinde React geliştirme sunucusunu yeniden başlatın.

Yerel adresler:

```dotenv
# Client/.env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000/graphql

# Server/.env
CLIENT_URL=http://localhost:3000
```

Bu değerler mevcut yerel yapılandırmada zaten ayarlı. Sunucunun kalan
veritabanı, Google, JWT ve e-posta ayarları ayrıca gereklidir; `.env.example`
dosyaları mevcut gizli yapılandırmanın yerine doğrudan kopyalanmamalıdır.

## Google Cloud Console

Google ile giriş için kullanılan OAuth istemcisinde aşağıdaki adresleri
mevcut canlı adreslerin yanına ekleyin:

- **Authorized JavaScript origins:** `http://localhost` ve `http://localhost:3000`
- **Authorized redirect URIs:** `http://localhost:5000/auth/google/callback`

`redirect_uri_mismatch` hatası, dönüş adresinin Google Console kaydıyla
eşleşmediğini gösterir. Port ve yol dahil tam adres aynı olmalıdır. Bu
Google hesap ayarıdır; yalnızca proje kodunu değiştirerek eklenemez.

Başka bir port kullanırsanız arayüzdeki API adresini, sunucudaki `CLIENT_URL`
değerini ve Google Console kayıtlarını birlikte güncelleyin. Üretimde API
adresi canlı backend, `CLIENT_URL` ise canlı frontend adresi olmalıdır.

Kaynak: [Google giriş kurulum rehberi](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
ve [Google JavaScript API: login_uri](https://developers.google.com/identity/gsi/web/reference/js-reference#login_uri).
