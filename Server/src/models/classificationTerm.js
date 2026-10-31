import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  kind: { type: String, enum: ['FORMAT', 'FEATURE', 'AUDIENCE', 'WARNING', 'TAG'], required: true, immutable: true },
  slug: { type: String, required: true, immutable: true, maxlength: 100, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 1000 },
  normalizedName: { type: String },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ kind: 1, slug: 1 }, { unique: true });
schema.index({ kind: 1, normalizedName: 1 }, { unique: true, partialFilterExpression: { normalizedName: { $type: 'string' } } });
schema.index({ kind: 1, isActive: 1, sortOrder: 1 });
schema.index({ kind: 1, createdBy: 1, createdAt: 1 });
export default mongoose.model('ClassificationTerm', schema);
