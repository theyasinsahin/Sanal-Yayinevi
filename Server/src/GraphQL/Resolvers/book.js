import * as BookService from '../../services/bookService.js';
import * as UserService from '../../services/userService.js';
import { authenticateUser } from '../../utils/auth.js';
// Eğer Mutation içinde direkt Book modeli kullanacaksan import etmelisin:
import Book from '../../models/book.js'; 

export default {
  Query: {
    getBookById: async (_, { id }) => BookService.findBookById(id),

    getBooksByAuthorId: async (_, { authorId }, {req, User}) => BookService.findBooksByAuthorId(authorId, {req, User}),

    getBooksByGenre: async (_, { genre }) => BookService.findBooksByGenre(genre),

    getAllBooks: async () => BookService.findAllBooks(),

    getBookByTitle: async (_, { title }) => BookService.findBookByTitle(title),

    searchBooks: async (_, { query }) => BookService.searchBooksInDb(query),
  },

  Mutation: {
    createBook: async (_, args, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");

        return BookService.createBook(args, user._id);
    },

    updateBook: async (_, { bookId, ...updates }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");

        const book = await BookService.findBookById(bookId);
        if (!book) throw new Error("Kitap bulunamadı"); // Kitap kontrolü eklendi

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }

        // Import edilen Book modeli kullanılıyor
        return Book.findByIdAndUpdate(bookId, updates, { new: true });
    },

    deleteBook: async (_, { id }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");
        
        const book = await BookService.findBookById(id);
        if (!book) throw new Error("Kitap bulunamadı");

         if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }
        
        // Silme işlemini de Book modeli üzerinden yapalım
        await Book.findByIdAndDelete(id);

        return { code: 200, message: "Silindi" };
    },

    incrementBookViews: async (_, { id }) => {
        return BookService.incrementViews(id);
    },

    likeBook: async (_, { bookId }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");
        
        return BookService.toggleLike(bookId, user._id);
    },

    updateBookStatus: async (_, { bookId, status, fundingTarget, printConfig }, { req, User }) => {
        const user = await authenticateUser(req, User);
        if(!user) throw new Error("Giriş yapmalısınız");

        const book = await BookService.findBookById(bookId);
        if (!book) throw new Error("Kitap bulunamadı");

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }

        const updates = { status };
        if (fundingTarget !== undefined) updates.fundingTarget = fundingTarget;
        if (printConfig) updates.printConfig = printConfig;

        return await Book.findByIdAndUpdate(bookId, updates, { new: true });
    }
  },

  // Field Resolvers
  Book: {
    comments: async (parent, args, { Comment }) => {
        // Hata önlemek için try-catch
        try {
            return await Comment.find({ bookId: parent.id }).sort({ date: -1 });
        } catch (e) { return [] }
    },

    chapters: async (parent, args, { Chapter }) => {
         try {
            return await Chapter.find({ bookId: parent.id }).sort({ createdAt: 1 });
         } catch (e) { return [] }
    },

    commentCount: async (parent, args, { Comment }) => {
        try {
            return await Comment.countDocuments({ bookId: parent.id });
        } catch (e) { return 0 }
    },
    
    // --- KRİTİK DÜZELTME BURADA ---
    author: async (parent, args, { User }) => {
        // 1. authorId var mı?
        if (!parent.authorId) return null;

        try {
            // 2. Kullanıcıyı bul
            const author = await User.findById(parent.authorId);
            return author; // Bulamazsa null döner, Schema'daki '!' kalktığı için sorun olmaz.
        } catch (error) {
            // 3. ID formatı bozuksa veya DB hatası varsa null dön, patlatma.
            console.error("Yazar bulunurken hata:", error.message);
            return null;
        }
    },
  }
};