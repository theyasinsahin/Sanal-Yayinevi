import Chapter from '../models/chapter.js';
import Book from '../models/book.js'; // Sayfa sayısı güncellemek için lazım
// --- OKUMA İŞLEMLERİ ---
export const findChapterById = async (id) => {
  return await Chapter.findById(id);
};

export const findChaptersByBookId = async (bookId) => {
  // Bölüm numarasına veya oluşturulma tarihine göre sıralamak mantıklıdır
  return await Chapter.find({ bookId }).sort({ createdAt: 1 });
};

export const findChaptersByAuthorId = async (authorId) => {
  return await Chapter.find({ authorId });
};

export const findAllChapters = async () => {
  return await Chapter.find();
};

// Helper: Kitabın toplam sayfa sayısını güncelle
const updateBookTotalPageCount = async (bookId) => {
    const chapters = await Chapter.find({ bookId });
    const totalPages = chapters.reduce((sum, ch) => sum + (ch.pageCount || 0), 0);
    await Book.findByIdAndUpdate(bookId, { pageCount: totalPages });
};

// CREATE
export const createChapter = async (data) => {
    const newChapter = await Chapter.create(data);
    
    // Kitaba bölüm ID'sini ekle
    await Book.findByIdAndUpdate(data.bookId, { $push: { chapters: newChapter._id } });
    
    // Sayfa sayısını güncelle
    await updateBookTotalPageCount(data.bookId);
    
    return newChapter;
};

// UPDATE
export const updateChapter = async (chapterId, data) => {
    const updatedChapter = await Chapter.findByIdAndUpdate(chapterId, data, { new: true });
    if(updatedChapter) {
        await updateBookTotalPageCount(updatedChapter.bookId);
    }
    return updatedChapter;
};

// DELETE
export const deleteChapter = async (id) => {
    const chapter = await Chapter.findById(id);
    if (!chapter) throw new Error("Chapter not found");
    
    // Kitaptan ID'yi sil
    await Book.findByIdAndUpdate(chapter.bookId, { $pull: { chapters: id } });
    
    await Chapter.deleteOne({ _id: id });
    
    // Sayfa sayısını güncelle
    await updateBookTotalPageCount(chapter.bookId);
    
    return { code: 200, message: "Chapter deleted successfully" };
};