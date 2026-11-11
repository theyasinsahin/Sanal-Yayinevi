# Sayaçların kısa gösterimi

## İnceleme ve karar

Profil ve kitap kartı ayrı `formatNumber` fonksiyonları kullanıyordu. İkisi de
1.000'den itibaren kısaltıyor, ancak milyarları desteklemiyor ve `999.950`
değerini `1.000 bin` gösteriyordu. Kitap detayındaki beğeni, profil puanı,
alıntı/yorum/oturum sayaçları ham sayılar gösteriyordu. Lider tablosu ise
1.000 ve üzerindeki bütün puanları `999+` ile gizliyordu.

Sayıların arayüzü bozduğu tek bir eşik yoktur: yazı boyutu, simgeler ve kartın
gerçek genişliği birlikte belirleyicidir. Bu yüzden kısaltma ekran boyutuna göre
değişmez; bütün sosyal sayaçlarda 1.000'de başlar. Gerekirse sayaç grupları
alt satıra geçer, sayı ile birimi birbirinden ayrılmaz.

Gerçek ürün örneği olarak YouTube da herkese açık abone sayılarını 1.000'den
itibaren kısaltır; örnekleri `1.234 → 1.23K`, `12.345 → 12.3K` biçimindedir.
Bu, üç anlamlı basamak yaklaşımıdır. Betik'te dar kitap kartları ve bütün
sayaçlarda aynı davranış için en fazla bir ondalık seçildi. Bu basamak sayısı
ve en yakına yuvarlama Betik'in ürün kararıdır; YouTube'un kuralı birebir
uygulanmaz.

Araştırılan yaklaşımlar:

| Yaklaşım | Örnek | Betik için değerlendirme |
| --- | --- | --- |
| Tam sayı | `21.530` | Kesin değer için uygun; dar sosyal sayaçlarda uzun. |
| İngilizce kısa biçim | `21.5K`, `1.2M` | İngilizce yerelleştirmede uygun. Türkçe arayüzde yerel karşılığı tercih edildi. |
| Türkçe uzun biçim | `21,5 bin`, `1,2 milyon` | Açıklayıcı metinde uygun; kitap kartında fazla yer kaplar. |
| Türkçe kısa biçim | `21,5 B`, `1,2 Mn` | Seçilen biçim: kısa, yerel ve tarayıcının standart desteğini kullanır. |

Türkçe Unicode CLDR kısa biçimleri `B` (bin), `Mn` (milyon), `Mr` (milyar),
`Tn` (trilyon) şeklindedir. `B` burada İngilizce “billion” anlamına gelmez.
Ondalık ayracı virgüldür. Sayı ile birim arasındaki boşluk bölünmez.

Kaynaklar:

