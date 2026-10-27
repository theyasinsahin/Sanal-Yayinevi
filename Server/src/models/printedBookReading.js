import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  review: { type: String, default: '', maxlength: 3000 },
  readAt: { type: Date, required: true, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  adminArchiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAudit' },
}, { timestamps: true });
schema.index({ userId: 1, bookId: 1 }, { unique: true });
schema.index({ userId: 1, isDeleted: 1, readAt: -1, _id: -1 });
export default mongoose.model('PrintedBookReading', schema);
