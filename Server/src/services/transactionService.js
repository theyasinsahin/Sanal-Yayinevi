import Transaction from '../models/transaction.js';

// Legacy checkout is deliberately disabled; use the versioned sandbox campaign API.
export const createPaymentForm = async () => { throw new Error('Eski ödeme akışı kapalı. Onaylı kampanya sandbox akışını kullanın.'); };

export const findSuccessfulTransactionsByBookId = bookId => Transaction.find({ bookId, status: 'SUCCESS' }).sort({ createdAt: -1 }).limit(100).exec();

export const findTransactionsByUserId = async (userId) => {
    return await Transaction.find({ userId: userId }).sort({ createdAt: -1 });
};

export const findBackersByBookId = async (bookId) => {
  const transactions = await Transaction.find({
    bookId,
    status: 'SUCCESS',
  })
    .populate('userId', 'username fullName profilePicture')
    .sort({ createdAt: -1 });

  // Aynı kullanıcı birden fazla destek vermişse tekrarı kaldır
  const seen = new Set();
  return transactions
    .filter(t => {
      const id = t.userId?._id?.toString();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(t => ({ ...t.userId.toObject(), id: t.userId._id.toString() }));
};
