import Chapter from '../models/chapter.js';
import Book from '../models/book.js'; // Sayfa sayısı güncellemek için lazım
import * as ScoreService from './scoreService.js';

// --- OKUMA İŞLEMLERİ ---
// Varsayılan olarak silinmiş (isDeleted: true) bölümler hariç tutulur.
export const findChapterById = async (id, { includeDeleted = false } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) query.isDeleted = false;
  return await Chapter.findOne(query);
};

export const findChaptersByBookId = async (bookId) => {
  // Bölüm numarasına veya oluşturulma tarihine göre sıralamak mantıklıdır
  return await Chapter.find({ bookId, isDeleted: false }).sort({ createdAt: 1 });
};

export const findChaptersByAuthorId = async (authorId) => {
  return await Chapter.find({ authorId, isDeleted: false });
};

export const findAllChapters = async () => {
  return await Chapter.find({ isDeleted: false });
};

// Helper: Kitabın toplam sayfa sayısını güncelle (silinmemiş bölümler üzerinden)
const updateBookTotalPageCount = async (bookId) => {
  const chapters = await Chapter.find({ bookId, isDeleted: false });
  const totalPages = chapters.reduce((sum, ch) => sum + (ch.pageCount || 0), 0);
  await Book.findByIdAndUpdate(bookId, { pageCount: totalPages });
};

// CREATE
export const createChapter = async (data) => {
  const newChapter = await Chapter.create(data);

  // Kitaba bölüm ID'sini ekle
  await Book.findByIdAndUpdate(data.bookId, { $push: { chapters: newChapter._id } });

  await ScoreService.onChapterAdded(data.authorId);

  // Sayfa sayısını güncelle
  await updateBookTotalPageCount(data.bookId);

  return newChapter;
};

// UPDATE
export const updateChapter = async (chapterId, data) => {
  const updatedChapter = await Chapter.findOneAndUpdate(
    { _id: chapterId, isDeleted: false },
    data,
    { new: true }
  );
  if (updatedChapter) {
    await updateBookTotalPageCount(updatedChapter.bookId);
  }
  return updatedChapter;
};

// DELETE (SOFT DELETE)
export const deleteChapter = async (id) => {
  const chapter = await Chapter.findOne({ _id: id, isDeleted: false });
  if (!chapter) throw new Error("Chapter not found");

  chapter.isDeleted = true;
  chapter.deletedAt = new Date();
  await chapter.save();

  // Kitabın chapters referans listesinden çıkar (döküman hâlâ var, sadece görünürlükten kaldırılıyor)
  await Book.findByIdAndUpdate(chapter.bookId, { $pull: { chapters: id } });

  // Sayfa sayısını güncelle
  await updateBookTotalPageCount(chapter.bookId);

  return { code: 200, message: "Chapter deleted successfully" };
};

// Bir kitap soft-delete edildiğinde tüm bölümlerini soft-delete etmek için
// bookService.softDeleteBook() tarafından çağrılır.
export const softDeleteChaptersByBookId = async (bookId) => {
  await Chapter.updateMany(
    { bookId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );
};