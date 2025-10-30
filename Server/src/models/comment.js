// src/models/comment.js
import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  content: String,
  date: { type: Date, default: Date.now },
  likes: Number,
  replies: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { _id: true });

export default mongoose.model('Comment', CommentSchema);