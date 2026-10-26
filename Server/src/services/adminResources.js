import models from '../models/index.js';
import BookClaim from '../models/bookClaim.js';
import FollowRequest from '../models/followRequest.js';
import NewsletterSubscription from '../models/newsletterSubscription.js';
import Verification from '../models/verification.js';
import WritingActivity from '../models/writingActivity.js';
import AdminAudit from '../models/adminAudit.js';
import AdminControl from '../models/adminControl.js';
import ReadingSession from '../models/readingSession.js';

const definitions = {
  User: ['Kullanıcılar', 'Hesap, profil ve rol durumu. Oturum oluşturma izinleri Oturum İzinleri ekranından yönetilir. Hesabı arşivlemek verileri fiziksel olarak silmez; geri alma önceden kaldırılmış içerikleri yayımlamaz.', ['username', 'fullName', 'email', 'bio', 'profilePicture', 'website', 'role', 'isActive', 'isDeleted', 'isVerified', 'authorSettings.copyrightNote', 'authorSettings.weeklyWordGoal', 'privacySettings.isProfilePublic', 'privacySettings.isLibraryPublic', 'privacySettings.isFollowListPublic', 'privacySettings.allowMessages', 'privacySettings.showInSearchEngines']],
  Book: ['Kitaplar', 'Taslak, dijital, basılı ve arşivlenmiş kitapların tamamı. Yayın ve hak onayları ilgili inceleme ekranında yürütülür.', ['title', 'description', 'genreId', 'imageUrl', 'tags', 'printedAuthor', 'publisher', 'publicationYear', 'purchaseUrl', 'publicationEvidenceUrl', 'isbn', 'pageCount', 'isDeleted']],
  Genre: ['Kitap türleri', 'Tür ekleyin; adını, açıklamasını, rengini ve kullanılabilirliğini yönetin. Pasifleştirme mevcut kitapları silmez.', ['name', 'slug', 'description', 'hexColor', 'isActive'], true],
  Chapter: ['Bölümler', 'Bölüm başlığı ve metnini düzenleyin. Kitap ve yazar ilişkileri korunur.', ['title', 'content', 'pageCount', 'isDeleted']],
  Comment: ['Kitap yorumları', 'Yorum içeriği ve moderasyon durumu.', ['content', 'isDeleted']],
  Quote: ['Alıntılar', 'Alıntı metni, notu ve spoiler/moderasyon durumu.', ['text', 'note', 'isSpoiler', 'repostComment', 'isDeleted']],
  QuoteComment: ['Alıntı yorumları', 'Alıntılara yapılan yorumlar.', ['content', 'isDeleted']],
  ParagraphComment: ['Paragraf yorumları', 'Kitap paragraflarına yapılan yorumlar.', ['content', 'isDeleted']],
  Session: ['Oturumlar', 'Etkinlik başlığı, açıklaması, kapağı ve açık/kapalı durumu. Katılım türü ve erişim kodu birlikte yönetilir.', ['title', 'description', 'coverImageUrl', 'tags', 'isActive']],
  SessionEntry: ['Oturum yazıları', 'Oturumlara gönderilen yazılar ve moderasyon durumu.', ['content', 'isDeleted']],
  Badge: ['Rozetler', 'Rozet tanımı ve kazanma eşiği. Önceden kazanılmış rozetler geri alınmaz.', ['key', 'name', 'description', 'icon', 'condition.stat', 'condition.threshold'], true],
  Notification: ['Bildirimler', 'Gönderilmiş bildirimler ve okunma durumu.', ['title', 'message', 'isRead']],
  Transaction: ['Finansal işlemler', 'Ödeme sağlayıcısına bağlı mali kayıtlar. Durum/tutar sağlayıcı doğrulamasıyla güncellenir.', []],
  UserScore: ['Kullanıcı puanları', 'Puan toplamları ve istatistikler; puan olaylarından hesaplanır.', []],
  PointEvent: ['Puan hareketleri', 'Puan kaynağı ve değişim geçmişi. Tekrar puanlamayı önleyen kayıtlar.', []],
  UserBadge: ['Kazanılan rozetler', 'Kullanıcıların kazanılmış rozet ilişkileri.', []],
  UserPreference: ['Okuma tercihleri', 'Tercih edilen türler yazar ayarlarıyla birlikte güncellenir.', ['preferredGenres', 'onboardingCompleted']],
  ReadingProgress: ['Okuma ilerlemeleri', 'Son bölüm ve tamamlanan bölüm kimlikleri. Tamamlanma durumu otomatik hesaplanır; okuma puanı verilmez.', ['lastChapterId', 'completedChapters']],
  ReadingSession: ['Okuma oturumları', 'Puan doğrulama oturumlarının zaman ve sıra bilgisi. Oturum anahtarları gizlidir.', []],
  Bookmark: ['Ayraçlar', 'Bölüm ve paragraf konumu; bölüm sırası ve başlığı otomatik eşitlenir.', ['chapterId', 'paragraphIndex']],
  Conversation: ['Konuşmalar', 'Mesajlaşma katılımcıları ve konuşma bilgileri.', []],
  Message: ['Mesajlar', 'Gönderilmiş mesajlar ve ek ilişkileri. Gönderici ve okunma geçmişi korunur.', []],
  BookClaim: ['Yazar hak talepleri', 'Hak sahipliği incelemesi; onay ve ret inceleme ekranından yapılır.', []],
  FollowRequest: ['Takip istekleri', 'İstek, onay ve iptal geçmişi; karşılıklı takip ilişkileriyle birlikte yönetilir.', []],
  NewsletterSubscription: ['Bülten abonelikleri', 'Aboneliği iptal edebilirsiniz. Yeniden abonelik kullanıcı onayı gerektirir.', ['status']],
  Verification: ['E-posta doğrulamaları', 'Bekleyen e-posta doğrulamalarının tarihleri. Doğrulama kodları gizlidir.', []],
  WritingActivity: ['Yazma etkinlikleri', 'Yazılan kelime hareketleri; bölüm değişikliklerinden üretilir.', []],
  AdminAudit: ['Yönetim işlem geçmişi', 'Kimin hangi kaydı hangi gerekçeyle değiştirdiği. İçerik ve parola kopyaları tutulmaz.', []],
  AdminControl: ['Yönetim tutarlılık kaydı', 'Eşzamanlı yönetici hesabı güncellemelerini sıralayan sistem kaydı.', []],
};
export const resources = new Map([...Object.values(models), ReadingSession, BookClaim, FollowRequest, NewsletterSubscription, Verification, WritingActivity, AdminAudit, AdminControl].map(model => {
  const definition = definitions[model.modelName];
  if (!definition) throw new Error(`Missing admin policy: ${model.modelName}`);
  return [model.modelName, { model, name: model.modelName, label: definition[0], description: definition[1], editable: definition[2], canCreate: definition[3] || false }];
}));

