// src/models/comment.js
import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  content: String,
  date: { type: Date, default: Date.now },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  replies: { type: [mongoose.Schema.Types.Mixed], default: [] },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },

  // ── Soft-delete ──────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { _id: true });

CommentSchema.index({ isDeleted: 1 });
CommentSchema.index({ bookId: 1, isDeleted: 1 });

export default mongoose.model('Comment', CommentSchema);