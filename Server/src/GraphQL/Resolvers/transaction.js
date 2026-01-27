import * as TransactionService from '../../services/transactionService.js';
import * as BookService from '../../services/bookService.js';
import { authenticateUser } from '../../utils/auth.js';

export default {
    Query: {
        getMyTransactions: async (_, __, { req, User }) => {
            const user = await authenticateUser(req, User);
            if (!user) throw new Error("Giriş yapmalısınız.");
            
            // Servis üzerinden kullanıcının işlemlerini getir
            return TransactionService.findTransactionsByUserId(user._id);
        },

        getBookTransactions: async (_, { bookId }) => {
            // Servis üzerinden kitabın başarılı bağışlarını getir
            return TransactionService.findSuccessfulTransactionsByBookId(bookId);
        },

        getAllTransactions: async (_, __, context) => {
            if (!context.user || context.user.role !== 'ADMIN') {
                throw new Error("Yetkisiz işlem.");
            }
            
            return await Transaction.find({})
                .populate('userId')   // Gönderen (User)
                .populate('bookId')   // Hangi Kitaba (Book)
                .sort({ createdAt: -1 }); // En yeniden eskiye
        },
    },

    Mutation: {
        initializePayment: async (_, { bookId, amount }, { req, User }) => {
            // 1. Kullanıcı Doğrulama
            const user = await authenticateUser(req, User);
            if (!user) throw new Error("Ödeme yapmak için giriş yapmalısınız.");

            // 2. Kitap Kontrolü
            const book = await BookService.findBookById(bookId);
            if (!book) throw new Error("Kitap bulunamadı.");

            // 3. IP Adresi Alımı (Iyzico zorunlu tutar)
            // Proxy arkasındaysan (örn: Nginx, Heroku) 'x-forwarded-for' kullanılır.
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

            // 4. Servis Çağrısı
            // Servis bize { htmlContent, token, transactionId } dönecek
            return await TransactionService.createPaymentForm(user, book, amount, ip);
        }
    },

    // Field Resolvers (İlişkisel Veriler)
    Transaction: {
        user: async (parent, _, { User }) => {
            return User.findById(parent.userId);
        },
        book: async (parent, _, { Book }) => {
            return Book.findById(parent.bookId);
        }
    }
};