export const sensitive = name => /password|token|accessCode|(^|\.)code$|authVersion/i.test(name);
const labels = { name: 'Ad', slug: 'URL adı', description: 'Açıklama', hexColor: 'Renk', isActive: 'Aktif', username: 'Kullanıcı adı', fullName: 'Ad soyad', email: 'E-posta', role: 'Rol', bio: 'Hakkında', profilePicture: 'Profil fotoğrafı', website: 'Web sitesi', isVerified: 'Doğrulanmış hesap', isPremium: 'Ücretli üyelik', title: 'Başlık', content: 'İçerik', text: 'Alıntı metni', note: 'Not', isSpoiler: 'Spoiler içeriyor', isDeleted: 'Yayından kaldırılmış', genreId: 'Kitap türü', imageUrl: 'Kapak bağlantısı', tags: 'Etiketler', pageCount: 'Sayfa sayısı', printedAuthor: 'Basılı eserin yazarı', publisher: 'Yayınevi', publicationYear: 'Baskı yılı', purchaseUrl: 'Satın alma bağlantısı', coverImageUrl: 'Oturum kapağı', icon: 'Rozet simgesi', key: 'Anahtar', 'condition.stat': 'İstatistik alanı', 'condition.threshold': 'Kazanma eşiği', message: 'Bildirim metni', isRead: 'Okundu', repostComment: 'Yeniden paylaşım notu', 'authorSettings.copyrightNote': 'Telif notu', 'authorSettings.weeklyWordGoal': 'Haftalık kelime hedefi' };
export function fieldsFor(resource) {
  const fields = [];
  const collect = (schema, prefix = '') => schema.eachPath((key, path) => {
    const name = prefix + key;
    if (path.schema && !path.$isMongooseDocumentArray) { collect(path.schema, `${name}.`); return; }
    const item = path.$embeddedSchemaType || path.caster;
    fields.push({ name, label: name === 'isPremium' ? 'Eski üyelik bilgisi (kullanılmıyor)' : labels[name] || name, type: path.instance, required: Boolean(path.isRequired), editable: resource.editable.includes(name),
      enumValues: resource.name === 'NewsletterSubscription' && name === 'status' ? ['unsubscribed'] : path.enumValues || [], reference: path.options.ref || item?.options?.ref || null, sensitive: sensitive(name),
      maxLength: typeof path.options.maxlength === 'number' ? path.options.maxlength : null });
  });
  collect(resource.model.schema);
  return fields;
}
