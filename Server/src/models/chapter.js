import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: String,
  content: String,
  pageCount: { type: Number, default: 0 },

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

ChapterSchema.index({ isDeleted: 1 });
ChapterSchema.index({ bookId: 1, isDeleted: 1 });

export default mongoose.model('Chapter', ChapterSchema);