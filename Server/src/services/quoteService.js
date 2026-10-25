// src/services/quoteService.js
import { notifyUser } from './notificationService.js';
import User from '../models/user.js';
import { canViewProfile } from '../utils/profileAccess.js';
import { inactiveUserIds } from '../utils/activeUsers.js';
import Quote from '../models/quote.js';
import QuoteComment from '../models/quoteComment.js';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import { isPrintedBook } from '../utils/printedBooks.js';
import * as ScoreService from './scoreService.js';

// Metni normalize et: başını/sonunu temizle, noktalama kaldır, küçük harfe çevir
const normalizeText = (text) => {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // noktalama işaretlerini kaldır
    .replace(/\s+/g, ' ')    // çoklu boşlukları tek boşluğa indir
    .trim();
};

const populateQuote = (query) => {
  return query
    .populate('userId', 'username fullName profilePicture')
    .populate('bookId', 'title imageUrl kind authorId publicationStatus printedAuthor publisher publicationYear isbn')
    .populate({
      path: 'originalQuoteId',
      populate: [
        { path: 'userId', select: 'username fullName profilePicture' },
        { path: 'bookId', select: 'title imageUrl kind authorId publicationStatus printedAuthor publisher publicationYear isbn' },
      ]
    });
};

export const checkQuoteExists = async (text, bookId) => {
  const normalized = normalizeText(text);
  const existing = await populateQuote(
    Quote.findOne({ normalizedText: normalized, bookId, isRepost: false })
  );
  return { exists: !!existing, quote: existing || null };
};

export const createQuote = async (userId, data) => {
  const book = await Book.findOne({ _id: data.bookId, isDeleted: false });
  if (!book) throw new Error('Kitap bulunamadı.');
  const chapterExists = data.chapterId && await Chapter.exists({ _id: data.chapterId, bookId: book._id, isDeleted: false });
  if (isPrintedBook(book)) {
    if (book.publicationStatus !== 'APPROVED') throw new Error('Kitap henüz kataloğa alınmadı.');
    if (!data.text || data.text.trim().length < 10 || data.text.length > 1000) throw new Error('Alıntı 10–1000 karakter olmalıdır.');
    if (data.note && data.note.length > 1000) throw new Error('Alıntı notu en fazla 1000 karakter olabilir.');
    if (data.chapterId && !chapterExists) throw new Error('Bu kitaba ait bir bölüm seçin.');
    if ((!data.chapterId || data.pageNumber != null) && (!Number.isInteger(data.pageNumber) || data.pageNumber < 1 || data.pageNumber > book.pageCount)) throw new Error('Kitaptaki geçerli bir sayfa numarasını girin.');
    if (!data.chapterId) data = { ...data, chapterTitle: '', chapterIndex: undefined, location: undefined };
  } else {
    if (!chapterExists) throw new Error('Bu kitaba ait bir bölüm seçin.');
  }
  const normalized = normalizeText(data.text);
  
  // Çakışma kontrolü
  const existing = await Quote.findOne({ 
    normalizedText: normalized, 
    bookId: data.bookId,
    isRepost: false 
  });
  if (existing) throw new Error('QUOTE_EXISTS:' + existing._id.toString());

  const quote = new Quote({ 
    userId, 
    ...data,
    normalizedText: normalized,
  });
  const saved = await quote.save();

  await ScoreService.onQuoteCreated(userId);

  return await populateQuote(Quote.findById(saved._id));
};

export const repostQuote = async (userId, originalQuoteId, repostComment, isSpoiler) => {
  const original = await Quote.findById(originalQuoteId);
  if (!original) throw new Error('Orijinal alıntı bulunamadı.');

  // Aynı kullanıcı zaten repost etmiş mi?
  if (original.repostedBy.includes(userId)) {
    throw new Error('Bu alıntıyı zaten yeniden paylaştınız.');
  }

  // Repost kaydını oluştur
  const repost = new Quote({
    text: original.text,
    normalizedText: original.normalizedText,
    note: original.note,
    userId,
    bookId: original.bookId,
    chapterId: original.chapterId,
    pageNumber: original.pageNumber,
    chapterTitle: original.chapterTitle,
    chapterIndex: original.chapterIndex,
    location: original.location,
    isRepost: true,
    originalQuoteId,
    repostComment: repostComment || '',
    isSpoiler: isSpoiler !== undefined ? isSpoiler : original.isSpoiler,
  });
  
  await repost.save();

  await ScoreService.onRepostCreated(userId);

  // Orijinal alıntıya repostlayanı ekle
  await Quote.findByIdAndUpdate(originalQuoteId, {
    $push: { repostedBy: userId }
  });

  return await populateQuote(Quote.findById(repost._id));
};

export const getQuotesByUser = async (userId, viewer) => {
  if (!canViewProfile(await User.findById(userId), viewer)) return [];
  return await populateQuote(
    Quote.find({ userId, isDeleted: false }).sort({ createdAt: -1 })
  );
};

export const getQuotesByBook = async (bookId) => {
  return await populateQuote(
    Quote.find({ bookId, isRepost: false, isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() } }).sort({ createdAt: -1 })
  );
};


