# Basılı katalog: bilinirlik ve içerik incelemesi

İnceleme paketi mevcut 261 yayımlanmış basılı kitabın tamamını kapsar. Türkiye’deki genel okur kitlesi esas alınmıştır. Her kitap için eser biçimi, 1–3 tür/konu, etiketler, kaynakların desteklediği anlatım özellikleri, hedef okur ve mevcut içerik uyarıları hazırlanmış; “Kitap hakkında” metni yeniden yazılmıştır.

- [Aramalı inceleme dosyası](printed-catalog-editorial-review.html): 261 kitabın sırası, tüm alanları, açıklaması ve kaynakları.
- [Uygulanacak veri paketi](../Server/src/data/printed-catalog/tr-editorial-2026-11-06.json).
- [Tam katalog test sonucu](printed-catalog-editorial-verification.json).

Paket kimliği: `tr-editorial-2026-11-06`.

SHA-256: `70dce63c0edc9d9d47a6c3f7dc1f41dac7d72650bee2c0a7fd9f871d55217cec` (`JSON.stringify` üzerinden).

## Bilinirlik sırası

Bu bir ulusal anket veya nesnel bilinirlik yüzdesi değildir. Kültürel yerleşiklik için açık editoryal gruplar; grup içinde doğrulanabilen eser görünürlüğü kullanılır. Okul okumaları, sahne hayatı ve sözlü kültürdeki erişim, platformdaki okur sayısıyla bire bir örtüşmez. En yaygın kültürel gruptaki öncelik bu nedenle ayrıca kaydedilmiştir.

1000kitap için 261 eser-yazar araması yapılmıştır. 101 eserde kullanılabilecek eşleşme, bunların 70’inde ana kitap başlığında okunma metriği bulunmuştur. Doğrudan erişim engellendiği için herkese açık arama dizini kullanılmıştır. Sayaçlar güncel canlı ölçümler gibi sunulmaz; farklı tarama tarihlerindeki değerler aralık olarak tutulur. Farklı baskılar toplanmaz. Başka eserin, yazar sayfasının veya gönderinin görüntülenmesi dışlanır. İnceleme sayısı yalnız kitap incelemelerinin toplamını açıkça gösteren başlıktan alınır.

Kitapçı yorumları seçilen ISBN’nin etkileşimidir ve daha düşük ağırlık taşır. Yayınevinin baskı numarası, basılan veya satılan kopya sayısına çevrilmez. Metrik yokluğu sıfır bilinirlik sayılmaz; veri sınırlılığı ve güven düzeyi kayıt bazında tutulur. Kanıtın sınırlı olduğu eşit gruplarda alfabetik sıra kullanılır. Puanlama formülü ve her kitabın girdileri veri paketinde açıktır.

İlk on kitap: Küçük Prens, Kürk Mantolu Madonna, İnsan Neyle Yaşar?, Satranç, Tutunamayanlar, Beyaz Zambaklar Ülkesinde, Araba Sevdası, Mai ve Siyah, Çocuk Kalbi, Drakula.

`Book.recognitionScore` yalnız sıra anahtarıdır: `1.000.001 − sıra`. Site görüntülenme/beğeni sayaçları ve zaman damgaları sıralama amacıyla değiştirilmez. İncelenmemiş yeni kayıtlar bu alan olmadan listenin sonunda yer alır.

## İçerik ve sınıflandırma

Tanıtım metinleri kopyalanmadan, konu ve anlatı yapısı belirtilerek yeniden yazılmıştır. Mevcut basımın künyesi korunur. Başka baskı veya özgün dil kaynakları kullanıldığında kapsamı ayrıca belirtilir; bu kaynaklardan Türkçe baskının sayfası, kapağı veya yılı türetilmez. Yayınevi açıklamasının kitapçıda tekrar edilmesi, iki bağımsız edebî inceleme olarak değerlendirilmez.

Kitap türü ile hedef okur birlikte incelenmiştir. Örneğin Benoni ile Rosa radyo oyunu uyarlaması, Potter Cep Kitapları karakter rehberi, Yoldan fotoğraf kitabıdır. Katalogdaki Nasreddin Hoca Fıkraları baskısı yayınevinin yetişkinlere yönelik sunumuna göre işaretlenmiştir. “İnsanin Acayip Kısa Tarihi” başlığı, aynı ISBN’li resmî sayfa ve önizlemeye dayanılarak “İnsanın Acayip Kısa Tarihi” olarak düzeltilir.

Mevcut içerik uyarıları değiştirilmez: Şiddet, Korkutucu İçerik, Cinsel İçerik, Kendine Zarar Verme, Bağımlılık, Ayrımcılık, Ağır Dil. 76 kitapta en az bir seçenek işaretlenmiştir. Uyarılar kitap içeriğine ilişkindir; yazarın biyografisinden çıkarılmaz. Örneğin Satranç için yaralanma tek başına kasıtlı kendine zarar kanıtı sayılmamıştır. Eleştirel olarak anlatılan ayrımcılık, yazarın bunu onayladığı anlamına gelmez.

