// src/models/paragraphComment.js
import mongoose from 'mongoose';

const ParagraphCommentSchema = new mongoose.Schema({
  bookId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Book',    required: true },
  chapterId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  paragraphIndex: { type: Number, required: true },
  content:        { type: String, required: true },
  likedBy:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
}, { timestamps: true });

ParagraphCommentSchema.index({ chapterId: 1, paragraphIndex: 1 });

export default mongoose.model('ParagraphComment', ParagraphCommentSchema);