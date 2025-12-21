import mongoose from 'mongoose';
import {authenticateUser} from '../../../utils/auth.js';
const updateBookTotalPageCount = async (bookId, BookModel, ChapterModel) => {
  try {
    const chapters = await ChapterModel.find({ bookId });
    // Tüm bölümlerin sayfa sayılarını topla
    const totalPages = chapters.reduce((sum, ch) => sum + (ch.pageCount || 0), 0);
    // Kitabı güncelle
    await BookModel.findByIdAndUpdate(bookId, { pageCount: totalPages });
  } catch (err) {
    console.error("Sayfa sayısı güncellenemedi:", err);
  }
};

export default{
    createChapter: async (_, { bookId, title, content, pageCount }, { Chapter, Book, User, req }) => {
    try {
        // 1. Kullanıcı Giriş Kontrolü
        const user = await authenticateUser(req, User);
        if (!user) {
            throw new Error("Bölüm oluşturmak için giriş yapmalısınız.");
        }

        // 2. Kitabı Bul (Yazarı kontrol etmek ve authorId almak için)
        const book = await Book.findById(bookId);
        if (!book) {
            throw new Error("Kitap bulunamadı.");
        }

        // 3. Yetki Kontrolü: Bu kitabı düzenlemeye yetkili mi?
        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
            throw new Error("Bu kitaba bölüm ekleme yetkiniz yok.");
        }

        // 4. Bölümü Oluştur (authorId EKLENDİ)
        const newChapter = await Chapter.create({
            bookId,
            title,
            content,
            pageCount: pageCount || 0,
            authorId: user._id // <-- HATAYI ÇÖZEN SATIR BURASI
        });

        // 5. Kitabın 'chapters' listesine ekle
        await Book.findByIdAndUpdate(bookId, { $push: { chapters: newChapter._id } });

        // 6. Toplam Sayfa Sayısını Güncelle (Daha önce yazdığımız fonksiyon)
        await updateBookTotalPageCount(bookId, Book, Chapter);

        return newChapter;
    } catch (error) {
        console.error("Error creating chapter:", error);
        throw new Error(error.message);
    }
},

    updateChapter: async (_, { chapterId, title, content, pageCount }, { Chapter, Book, User, req }) => { // 1. Book EKLENDİ
        
        console.log("UpdateChapter Tetiklendi!");
    console.log("Gelen ID:", chapterId);
    console.log("Gelen Sayfa Sayısı (pageCount):", pageCount);
        
        try {
        const user = await authenticateUser(req, User);
        if (!user) {
            throw new Error("Unauthorized");
        }
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            throw new Error("Chapter not found");
        }
        // --- DÜZELTME BAŞLANGICI ---
        
        // Bölümün bağlı olduğu Kitabı buluyoruz
        const book = await Book.findById(chapter.bookId);
        if (!book) {
            throw new Error("Book associated with this chapter not found");
        }
        
        // Yetki kontrolünü KİTAP üzerinden yapıyoruz (Bölümde authorId yok)
        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
            throw new Error("You are not authorized to update this chapter");
        }

        // --- DÜZELTME BİTİŞİ ---

        const updatedChapter = await Chapter.findByIdAndUpdate(
            chapterId,{ 
                ...(title && { title }), 
                ...(content && { content }),
                ...(pageCount !== undefined && { pageCount }) 
            },
            { new: true }
        );

        if (updatedChapter) {
            // Toplam sayfa sayısını güncelle
            await updateBookTotalPageCount(updatedChapter.bookId, Book, Chapter);
        }

         return updatedChapter;
        } catch (error) {
                console.error("Error updating chapter:", error);
                // Hatanın detayını frontend'e göndermek için:
                throw new Error(error.message); 
        }
    },

    deleteChapter: async (_, { id }, { Chapter, Book, User, req }) => {
        try {
            const user = await authenticateUser(req, User);
            if (!user) {
                throw new Error("Unauthorized");
            }

            const chapter = await Chapter.findById(id);
            if (!chapter) {
                throw new Error("Chapter not found");
            }

            if (chapter.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
                throw new Error("You are not authorized to delete this chapter");
            }

            const book = await Book.findById(chapter.bookId);
            if (book) {
                book.chapters.pull(chapter._id);
                await book.save();
            }

            await Chapter.deleteOne({ _id: id });
            return { code: 200, message: "Chapter deleted successfully" };
        } catch (error) {
            console.error("Error deleting chapter:", error);
            throw new Error(error.message);        
        }
    }

}