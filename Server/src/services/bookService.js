import { notifyUser } from './notificationService.js';
import { inactiveUserIds } from '../utils/activeUsers.js';
import Book from '../models/book.js';
import User from '../models/user.js';
import { validateClassification } from './classificationService.js';
import Quote from '../models/quote.js';
import * as ScoreService from './scoreService.js';
import * as ChapterService from './chapterService.js';
import * as CommentService from './commentService.js';
import { isPrintedBook, visiblePrintedFilter, digitalBookFilter } from '../utils/printedBooks.js';
import { FundingCampaign } from '../models/printFunding.js';

// ── Okuma İşlemleri ──────────────────────────────────────────────
// Varsayılan olarak tüm okuma fonksiyonları silinmiş (isDeleted: true)
// kitapları hariç tutar. Admin panelinde silinenleri de görmek gerekirse
// includeDeleted: true geçilebilir.

export const findBookById = async (id, { includeDeleted = false, viewer } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) query.isDeleted = false;
  // Printed editions remain catalog records even without a Betik author account.
  const book = await Book.findOne(query);
  if (!book || includeDeleted) return book;
  if (isPrintedBook(book)) {
    return book.publicationStatus === 'APPROVED' || viewer?.role === 'ADMIN' || (viewer && String(book.submittedBy) === String(viewer._id || viewer.id)) ? book : null;
  }
  return (await inactiveUserIds()).some(userId => String(userId) === String(book.authorId)) ? null : book;
};

export const findAllBooks = async () => {
  return await Book.find({
    ...digitalBookFilter,
    isDeleted: false,
    authorId: { $nin: await inactiveUserIds() },
    status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] }
  }).sort({ createdAt: -1 });
};

// authorId'ye göre kitapları getir
export const findBooksByAuthorId = async (authorId) => {
  if ((await inactiveUserIds()).some(id => String(id) === String(authorId))) return [];
  return await Book.find({ authorId, isDeleted: false }).sort({ createdAt: -1 });
};

export const findBookByTitle = async (title) => {
  return await Book.findOne({ ...visiblePrintedFilter, title, isDeleted: false, authorId: { $nin: await inactiveUserIds() }, status: { $ne: 'DRAFT' } });
};

export const searchBooksInDb = async (query) => {
  const matchingUsers = await User.find({
    fullName: { $regex: query, $options: 'i' },
    isDeleted: false,
  }).select('_id');

  const matchingUserIds = matchingUsers.map(u => u._id);

  return await Book.find({
    ...digitalBookFilter,
    isDeleted: false,
    authorId: { $nin: await inactiveUserIds() },
    status: { $ne: 'DRAFT' },
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { authorId: { $in: matchingUserIds } }
    ]
  });
};

export const createBook = async (bookData, userId) => {
  const { classification, ...metadata } = bookData;
  const validated = await validateClassification(classification, userId);
  const newBook = new Book({
    ...metadata,
    ...validated,
    authorId: userId
  });

  const savedBook = await newBook.save();
  await User.findByIdAndUpdate(userId, { $push: { usersBooks: savedBook._id } });

  return savedBook;
};

export const toggleLike = async (bookId, userId) => {
  const book = await Book.findOne({ ...visiblePrintedFilter, _id: bookId, isDeleted: false });
  if (!book) throw new Error('Kitap bulunamadı.');

  if (book.likedBy.includes(userId)) {
    book.likedBy.pull(userId);
    book.stats.likes = Math.max(0, book.stats.likes - 1);
  } else {
    book.likedBy.push(userId);
    book.stats.likes += 1;
    await notifyUser(book.authorId, 'bookLike', { type: 'BOOK_LIKED', title: 'Kitabın beğenildi', message: 'Kitabın yeni bir beğeni aldı: ' + book.title, icon: '❤️', meta: { bookId } }, userId);
  }
  return await book.save();
};

export const incrementViews = async (bookId) => {
  return await Book.findOneAndUpdate(
    { ...visiblePrintedFilter, _id: bookId, isDeleted: false },
    { $inc: { 'stats.views': 1 } },
    { new: true }
  );
};

export const findBooksByIds = async (bookIds) => {
  if (!bookIds || bookIds.length === 0) return [];
  return await Book.find({ ...visiblePrintedFilter, _id: { $in: bookIds }, isDeleted: false, authorId: { $nin: await inactiveUserIds() }, status: { $ne: 'DRAFT' } });
};

export const findDraftsByAuthorId = async (authorId) => {
  return await Book.find({ authorId, status: 'DRAFT', isDeleted: false }).sort({ createdAt: -1 });
};

// ── Silme İşlemi (SOFT DELETE) ───────────────────────────────────
// Kitabı ve ona bağlı bölüm/yorumları GERÇEKTEN silmez; hepsini
// isDeleted:true olarak işaretler. Bu sayede veri geri getirilebilir
// ve ileride bir "restoreBook" ihtiyacı çıkarsa altyapı hazır olur.
export const softDeleteBook = async (bookId) => {
  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new Error('Kitap bulunamadı.');

  const now = new Date();

  // 1. Kitabı işaretle
  if (await FundingCampaign.exists({ bookId, $or: [{ activeLock: true }, { state: 'REFUNDING' }, { state: 'SUCCEEDED', productionState: { $nin: ['COMPLETED', 'CANCELLED'] } }] })) throw new Error('Aktif kampanya/üretim varken kitap kaldırılamaz. Önce kontrollü iptal sürecini yürütün.');
  const changed = await Book.updateOne({ _id: book._id, isDeleted: false, $or: [{ printRevision: book.printRevision || 0 }, { printRevision: { $exists: false } }] }, { $set: { isDeleted: true, deletedAt: now }, $inc: { printRevision: 1 } });
  if (!changed.modifiedCount) throw new Error('Kitap başka bir işlemde değişti; güncel durumu yeniden yükleyin.');
  book.isDeleted = true; book.deletedAt = now;

  // 2. Bağlı bölümleri soft-delete et
  await ChapterService.softDeleteChaptersByBookId(bookId);

  // 3. Bağlı yorumları soft-delete et
  await CommentService.softDeleteCommentsByBookId(bookId);

  // 3b. Bu kitaba ait alıntıları (Quote) soft-delete et
  await Quote.updateMany(
    { bookId, isDeleted: false },
    { isDeleted: true, deletedAt: now }
  );

  // 4. Kullanıcıların savedBooks / usersBooks / followedBooks
  //    listelerinden referansı çıkar. Bu, Book dökümanını SİLMEZ,
  //    sadece artık silinmiş bir kitabın başka kullanıcıların
  //    listelerinde görünmesini engeller. İstenirse geri döndürülebilir.
  await User.updateMany(
    { $or: [{ savedBooks: bookId }, { usersBooks: bookId }, { followedBooks: bookId }] },
    { $pull: { savedBooks: bookId, usersBooks: bookId, followedBooks: bookId } }
  );

  return book;
};
