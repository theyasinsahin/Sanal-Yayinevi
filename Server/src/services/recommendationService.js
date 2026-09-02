// src/services/recommendationService.js
import Book from '../models/book.js';
import Comment from '../models/comment.js';
import Quote from '../models/quote.js';
import User from '../models/user.js';
import UserPreference from '../models/userPreference.js';
import ReadingProgress from '../models/readingProgress.js';

// --- AĞIRLIKLAR ---
const W = {
  LIKED_GENRE:     10,
  SAVED_GENRE:      8,
  COMMENTED_GENRE:  6,
  QUOTED_GENRE:     4,
  SOCIAL:           5,
  POPULARITY:       3,
  FRESHNESS:        2,
  ONBOARDING:       7,
};

// --- YARDIMCI: Tür → ağırlık haritası oluştur ---
const buildGenreWeightMap = (bookList, weight) => {
  const map = {};
  for (const book of bookList) {
    if (!book.genreId) continue;
    const key = book.genreId.toString();
    map[key] = (map[key] || 0) + weight;
  }
  return map;
};

// --- YARDIMCI: İki haritayı birleştir ---
const mergeMaps = (base, incoming) => {
  for (const [key, val] of Object.entries(incoming)) {
    base[key] = (base[key] || 0) + val;
  }
  return base;
};

// --- ANA FONKSİYON ---
export const getRecommendations = async (userId, { limit = 10, offset = 0 } = {}) => {

  // 1. Kullanıcı verisini çek
  const user = await User.findById(userId).lean();
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const savedBookIds    = user.savedBooks?.map(id => id.toString())    ?? [];
  const followingIds    = user.following  ?? [];

  // 2. Kullanıcının etkileşimde bulunduğu kitapları çek
  const [likedBooks, savedBooks, commentedBooks, quotedBooks, readBooks] = await Promise.all([
    Book.find({ likedBy: userId }).select('genreId').lean(),
    Book.find({ _id: { $in: user.savedBooks } }).select('genreId').lean(),
    Comment.find({ userId }).select('bookId').lean().then(async (comments) => {
      const ids = [...new Set(comments.map(c => c.bookId?.toString()).filter(Boolean))];
      return Book.find({ _id: { $in: ids } }).select('genreId').lean();
    }),
    Quote.find({ userId, isRepost: false }).select('bookId').lean().then(async (quotes) => {
      const ids = [...new Set(quotes.map(q => q.bookId?.toString()).filter(Boolean))];
      return Book.find({ _id: { $in: ids } }).select('genreId').lean();
    }),
    ReadingProgress.find({ userId }).select('bookId').lean(),
  ]);

  // 3. Tür ağırlık haritasını oluştur
  let genreWeights = {};
  mergeMaps(genreWeights, buildGenreWeightMap(likedBooks,     W.LIKED_GENRE));
  mergeMaps(genreWeights, buildGenreWeightMap(savedBooks,     W.SAVED_GENRE));
  mergeMaps(genreWeights, buildGenreWeightMap(commentedBooks, W.COMMENTED_GENRE));
  mergeMaps(genreWeights, buildGenreWeightMap(quotedBooks,    W.QUOTED_GENRE));

  // 4. Onboarding tercihleri (henüz etkileşim yoksa temel sinyal)
  const preference = await UserPreference.findOne({ userId }).lean();
  if (preference?.onboardingCompleted && preference.preferredGenres?.length > 0) {
    for (const genreId of preference.preferredGenres) {
      const key = genreId.toString();
      // Davranışsal veri yoksa onboarding daha ağır basar, varsa katkı azalır
      const hasSignal = Object.keys(genreWeights).length > 0;
      genreWeights[key] = (genreWeights[key] || 0) + (hasSignal ? W.ONBOARDING / 2 : W.ONBOARDING);
    }
  }

  // 5. Sosyal sinyal: takip edilenlerin beğendikleri kitapların türleri
  if (followingIds.length > 0) {
    const followingLikedBooks = await Book.find({
      likedBy: { $in: followingIds },
    }).select('genreId').lean();
    mergeMaps(genreWeights, buildGenreWeightMap(followingLikedBooks, W.SOCIAL));
  }

  // 6. Zaten etkileşimde olunan kitapları hariç tut
  const readBookIds = readBooks.map(r => r.bookId?.toString()).filter(Boolean);
  const excludedIds = [...new Set([...savedBookIds, ...readBookIds])];

  // 7. Aday kitapları çek (yayımlanmış ve taslak olmayanlar)
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const candidates = await Book.find({
    status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] },
    _id: { $nin: [userId, ...excludedIds] },  // yazarın kendi kitapları da çıkabilir isteğe göre
    authorId: { $ne: userId },                // kullanıcının kendi kitaplarını önerme
  })
  .select('_id title authorId genreId imageUrl stats likedBy createdAt status description publishDate')

  // 8. Her adaya skor hesapla
  const scored = candidates.map((book) => {
    let score = 0;
    const reasons = [];

    const genreKey = book.genreId?.toString();

    // Tür skoru
    if (genreKey && genreWeights[genreKey]) {
      score += genreWeights[genreKey];

      // Reason mantığı: en güçlü sinyale göre açıklama üret
      if (buildGenreWeightMap(likedBooks, 1)[genreKey])          reasons.push('LIKED_GENRE');
      else if (buildGenreWeightMap(savedBooks, 1)[genreKey])     reasons.push('SAVED_GENRE');
      else if (buildGenreWeightMap(commentedBooks, 1)[genreKey]) reasons.push('COMMENTED_GENRE');
      else if (buildGenreWeightMap(quotedBooks, 1)[genreKey])    reasons.push('QUOTED_GENRE');
      else if (preference?.preferredGenres?.map(g => g.toString()).includes(genreKey))
                                                                  reasons.push('ONBOARDING_GENRE');
    }

    // Sosyal skor
    const likedByFollowing = book.likedBy?.some(id =>
      followingIds.map(f => f.toString()).includes(id.toString())
    );
    if (likedByFollowing) {
      score += W.SOCIAL;
      reasons.push('SOCIAL');
    }

    // Popülerlik skoru
    const popularityScore =
      (book.stats?.likes  ?? 0) * 0.6 +
      (book.stats?.views  ?? 0) * 0.1 +
      (book.stats?.shares ?? 0) * 0.3;
    score += Math.min(popularityScore * W.POPULARITY / 100, W.POPULARITY);

    // Tazelik bonusu
    if (book.createdAt && new Date(book.createdAt) > thirtyDaysAgo) {
      score += W.FRESHNESS;
      if (reasons.length === 0) reasons.push('NEW');
    }

    // Eğer hiç sinyal yoksa genel popülerlik önermesi
    if (reasons.length === 0) reasons.push('POPULAR');

    return {
      book,
      score,
      reason: reasons[0], // en güçlü neden
    };
  });

  // 9. Skora göre sırala, offset/limit uygula
  scored.sort((a, b) => b.score - a.score);
  const paginated = scored.slice(offset, offset + limit);

  return paginated.map(({ book, score, reason }) => ({
    score,
    reason,
    book: {
        ...book.toObject(),
        id: book._id.toString(),
    },
}));
};

