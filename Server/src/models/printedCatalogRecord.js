import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true, unique: true },
  batchId: { type: String, required: true },
  manifestSha256: { type: String, required: true },
  entrySha256: { type: String, required: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Immutable saved observations, aliases, omissions, and cover review.
  verification: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
}, { timestamps: true });
schema.index({ batchId: 1 });
export default mongoose.model('PrintedCatalogRecord', schema);
