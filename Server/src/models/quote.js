// src/models/quote.js
import mongoose from 'mongoose';

const QuoteSchema = new mongoose.Schema({
  text: { type: String, required: true },
  normalizedText: { type: String, required: true }, // çakışma tespiti için
  note: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  chapterTitle: { type: String, default: '' },
  chapterIndex: { type: Number, default: 0 },
  location: {
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
  },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],

  // Repost alanları
  isRepost: { type: Boolean, default: false },
  originalQuoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', default: null },
  repostComment: { type: String, default: '' }, // repost sırasında eklenen yorum
  repostedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  isSpoiler: { type: Boolean, default: false }, // spoiler içeren alıntılar için

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

// Normalize için index
QuoteSchema.index({ normalizedText: 1, bookId: 1 });
QuoteSchema.index({ isDeleted: 1 });

export default mongoose.model('Quote', QuoteSchema);