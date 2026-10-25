# Takip isteği ve onay akışı

Dal: `feature/follow-requests`

## Davranış

1. **Takip İsteği Gönder** yeni bir `PENDING` kayıt ve alıcının onay
   bildirimini oluşturur. Bu aşamada takipçi/takip edilen listeleri değişmez.
2. Gönderende **İsteği Geri Çek** ve “Takip isteği onay bekliyor” görünür.
   Bekleyen profilin durumu 15 saniyede bir yenilenir.
3. Alıcı bildirim zilindeki **Takip İstekleri** bölümünden **Kabul Et** veya
   **Reddet** seçer. Yalnızca isteğin alıcısı karar verebilir.
4. Kabulde gönderenin `following`, alıcının `followers` listesi güncellenir;
   gönderene kabul bildirimi gider. Takipçilere özel profil, mesaj ve oturum
   izinleri ancak bu işlemden sonra açılır.
5. Ret veya geri çekme ilişki oluşturmaz. Gönderen daha sonra yeni bir istek
   gönderebilir; önceki isteğin kimliğiyle onay vermek yeni isteği etkilemez.
6. Kabul edilmiş takipte **Takibi Bırak** iki listedeki ilişkiyi kaldırır.
   Daha önceki kabul işlemini tekrar göndermek ilişkiyi geri kurmaz.
7. Kendi profilinizde **Takipçiler** listesinden **Takipçiyi Çıkar** ile
   gelen takip ilişkisini kaldırabilirsiniz. Bu işlem karşılıklı takipte
   sizin o kullanıcıyı takip etmenizi etkilemez. Çıkarılan kullanıcı özel
   profil, takipçi mesajlaşması ve takipçilere özel oturum erişimini kaybeder;
   yeniden takip etmek için tekrar onay isteği göndermelidir.

Mevcut takip ilişkileri korunur; kullanıcıları yeniden onaya zorlayan bir
migration çalıştırılmaz. Kitap takip etme özelliği bu akıştan bağımsızdır.

## Bildirimler

- Onay istekleri, isteğe bağlı “Yeni Takipçi” bilgi bildiriminden bağımsız
  olarak oluşturulur. Bildirim ayarındaki açıklama bu ayrımı belirtir.
- Bildirim panelini açmak veya “okundu” işaretlemek bekleyen isteği çözmez.
  Zil sayacı çözümlenmemiş istekleri saymaya devam eder.
- Bekleyen istekler normal 20 bildirimlik geçmişten bağımsız, sayfalı bir
  sorguyla getirilir. Eski bir istek başka bildirimlerin arkasında kaybolmaz.
- İsteğe bağlı yeni takipçi bilgi bildirimi kabulden sonra alıcıya gösterilir.
  Ret için gönderene ayrı bildirim gönderilmez; profil durum sorgusu artık
  onay beklemediğini bildirir.

## API ve tutarlılık

- `User.followStatus`: `NOT_FOLLOWING`, `PENDING`, `FOLLOWING`.
- `requestFollowUser(targetId)`: aynı bekleyen isteği tekrar oluşturmaz.
- `cancelFollowRequest(targetId)`: yalnızca gönderenin ilgili isteğini çözer.
- `respondToFollowRequest(requestId, accept)`: yalnızca alıcı yanıtlayabilir.
- `unfollowUser(targetId)`: tekrarlanan çağrılarda aynı sonuca ulaşır.
- `removeFollower(followerId)`: giriş yapan kişinin takipçi listesinden
  çıkarır; istemci başka bir profil sahibinin kimliğini belirleyemez.
  Kullanıcı devre dışı veya silinmiş olsa da kalan ilişki temizlenebilir.
- `getIncomingFollowRequests(limit, offset)`: giriş yapan kullanıcının
  bekleyen istekleri ve toplam sayısı.
- Eski `toggleFollowUser` da bu servise bağlanmıştır; doğrudan takip
  oluşturarak onayı atlamaz.

Bekleyen istekler için gönderen/alıcı çifti üzerinde benzersiz kısmi indeks
vardır. İstek kararı, iki takip listesi ve bildirimler MongoDB transaction
içinde yazılır. Hata halinde yarım takip ilişkisi veya yanıltıcı bildirim
kalmaz; eşzamanlı kararlar da bu işlem üzerinden seri hale gelir.

**Veritabanı gereksinimi:** Transaction desteği için MongoDB replica set
veya sharded cluster gerekir; MongoDB Atlas bunu destekler. Yerel MongoDB
kullanılıyorsa tek düğümlü replica set olarak çalıştırılmalıdır. Standalone
bir MongoDB sunucusu transaction desteklemez. Üretim veritabanının
yapılandırması bu görevde değiştirilmemiştir.

## Doğrulama

Sunucu testleri geçici tek düğümlü MongoDB replica set kullanır. İstek
gönderme, kabul, ret, geri çekme, yeniden gönderme, yetkisiz erişim,
gizlilik izinleri, aynı anda gelen istekler, kabul/iptal yarışı ve yazma
hatasında rollback test edilir. Gerçek veritabanı veya gerçek kullanıcılar
üzerinde test yapılmaz.

İstemci testleri buton durumlarını, başarısız işlemleri, çift tıklamayı,
kabul/ret kararlarının doğru parametrelerle gönderilmesini, iptal edilmiş
isteğin yenilenmesini ve diğer istek sayfalarına erişimi doğrular.

Takipçi çıkarma testleri ayrıca karşılıklı takipte ters yönün korunmasını,
başka bir profil adına işlem yapılamamasını, özel erişimin kaybedilmesini,
eşzamanlı çıkarma işlemlerini, eski onayın tekrar kullanılamamasını ve hata
halinde her iki listenin geri alınmasını kapsar. İstemcide işlem sırasında
profil satırına yanlışlıkla yönlenme ve çift tıklama da test edilir.

Son kontrol: sunucuda 10 paket / 79 test; ilgili istemci testlerinde 4 paket /
26 test geçti. Üretim derlemesi mevcut lint uyarılarıyla başarılı.
