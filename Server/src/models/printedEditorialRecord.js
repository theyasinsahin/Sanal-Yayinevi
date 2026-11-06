import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  batchId: { type: String, required: true },
  manifestSha256: { type: String, required: true },
  entrySha256: { type: String, required: true },
  beforeSha256: { type: String, required: true },
  afterSha256: { type: String, required: true },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true },
  research: { type: mongoose.Schema.Types.Mixed, required: true },
  reviewedAt: { type: Date, required: true },
  appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
schema.index({ batchId: 1, bookId: 1 }, { unique: true });
export default mongoose.model('PrintedEditorialRecord', schema);
