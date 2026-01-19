import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'TRY'
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
    default: 'PENDING'
  },
  // ÖNEMLİ DEĞİŞİKLİK:
  paymentProviderId: {
    type: String, 
    required: false // <-- Bunu false yapıyoruz veya required satırını tamamen siliyoruz.
  },
  paymentProvider: { // Opsiyonel: Hangi sağlayıcı olduğunu tutmak istersen
    type: String,
    default: 'IYZICO'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;