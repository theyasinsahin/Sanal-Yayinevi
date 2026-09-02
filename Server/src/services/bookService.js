import Book from '../models/book.js';
import User from '../models/user.js';
import Genre from '../models/genre.js';
import Quote from '../models/quote.js';
import * as ScoreService from './scoreService.js';
import * as ChapterService from './chapterService.js';
import * as CommentService from './commentService.js';

// ── Okuma İşlemleri ──────────────────────────────────────────────
// Varsayılan olarak tüm okuma fonksiyonları silinmiş (isDeleted: true)
// kitapları hariç tutar. Admin panelinde silinenleri de görmek gerekirse
// includeDeleted: true geçilebilir.

export const findBookById = async (id, { includeDeleted = false } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) query.isDeleted = false;
  return await Book.findOne(query);
};

export const findAllBooks = async () => {
  return await Book.find({
    isDeleted: false,
    status: { $in: ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'] }
  }).sort({ createdAt: -1 });
};

// authorId'ye göre kitapları getir
export const findBooksByAuthorId = async (authorId) => {
  return await Book.find({ authorId, isDeleted: false }).sort({ createdAt: -1 });
};

export const findBooksByGenre = async (genre) => {
  return await Book.find({ genre, isDeleted: false });
};

export const findBookByTitle = async (title) => {
  return await Book.findOne({ title, isDeleted: false });
};

export const searchBooksInDb = async (query) => {
  const matchingUsers = await User.find({
    fullName: { $regex: query, $options: 'i' },
    isDeleted: false,
  }).select('_id');

  const matchingUserIds = matchingUsers.map(u => u._id);

  return await Book.find({
    isDeleted: false,
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { authorId: { $in: matchingUserIds } }
    ]
  });
};

export const createBook = async (bookData, userId) => {
  // genre slug kontrolü yerine genreId ile çalış
  if (!bookData.genreId) {
    throw new Error('Kitap oluşturulurken bir tür seçmek zorunludur.');
  }

  // genreId'nin geçerli bir Genre olduğunu doğrula
  const genreDoc = await Genre.findById(bookData.genreId);
  if (!genreDoc || !genreDoc.isActive) {
    throw new Error('Seçilen tür bulunamadı veya aktif değil.');
  }

  const newBook = new Book({
    ...bookData,
    authorId: userId
  });

  const savedBook = await newBook.save();
  await User.findByIdAndUpdate(userId, { $push: { usersBooks: savedBook._id } });

  return savedBook;
};

export const toggleLike = async (bookId, userId) => {
  const book = await Book.findOne({ _id: bookId, isDeleted: false });
  if (!book) throw new Error('Kitap bulunamadı.');

  if (book.likedBy.includes(userId)) {
    book.likedBy.pull(userId);
    book.stats.likes = Math.max(0, book.stats.likes - 1);
  } else {
    book.likedBy.push(userId);
    book.stats.likes += 1;
  }
  return await book.save();
};

export const incrementViews = async (bookId) => {
  return await Book.findOneAndUpdate(
    { _id: bookId, isDeleted: false },
    { $inc: { 'stats.views': 1 } },
    { new: true }
  );
};

export const findBooksByIds = async (bookIds) => {
  if (!bookIds || bookIds.length === 0) return [];
  return await Book.find({ _id: { $in: bookIds }, isDeleted: false });
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
  book.isDeleted = true;
  book.deletedAt = now;
  await book.save();

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