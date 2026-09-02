// src/models/sessionEntry.js
import mongoose from 'mongoose';

const SessionEntrySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000,
  },
  likedBy: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'User',
    default: [],
  },

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

// Odanın yazılarını zamana göre çekmek için (en sık kullanılacak sorgu)
SessionEntrySchema.index({ sessionId: 1, createdAt: 1 });
SessionEntrySchema.index({ isDeleted: 1 });

export default mongoose.model('SessionEntry', SessionEntrySchema);