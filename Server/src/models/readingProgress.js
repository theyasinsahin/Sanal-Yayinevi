// src/models/readingProgress.js
import mongoose from 'mongoose';

const ReadingProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  completedChapters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chapter',
    default: [],
  }],
  lastReadAt: {
    type: Date,
    default: Date.now,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Bir kullanıcı bir kitap için tek kayıt tutabilir
ReadingProgressSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export default mongoose.model('ReadingProgress', ReadingProgressSchema);