# Vercel / Render Google giriş düzeltmesi

`GOOGLE_CSRF_FAILED`, callback isteğinin `g_csrf_token` çerezi ile form alanının eşleşmediğini veya çerezin gelmediğini gösterir. Giriş sayfası `sanal-yayinevi-pi.vercel.app`, doğrudan callback ise `sanal-yayinevi.onrender.com` olduğunda farklı host çerezleri soruna yol açabilir.

## Canlıya alma adımları

**İkinci düzeltme:** Canlı `/static/js/main.41ebcba6.js` paketi incelendiğinde `REACT_APP_GOOGLE_LOGIN_URI` değerinin hâlâ Render callback'i olduğu doğrulandı. Vercel callback GET isteği ise API yanıtı veriyordu; proxy kuralı yayımlanmıştı. Google Console'a Vercel URI'sinin eklenmiş olması, butonun o URI'yi kullandığı anlamına gelmiyordu.

Vercel üzerinde çalışan tarayıcı artık `/auth/google/callback` adresini kendi `window.location.origin` değerinden üretir. Eski ortam değişkeni Render'ı gösterse veya hiç tanımlı olmasa bile sonuç Vercel callback'i olur. Yerel geliştirme, native origin'ler ve diğer host'ların mevcut ayarları korunur.

Canlı proxy ayrıca sentetik bir `g_csrf_token` ve geçersiz, nesne türünde credential ile kontrol edildi. Render doğrudan ve Vercel proxy üzerinden aynı `400 BAD_REQUEST` yanıtını verdi: CSRF eşleşmesi geçti; credential türü kontrolü, kalıcı rate limit / Google / hesap sorgularından önce isteği durdurdu. Gerçek hesap veya veritabanı işlemi yapılmadı.

1. Google Cloud Console → ilgili OAuth Web Client:
   - Authorized JavaScript origins: `https://sanal-yayinevi-pi.vercel.app`
   - Authorized redirect URIs listesine ekleyin: `https://sanal-yayinevi-pi.vercel.app/auth/google/callback`
2. Vercel → proje → Settings → Environment Variables → Production (temiz ayar olarak önerilir; Vercel runtime artık yanlış Render değerini de düzeltir):
   - `REACT_APP_GOOGLE_LOGIN_URI=https://sanal-yayinevi-pi.vercel.app/auth/google/callback`
   - `REACT_APP_API_URL` mevcut Render API adresinde kalır.
3. Bu düzeltmeyi frontend'in production dalına alın ve Vercel'de **yeniden build/deploy** edin. CRA ortam değişkenlerini derleme sırasında okur; yalnız değişkeni kaydetmek mevcut build'i değiştirmez.
4. Vercel projesinin Root Directory ayarının `Client` olduğunu doğrulayın. `Client/vercel.json`, Google callback'ini SPA fallback'inden önce Render'a **rewrite/proxy** eder. Dashboard Routing Rules içinde daha önce tanımlanmış catch-all redirect varsa yeni yolu gölgelememelidir.
5. Render'daki `CLIENT_URL` tam olarak `https://sanal-yayinevi-pi.vercel.app` olmalıdır. Backend bu adrese `/auth/callback#...` ile döner; aynı frontend origin'inde tab'a bağlı nonce doğrulanır.
6. Yeni frontend build'inde Google girişini yeniden başlatın. Google'ın `redirect_uri` değeri artık Vercel callback adresi olmalı. Callback isteğinde form ve Cookie içindeki `g_csrf_token` eşleşmeli; değerleri loglamayın veya paylaşmayın.

CSRF, Google token doğrulaması, rate limit ve tab nonce kontrolü korunur. Callback proxy'si yalnız sabit Render endpoint'ine gider; istemciden alınan keyfi bir adrese yönlendirme yapmaz. Bu değişiklik yerel kaynak ve sentetik testlerle hazırlanır; gerçek Google + Vercel canlı girişinin dağıtım sonrasında doğrulanması gerekir.

Kaynaklar: [Google sunucu doğrulaması](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Google login_uri](https://developers.google.com/identity/gsi/web/reference/js-reference#login_uri), [Vercel rewrites](https://vercel.com/docs/routing/rewrites).

## Yerel doğrulama

- İstemci: API ayarları ve Google callback dosyalarında 13 test başarılı.
- Sunucu: eksik/uyuşmayan CSRF çerezlerini reddeden kontroller dahil 8 HTTP callback testi başarılı.
- Edge/Playwright: gerçek HTTP, WebSocket ve geçici MongoDB üzerinde 2 senaryo başarılı. Frontend çerezi `127.0.0.1` için oluşturulup `localhost` callback'ine doğrudan gönderildiğinde 403 yeniden üretildi. Aynı-origin test proxy'si orijinal POST ve Cookie header'ını ilettiğinde oturum ve profil başarılı oldu.
- Üretim derlemesi başarılı; mevcut proje uyarıları devam ediyor. Değişen ayar dosyasında ESLint ve `git diff --check` başarılı.

Bu kontroller gerçek Google hesabıyla tam bir canlı giriş doğrulaması değildir. Canlı proxy kontrolü yalnız yukarıda açıklanan erken reddedilen sentetik istekle sınırlıdır.

Yanlış ortam değişkeninin tekrar aynı soruna yol açmasını sınamak için `REACT_APP_API_URL` ve `REACT_APP_GOOGLE_LOGIN_URI` Render adresinde bırakılarak production build alındıktan sonra `npm run test:google-callback-build` çalıştırılır. Bu kontrol gerçek production JavaScript'ini Vercel origin'inde ağdan tamamen yalıtılmış tarayıcıda açar; giriş ve kayıt düğmelerinin SDK'ya verdiği gerçek `login_uri` değerini denetler. Google SDK'sı testte taklit edilir, Google oturumu açılmaz.

İkinci düzeltmenin sonucu: 20 istemci testi, değişen ayar dosyasında ESLint, production derlemesi ve production paketiyle `/login` + `/register` URI kontrolleri başarılı. Paket özellikle canlıda bulunan yanlış Render callback ayarıyla derlendi; iki ekran da `https://sanal-yayinevi-pi.vercel.app/auth/google/callback` üretti.
