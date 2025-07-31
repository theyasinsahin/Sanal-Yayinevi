// models/book.js
import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema({}, { _id: false });
CommentSchema.add({
  id: Number,
  userId: String,
  bookId: String,
  content: String,
  date: {type:Date, default: Date.now},
  likes: Number,
  replies: [CommentSchema]
});

const ChapterSchema = new mongoose.Schema({
  id: Number,
  bookId: String,
  title: String,
  content: String,
  createdAt: {type:Date, default: Date.now},
  updatedAt: {type:Date, default: Date.now},
}, { _id: false });

const BookSchema = new mongoose.Schema({
  title: String,
  authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
  },  
  imageUrl: { type:String, default: '' },
  pageCount: { type:Number, default: 0 },
  genre: String,
  tags: {type: [String], default: []},
  description: String,
  stats: {
    views: {type: Number, default: 0},
    shares: {type: Number, default: 0},
    likes: {type: Number, default: 0},
    comments: {type: Number, default: 0},
  },
  createdAt: {type:Date, default: Date.now},
  updatedAt: {type:Date, default: Date.now},
  publishDate: {type:Date, default: Date.now},
  comments: {type: [CommentSchema], default: []},
  chapters: {type: [ChapterSchema], default: []},
});

export default mongoose.model('Book', BookSchema);
