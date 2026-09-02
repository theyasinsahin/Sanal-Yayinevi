// src/models/session.js
import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },
  description: {
    type: String,
    default: '',
    maxlength: 500,
  },
  type: {
    type: String,
    enum: ['OPEN', 'FOLLOWERS_ONLY', 'PRIVATE'],
    required: true,
    default: 'OPEN',
  },
  // Sadece PRIVATE tipinde kullanılır, bcrypt ile hashlenmiş
  accessCode: {
    type: String,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  tags: {
    type: [String],
    default: [],
  },
  // Kaç farklı kullanıcı yazı yazdı (denormalized — her yeni entry'de güncellenir)
  participantCount: {
    type: Number,
    default: 0,
  },

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

// Liste sayfası için: aktif + yeni olanlar önce
SessionSchema.index({ isActive: 1, createdAt: -1 });
SessionSchema.index({ isDeleted: 1 });

export default mongoose.model('Session', SessionSchema);