// --- OKUMA İLERLEMESİ ---
export const markChapterAsRead = async (userId, bookId, chapterId) => {
  const progress = await ReadingProgress.findOneAndUpdate(
    { userId, bookId },
    {
      $addToSet: { completedChapters: chapterId },
      $set:      { lastReadAt: new Date() },
    },
    { upsert: true, new: true }
  );

  // Kitabın tüm chapter'larını çek, hepsini bitirdi mi kontrol et
  const { default: Book } = await import('../models/book.js');
  const book = await Book.findById(bookId).select('chapters').lean();
  if (book?.chapters?.length > 0) {
    const total     = book.chapters.length;
    const completed = progress.completedChapters.length;
    if (completed >= total) {
      progress.isCompleted = true;
      await progress.save();
    }
  }

  return progress;
};

export const getReadingProgress = async (userId, bookId) => {
  return await ReadingProgress.findOne({ userId, bookId }).lean();
};

export const getUserReadingHistory = async (userId) => {
  return await ReadingProgress.find({ userId })
    .sort({ lastReadAt: -1 })
    .populate('bookId', 'title imageUrl authorId')
    .lean();
};

// --- ONBOARDING ---
export const saveUserPreference = async (userId, genreIds) => {
  return await UserPreference.findOneAndUpdate(
    { userId },
    {
      $set: {
        preferredGenres:     genreIds,
        onboardingCompleted: true,      // her durumda true yaz
      },
    },
    { upsert: true, new: true }         // new:true → güncellenmiş dökümanı döndür
  );
};

export const getUserPreference = async (userId) => {
  return await UserPreference.findOne({ userId }).populate('preferredGenres');
};