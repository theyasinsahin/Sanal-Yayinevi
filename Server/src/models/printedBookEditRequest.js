import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  changes: { type: mongoose.Schema.Types.Mixed, required: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  reason: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

schema.index({ bookId: 1, requesterId: 1 }, { unique: true, partialFilterExpression: { status: 'PENDING' } });
schema.index({ status: 1, createdAt: 1 });
export default mongoose.model('PrintedBookEditRequest', schema);
