import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  evidence: { type: String, required: true, maxlength: 3000 },
  evidenceUrl: { type: String, default: '' },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });
schema.index({ bookId: 1, claimantId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });
export default mongoose.model('BookClaim', schema);