Tam metinlerin tamamı okunmamıştır. Kaynaklarda tespit edilemeyen bir unsurun eserde bulunmadığı iddia edilmez; boş uyarı listesi yaş uygunluğu onayı değildir. Bu sınır her kaydın araştırma verisinde saklanır. Hedef okur seçimleri resmî yaş derecelendirmesi değildir.

Mevcut biçimlerin yetersiz kaldığı kitaplar için 5 biçim eklenir: Resimli Kitap, Etkinlik Kitabı, Rehber, Atlas, Fotoğraf Kitabı. Anlatım için 38 ek seçenek tanımlanır: çerçeve anlatı, iç monolog, görsel anlatım gibi metinlerde kullanılan özellikler. Mevcut seçenekler silinmez veya yeniden adlandırılmaz. Sesli/ışıklı/çarklı basılı kitap özellikleri; sesli kitap, görsel roman veya dallanan etkileşimli kurgu olarak işaretlenmez. Yayınevi dizisi seri kurgu sayılmaz.

## Uygulama ve kontrol

Çalışma dalı `feature/catalog-editorial`; `develop` bu dalın atasıdır. Kullanıcı 6 Kasım 2026’da commit/push, PR üzerinden yayın ve canlı uygulama adımını onayladı. Canlı uygulamanın sonucu ayrıca kaydedilecektir; önceki kitap ekleme işlemiyle bu içerik düzenlemesinin kayıtları ayrıdır.

Varsayılan komut tamamen çevrim dışıdır; `.env` yüklemez:

```powershell
cd Server
npm.cmd run catalog:curate -- --report ../.catalog-research/editorial-validation.json
```

Veritabanı karşılaştırması için `PRINTED_EDITORIAL_MONGO_URI` süreç ortamında açıkça sağlanır; `--check-db --database <ad>` kullanılır. Uzak bağlantı ayrıca `--allow-remote` ister. Uygulama; `--apply`, aktif `--admin-id` ve yukarıdaki `--expected-sha256` değerini gerektirir. Bağlantı adresi hiçbir rapora yazılmaz. Transaction destekli MongoDB replica set gerekir.

Uygulama öncesi bütün yayımlanmış basılı katalog karşılaştırılır. İncelenmemiş yeni bir kitap, değişmiş açıklama/sınıflandırma, pasif seçenek veya başka bir künye görülürse paket uygulanmaz. Yeni terimler, 261 kitap güncellemesi, araştırma/önce-sonra kayıtları ve yönetici günlükleri tek transaction içinde yazılır. Hata halinde tamamı geri alınır. Yeniden çalıştırma aynı kayıtları üretmez; sonradan yapılan insan düzenlemelerini ezmez. Pasif terimler yeniden etkinleştirilmez ve genel etiket oluşturma kotası değiştirilmez.

Yeni terimler mevcut canlı durumla karşılaştırıldığında toplam 659 eksik terim/etiket vardır. Bunlar yönetici katalog uygulamasıyla eklenir. Künye, kapak, hak sahipliği, bölümler ve site etkileşim sayaçlarına dokunulmaz. Önceki ve sonraki değerler `PrintedEditorialRecord` içinde saklanır; bu otomatik bir geri alma komutu değildir.

Doğrulama:

- İlgili sunucu testlerinde toplam 54 senaryo geçti. Sınıflandırma seçenek sayısı beklentisi 27 biçim/46 anlatım seçeneği için güncellendi ve ilgili 12 test yeniden geçti. Son servis düzenlemesinde editoryal paketin 13 testi ayrıca yeniden çalıştırıldı.
- Basılı kitap arayüzündeki 15 test geçti. Mevcut React/Apollo test uyarıları devam ediyor.
- İstemci üretim derlemesi tamamlandı. Değiştirilen ekranın dışındaki mevcut lint ve Create React App bağımlılık uyarıları devam ediyor.
- Canlı katalog yalnız okunarak karşılaştırıldı: 261 kayıt, 0 çakışma, 0 editoryal güncelleme.
- Yalıtılmış replica set üzerinde 261 kitabın tamamı uygulandı; 22 sayfanın sırası, bütün sınıflandırma alanları, özgün künye ve sayaçlar doğrulandı. 261 araştırma kaydı ve 261 yönetici günlüğü oluştu. İki ayrı dijital koruma kaydı değişmedi. İkinci uygulama 0 güncelleme yaptı.

Kaynak ve sıralama değerlendirmeleri zamanla yenilenebilir. Yeni bir inceleme paketi hazırlanırken güncel kayıt parmak izleriyle tekrar karşılaştırma gerekir.