- [Unicode CLDR Türkçe sayı biçimleri](https://unicode.org/cldr/charts/49/summary/tr.html)
- [Intl.NumberFormat: compact, basamaklar ve yuvarlama](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)
- [YouTube: abone sayılarının kısa gösterimi](https://support.google.com/youtube/answer/6051134)

## Plan ve uygulama

1. Modül düzeyinde oluşturulan `Intl.NumberFormat('tr-TR', { notation: 'compact',
   compactDisplay: 'short', maximumFractionDigits: 1 })` ile ortak biçimlendirici.
2. `CompactNumber` bileşeniyle kısa görsel değer, tam değerli `title` ve ekran
   okuyucu metni. Kısaltılmış görsel değer ekran okuyucudan gizlenir; tam değer
   bir kez okunur. Simgeyle kullanılan sayaçlar ayrıca metrik adı taşır.
3. Profil, kitap kartı/detayı, alıntı etkileşimleri, yorum beğenileri, paragraf
   yorum sayıları, oturum katılımcı/beğeni/yazı sayıları ve lider tablosunda
   ortak bileşen. Profil sekmelerinin sayı rozetleri de aynı kuralı kullanır.
4. Kitap kartı, profil alt istatistikleri ve alıntı aksiyonlarında satır kaydırma.
   `white-space: nowrap` ile her sayının kendi birimi birlikte kalır.
5. Eşik, gizlilik, erişilebilirlik ve gerçek tarayıcı yerleşim testleri.

## Kurallar ve örnekler

En fazla bir ondalık gösterilir; gereksiz `,0` eklenmez. Standart en yakına
yuvarlama kullanılır; tam yarıda yukarı yuvarlanır. Üst birime taşma da `Intl`
tarafından ele alınır; elle bölme veya ek bir paket kullanılmaz.

| Gerçek değer | Görünen değer | Durum |
| ---: | --- | --- |
| 0 | `0` | Sıfır açıkça gösterilir. |
| 999 | `999` | 1.000'in altında tam değer. |
| 1.000 | `1 B` | Kısaltmanın başlangıcı. |
| 1.049 | `1 B` | Tek ondalığa yuvarlama. |
| 1.050 | `1,1 B` | Yarımda yukarı yuvarlama. |
| 9.999 | `10 B` | Gereksiz sıfırlı ondalık yok. |
| 21.530 | `21,5 B` | Kullanıcının kitap görüntülenmesi örneği. |
| 25.000 | `25 B` | Tam birimde ondalık yok. |
| 25.300 | `25,3 B` | Tek ondalık korunur. |
| 99.949 | `99,9 B` | Yüz bin sınırının altı. |
| 99.950 | `100 B` | Yuvarlama. |
| 999.949 | `999,9 B` | Milyon birimine taşmadan önceki son tam sayı. |
| 999.950 | `1 Mn` | Yuvarlama üst birime taşar. |
| 1.000.000 | `1 Mn` | Milyon. |
| 1.250.000 | `1,3 Mn` | Milyonda tek ondalık. |
| 999.950.000 | `1 Mr` | Milyara yuvarlama. |
| 1.000.000.000 | `1 Mr` | Milyar. |
| 2.147.483.647 | `2,1 Mr` | GraphQL Int üst sınırı. |
| 1.000.000.000.000 | `1 Tn` | Biçimlendirici trilyonları da destekler. |

Kısaltma yaklaşık bir gösterimdir: `999.950` görünürde `1 Mn` olabilir;
üzerine gelince ve ekran okuyucuda `999.950` korunur. Artış, beğeni geri alma,
sıralama ve API/önbellek işlemleri gerçek sayısal değerle çalışır. Gizli takip
listelerinde sayı bileşeni oluşturulmaz; tam sayı tooltip'e veya gizli metne
sızmaz.

Eksik, sonlu olmayan, negatif veya sayısal olmayan değerler `0` gösterilir.
Sayaçların kesirli kısmı atılır. Bu yardımcı yalnızca adet/puan içindir.
Para, ödeme/finans kayıtları, yüzde, sayfa/bölüm numarası, sıra ve sayfalama
değerleri bu kısaltmaya geçirilmedi. Bildirimlerdeki `99+` gibi durum rozetleri
de kendi mevcut kurallarını korur.

## Doğrulama

Sınır değerleri, tam sayı erişilebilirliği, gizli takip listeleri ve kart/detay
tutarlılığı birim/bileşen testlerinde denetlenir. `compact-counts.spec.cjs`,
örnek API yanıtlarıyla gerçek uygulamayı açar; 320, 393, 768 ve 1440 px
ekranlarda profil, kitap kartı, alıntı ve kitap detayını denetler. Kitap kartları
ayrıca 160, 230 ve 280 px kapsayıcılarda ölçülür. Hem sayfa taşması hem sayaç
satırının kendi içinde kırpılma/çakışma kontrol edilir.

5 Kasım 2026 doğrulaması: ilgili 12 test dosyasında 116 test ve Edge'de
masaüstü/dokunmatik mobil bağlamında 8 tarayıcı testi geçti. Üretim derlemesi
tamamlandı; mevcut mesajlaşma/giriş sayfalarının lint uyarıları ile CRA/Babel
bağımlılık uyarıları sürüyor. Ölçülen ekran ve kart boyutlarında sayaç taşması
veya çakışma bulunmadı. Gerçek iOS/Safari cihazı bu doğrulamaya dahil değildir.

```powershell
npm.cmd --prefix Client run test:ci -- --runTestsByPath src/utils/formatCount.test.js src/components/UI/CompactNumber.test.jsx src/components/Books/BookCard/BookCard.test.jsx src/pages/UserProfilePage/UserProfile.test.jsx src/pages/BookDetail/BookDetail.test.jsx src/pages/LeaderboardPage/LeaderboardPage.test.jsx
npm.cmd --prefix Client run test:e2e -- e2e/compact-counts.spec.cjs
npm.cmd --prefix Client run build
```