export const getQuotesFeed = async (limit = 20, offset = 0, sortBy = 'popular') => {
  const sortOption = sortBy === 'popular'
    ? { likesCount: -1, createdAt: -1 }
    : { createdAt: -1 };

  const results = await Quote.aggregate([
    { $match: { isRepost: false, isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() } } },
    { $addFields: { likesCount: { $size: { $ifNull: ['$likedBy', []] } } } },
    { $sort: sortOption },
    { $skip: offset },
    { $limit: limit },
    {
      $lookup: {
        from: 'users', localField: 'userId', foreignField: '_id', as: 'userId',
        pipeline: [{ $project: { username: 1, fullName: 1, profilePicture: 1 } }]
      }
    },
    {
      $lookup: {
        from: 'books', localField: 'bookId', foreignField: '_id', as: 'bookId',
        pipeline: [{ $project: { title: 1, imageUrl: 1 } }]
      }
    },
    {
      $lookup: {
        from: 'quotes', localField: 'originalQuoteId', foreignField: '_id', as: 'originalQuoteId',
        pipeline: [
          { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId',
            pipeline: [{ $project: { username: 1, fullName: 1, profilePicture: 1 } }] } },
          { $lookup: { from: 'books', localField: 'bookId', foreignField: '_id', as: 'bookId',
            pipeline: [{ $project: { title: 1, imageUrl: 1 } }] } },
          { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$bookId', preserveNullAndEmptyArrays: true } },
        ]
      }
    },
    { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$bookId', preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$originalQuoteId', preserveNullAndEmptyArrays: true } },
  ]);

  return results.map(q => ({
    ...q,
    id: q._id.toString(),
    userId: q.userId ? { ...q.userId, id: q.userId._id.toString() } : null,
    bookId: q.bookId ? { ...q.bookId, id: q.bookId._id.toString() } : null,
    originalQuoteId: q.originalQuoteId ? {
      ...q.originalQuoteId,
      id: q.originalQuoteId._id.toString(),
      userId: q.originalQuoteId.userId ? { ...q.originalQuoteId.userId, id: q.originalQuoteId.userId._id.toString() } : null,
      bookId: q.originalQuoteId.bookId ? { ...q.originalQuoteId.bookId, id: q.originalQuoteId.bookId._id.toString() } : null,
    } : null,
  }));
};

export const searchQuotes = async (query, limit = 20, offset = 0) => {
  // Kitap ve yazar aramak için önce eşleşen kitapları bul
  const matchingBooks = await Book.find({
    title: { $regex: query, $options: 'i' }
  }).select('_id');

  const bookIds = matchingBooks.map(b => b._id);

  const results = await Quote.find({
    isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() },
    $or: [
      { text: { $regex: query, $options: 'i' } },
      { bookId: { $in: bookIds } },
    ],
    isRepost: false,
  })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);

  // Populate
  return await populateQuote(Quote.find({ _id: { $in: results.map(r => r._id) } }));
};

export const deleteQuote = async (id, userId) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new Error('Alıntı bulunamadı.');
  if (quote.userId.toString() !== userId.toString()) throw new Error('Yetkisiz işlem.');
  
  // Repostsa orijinalden kaldır
  if (quote.isRepost && quote.originalQuoteId) {
    await Quote.findByIdAndUpdate(quote.originalQuoteId, {
      $pull: { repostedBy: userId }
    });
  }
  
  // Değilse tüm repostları da sil
  if (!quote.isRepost) {
    await Quote.deleteMany({ originalQuoteId: id });
    await QuoteComment.deleteMany({ quoteId: id });
  }

  await Quote.findByIdAndDelete(id);
  return { code: 200, message: 'Alıntı silindi.' };
};

export const toggleQuoteLike = async (id, userId) => {
  const quote = await Quote.findById(id);
  if (!quote) throw new Error('Alıntı bulunamadı.');
  const alreadyLiked = quote.likedBy.includes(userId);
  alreadyLiked ? quote.likedBy.pull(userId) : quote.likedBy.push(userId);
  await quote.save();
  if (!alreadyLiked) await notifyUser(quote.userId, 'quoteLike', {
    type: 'QUOTE_LIKED', title: 'Alıntın beğenildi', message: 'Paylaştığın alıntı yeni bir beğeni aldı.',
    icon: '❤️', meta: { quoteId: quote._id },
  }, userId);
  return await populateQuote(Quote.findById(id));
};

// --- YORUM FONKSİYONLARI ---
export const addQuoteComment = async (userId, quoteId, content) => {
  const comment = new QuoteComment({ userId, quoteId, content });
  const saved = await comment.save();
  return await QuoteComment.findById(saved._id)
    .populate('userId', 'username fullName profilePicture');
};

export const getQuoteComments = async (quoteId) => {
  return await QuoteComment.find({ quoteId, isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() } })
    .populate('userId', 'username fullName profilePicture')
    .sort({ createdAt: -1 });
};

export const deleteQuoteComment = async (id, userId) => {
  const comment = await QuoteComment.findById(id);
  if (!comment) throw new Error('Yorum bulunamadı.');
  if (comment.userId.toString() !== userId.toString()) throw new Error('Yetkisiz işlem.');
  await QuoteComment.findByIdAndDelete(id);
  return { code: 200, message: 'Yorum silindi.' };
};

export const toggleQuoteCommentLike = async (id, userId) => {
  const comment = await QuoteComment.findById(id);
  if (!comment) throw new Error('Yorum bulunamadı.');
  const alreadyLiked = comment.likedBy.includes(userId);
  alreadyLiked ? comment.likedBy.pull(userId) : comment.likedBy.push(userId);
  await comment.save();
  return await QuoteComment.findById(id)
    .populate('userId', 'username fullName profilePicture');
};

export const unrepostQuote = async (userId, originalQuoteId) => {
  // Kullanıcının bu alıntıya ait repostunu bul
  const repost = await Quote.findOne({
    userId,
    originalQuoteId,
    isRepost: true,
  });
  if (!repost) throw new Error('Yeniden paylaşım bulunamadı.');

  await Quote.findByIdAndDelete(repost._id);

  // Orijinal alıntıdan kullanıcıyı çıkar
  await Quote.findByIdAndUpdate(originalQuoteId, {
    $pull: { repostedBy: userId },
  });

  return true;
};
