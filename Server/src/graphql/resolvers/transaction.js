import * as TransactionService from '../../services/transactionService.js';
import Transaction from '../../models/transaction.js';
import { requireAdmin } from '../../utils/adminAccess.js';

export default {
    Query: {
        getMyTransactions: async (_, __, { user }) => {
            if (!user) throw new Error("Giriş yapmalısınız.");
            
            // Servis üzerinden kullanıcının işlemlerini getir
            return TransactionService.findTransactionsByUserId(user._id);
        },

        getBookTransactions: async (_, { bookId }, context) => {
            await requireAdmin(context);
            // Servis üzerinden kitabın başarılı bağışlarını getir
            return TransactionService.findSuccessfulTransactionsByBookId(bookId);
        },

        getAllTransactions: async (_, __, context) => {
            await requireAdmin(context);
            
            return await Transaction.find({})
                .populate('userId')   // Gönderen (User)
                .populate('bookId')   // Hangi Kitaba (Book)
                .sort({ createdAt: -1 }); // En yeniden eskiye
        },
        
        getBookBackers: async (_, { bookId }, context) => {
            if (!context.user || context.user.role !== 'ADMIN') return [];
            await requireAdmin(context);
            return TransactionService.findBackersByBookId(bookId);
        },
    },

    Mutation: {
        initializePayment: () => TransactionService.createPaymentForm()
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
