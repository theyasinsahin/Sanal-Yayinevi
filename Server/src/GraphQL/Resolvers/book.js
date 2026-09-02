import * as BookService from '../../services/bookService.js';
import * as UserService from '../../services/userService.js';
import * as ScoreService from '../../services/scoreService.js';

export default {
  Query: {
    getBookById: async (_, { id }) => BookService.findBookById(id),

    getBooksByAuthorId: async (_, { authorId }, {req, user}) => BookService.findBooksByAuthorId(authorId),

    getBooksByGenre: async (_, { genre }) => BookService.findBooksByGenre(genre),

    getAllBooks: async () => BookService.findAllBooks(),

    getBookByTitle: async (_, { title }) => BookService.findBookByTitle(title),

    searchBooks: async (_, { query }) => BookService.searchBooksInDb(query),
  },

  Mutation: {
    createBook: async (_, args, { user }) => {
    try {
        // Kullanıcı doğrulaması
        if(!user) throw new Error("Giriş yapmalısınız");

        // args objesinin içindeki 'genre', "bilim-kurgu" gibi bir metin olarak Servis'e gider
        const newBook = await BookService.createBook(args, user._id);
        
        return newBook;
    } catch (error) {
        throw new Error(error.message || "Kitap oluşturulurken bir hata meydana geldi.");
    }
},

    updateBook: async (_, { bookId, ...updates }, { user, Book }) => {
        if(!user) throw new Error("Giriş yapmalısınız");

        const book = await BookService.findBookById(bookId);
        if (!book) throw new Error("Kitap bulunamadı"); // Kitap kontrolü eklendi

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }

        // Import edilen Book modeli kullanılıyor
        return Book.findByIdAndUpdate(bookId, updates, { new: true });
    },

    deleteBook: async (_, { id }, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");
        
        const book = await BookService.findBookById(id);
        if (!book) throw new Error("Kitap bulunamadı");

         if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }
        
        // Soft delete — kitabı ve bağlı chapter/comment'leri isDeleted:true olarak işaretler,
        // hiçbir döküman veritabanından gerçekten silinmez.
        await BookService.softDeleteBook(id);

        return { code: 200, message: "Silindi" };
    },

    incrementBookViews: async (_, { id }) => {
        return BookService.incrementViews(id);
    },

    likeBook: async (_, { bookId }, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");
        
        return BookService.toggleLike(bookId, user._id);
    },

    updateBookStatus: async (_, { bookId, status, fundingTarget, printConfig }, { user, Book }) => {
        if(!user) throw new Error("Giriş yapmalısınız");

        const book = await BookService.findBookById(bookId);
        if (!book) throw new Error("Kitap bulunamadı");

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }

        const updates = { status };
        if (fundingTarget !== undefined) updates.fundingTarget = fundingTarget;
        if (printConfig) updates.printConfig = printConfig;

        const updatedBook = await Book.findByIdAndUpdate(bookId, updates, { new: true });

        // Kitap ilk kez PUBLISHED durumuna geçiyorsa puan ver
        if (status === 'PUBLISHED' && book.status !== 'PUBLISHED') {
            await ScoreService.onBookPublished(user._id);
        }

        return updatedBook;    
    }
  },

  // Field Resolvers
  Book: {
    comments: async (parent, args, { Comment }) => {
        // Hata önlemek için try-catch
        try {
            return await Comment.find({ bookId: parent.id, isDeleted: false }).sort({ date: -1 });
        } catch (e) { return [] }
    },

    chapters: async (parent, args, { Chapter }) => {
         try {
            return await Chapter.find({ bookId: parent.id, isDeleted: false }).sort({ createdAt: 1 });
         } catch (e) { return [] }
    },

    genre: async (parent, args, { Genre }) => {
        try {
            return await Genre.findById(parent.genreId);
        } catch (e) { return null }
    },

    commentCount: async (parent, args, { Comment }) => {
        try {
            return await Comment.countDocuments({ bookId: parent.id, isDeleted: false });
        } catch (e) { return 0 }
    },
    
    // --- KRİTİK DÜZELTME BURADA ---
    author: async (parent, args, { User }) => {
        // 1. authorId var mı?
        if (!parent.authorId) return null;

        try {
            // 2. Kullanıcıyı bul (silinmiş kullanıcıyı yazar olarak göstermeyelim)
            const author = await User.findOne({ _id: parent.authorId, isDeleted: false });
            return author; // Bulamazsa null döner, Schema'daki '!' kalktığı için sorun olmaz.
        } catch (error) {
            // 3. ID formatı bozuksa veya DB hatası varsa null dön, patlatma.
            console.error("Yazar bulunurken hata:", error.message);
            return null;
        }
    },
  }
};