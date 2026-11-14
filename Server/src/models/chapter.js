import mongoose from 'mongoose';
import { chapterWordCount } from '../utils/chapterLength.js';

const ChapterSchema = new mongoose.Schema({
  urlSlug: { type: String, unique: true, sparse: true },
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
  music: {
    type: new mongoose.Schema({
      url: { type: String, required: true },
      title: { type: String, required: true, maxlength: 160 },
      duration: { type: Number, required: true, min: 0, max: 600 },
      publicId: { type: String, required: true },
    }, { _id: false }),
    default: undefined,
  },
  musicVersion: { type: Number, default: 0, select: true },
  isHidden: { type: Boolean, default: false },
  wordCount: { type: Number, min: 0 },
  pageCount: { type: Number, default: 0 },

  // ── Soft-delete ──────────────────────────────────────────────────
  adminArchiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAudit' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

ChapterSchema.index({ isDeleted: 1 });
ChapterSchema.index({ isHidden: 1, _id: 1 });
ChapterSchema.pre('validate', function () {
  if (this.isModified('content') || this.wordCount == null) this.wordCount = chapterWordCount(this.content);
});
ChapterSchema.index({ bookId: 1, isDeleted: 1 });
ChapterSchema.index({ bookId: 1, isDeleted: 1, createdAt: 1, _id: 1 });

export default mongoose.model('Chapter', ChapterSchema);
