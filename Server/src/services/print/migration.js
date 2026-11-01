import Book from '../../models/book.js';
import Transaction from '../../models/transaction.js';

export async function migratePrintFields({ apply = false } = {}) {
  const filter = { kind: { $ne: 'PRINTED' } };
  const report = {
    mode: apply ? 'APPLY_ADDITIVE_FIELDS' : 'DRY_RUN',
    digitalBooks: await Book.countDocuments(filter),
    missingDigitalState: await Book.countDocuments({ ...filter, digitalStatus: { $exists: false } }),
    missingWritingState: await Book.countDocuments({ ...filter, writingStatus: { $exists: false } }),
    legacyFinancialBooks: await Book.countDocuments({ ...filter, status: { $in: ['FUNDING', 'FUNDED', 'PUBLISHED'] } }),
    legacyPendingPayments: await Transaction.countDocuments({ status: 'PENDING' }),
    note: 'Eski finans kayıtları ve Book.status/funding değerleri değiştirilmez. PUBLISHED eşlemesi ve geçmiş ödemeler operatör incelemesi gerektirir.',
  };
  if (apply) {
    const result = await Book.collection.updateMany(filter, [{ $set: {
      digitalStatus: { $cond: [{ $eq: [{ $type: '$digitalStatus' }, 'missing'] }, { $cond: [{ $eq: ['$status', 'DRAFT'] }, 'DRAFT', 'PUBLISHED'] }, '$digitalStatus'] },
      writingStatus: { $cond: [{ $eq: [{ $type: '$writingStatus' }, 'missing'] }, { $cond: [{ $in: ['$status', ['COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED']] }, 'COMPLETED', 'WRITING'] }, '$writingStatus'] },
      printRevision: { $ifNull: ['$printRevision', 0] },
    } }]);
    report.modified = result.modifiedCount;
  }
  return report;
}
