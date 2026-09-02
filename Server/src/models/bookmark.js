// src/models/bookmark.js
import mongoose from 'mongoose';

const BookmarkSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  bookId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Book',    required: true },
  chapterId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  chapterIndex:   { type: Number, required: true },
  paragraphIndex: { type: Number, required: true },
  chapterTitle:   { type: String, default: '' },
}, { timestamps: true });

// Her kullanıcının her kitap için yalnızca bir ayracı olsun
BookmarkSchema.index({ userId: 1, bookId: 1 }, { unique: true });

export default mongoose.model('Bookmark', BookmarkSchema);