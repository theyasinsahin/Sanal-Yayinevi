import { validateClassification } from '../../services/classificationService.js';
import { inactiveUserIds } from '../../utils/activeUsers.js';
import { canViewProfile, sameUser } from '../../utils/profileAccess.js';
import * as BookService from '../../services/bookService.js';
import * as UserService from '../../services/userService.js';
import { isPrintedBook } from '../../utils/printedBooks.js';
import { getLoaders, selectedFields } from '../loaders.js';
import { updateDigitalStatus } from '../../services/print/applicationService.js';
import { onBookPublished } from '../../services/scoreAwards.js';
import { fundingSummary, isPublishedDigitalBook } from '../../services/bookFundingService.js';

export default {
  Query: {
    getBookById: async (_, { id }, { user }) => BookService.findBookById(id, { viewer: user }),

    getBooksByAuthorId: async (_, { authorId }, { user }) => {
      const profile = await UserService.findUserById(authorId);
      if (!canViewProfile(profile, user)) return [];
      const books = await BookService.findBooksByAuthorId(authorId);
      return sameUser(profile, user) || user?.role === 'ADMIN' ? books : books.filter(book => book.status !== 'DRAFT');
    },


    getAllBooks: async () => BookService.findAllBooks(),

    getBookByTitle: async (_, { title }) => BookService.findBookByTitle(title),

    searchBooks: async (_, { query }) => BookService.searchBooksInDb(query),
  },

  Mutation: {
    createBook: async (_, args, { user }) => {
    try {
        // Kullanıcı doğrulaması
        if(!user) throw new Error("Giriş yapmalısınız");

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
        if (isPrintedBook(book)) throw new Error('Basılı kitap künyesi genel kitap düzenleme işlemiyle değiştirilemez.');

        if (book.authorId.toString() !== user._id.toString() && user.role !== 'ADMIN') {
             throw new Error("Yetkiniz yok.");
        }

        // Import edilen Book modeli kullanılıyor
        const { classification, ...metadata } = updates;
        const validated = classification ? await validateClassification(classification, user._id) : {};
        return Book.findByIdAndUpdate(bookId, { $set: { ...metadata, ...validated } }, { new: true, runValidators: true });
    },

    deleteBook: async (_, { id }, { user }) => {
        if(!user) throw new Error("Giriş yapmalısınız");
        
        const book = await BookService.findBookById(id);
        if (!book) throw new Error("Kitap bulunamadı");

        if (isPrintedBook(book) && user.role !== 'ADMIN') throw new Error('Basılı katalog kayıtlarını yalnızca yönetici kaldırabilir.');

         if (String(book.authorId) !== user._id.toString() && user.role !== 'ADMIN') {
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

    updateBookStatus: async (_, args, context) => {
      const book = await updateDigitalStatus(context, args);
      // Preserve the historical PUBLISHED API alias and its idempotent publication award.
      if (args.status === 'PUBLISHED') await onBookPublished(book.authorId, book.id);
      return book;
    }
  },

  // Field Resolvers
  Book: {
    fundingSummary: async (parent, _, context) => {
      if (!isPublishedDigitalBook(parent) || !parent.authorId) return null;
      const loaders = getLoaders(context);
      if (!await loaders.users.load(parent.authorId)) return null;
      const campaign = Object.hasOwn(parent, '_fundingCampaign') ? parent._fundingCampaign :
        await loaders.bookCampaigns.load(parent.id || parent._id);
      return fundingSummary(campaign);
    },
    comments: async (parent, args, { Comment }) => {
        // Hata önlemek için try-catch
        try {
            return await Comment.find({ bookId: parent.id, isDeleted: false, userId: { $nin: await inactiveUserIds() } }).sort({ date: -1 });
        } catch (e) { return [] }
    },

    chapters: async (parent, args, context, info) => {
         try {
            getLoaders(context).books.prime(parent.id || parent._id, parent);
            const query = context.Chapter.find({ bookId: parent.id, isDeleted: false, authorId: { $nin: await getLoaders(context).inactiveIds() } }).sort({ createdAt: 1, _id: 1 });
            if (info && !selectedFields(info).has('content')) query.select('-content');
            return await query.exec();
         } catch (e) { return [] }
    },

    commentCount: async (parent, args, context) => {
        try {
            return await getLoaders(context).commentCounts.load(parent.id);
        } catch (e) { return 0 }
    },
    
    // --- KRİTİK DÜZELTME BURADA ---
    author: async (parent, args, context) => {
        // 1. authorId var mı?
        if (!parent.authorId) return null;

        try {
            // 2. Kullanıcıyı bul (silinmiş kullanıcıyı yazar olarak göstermeyelim)
            const author = await getLoaders(context).users.load(parent.authorId);
            return author; // Bulamazsa null döner, Schema'daki '!' kalktığı için sorun olmaz.
        } catch (error) {
            // 3. ID formatı bozuksa veya DB hatası varsa null dön, patlatma.
            console.error("Yazar bulunurken hata:", error.message);
            return null;
        }
    },
  }
};
