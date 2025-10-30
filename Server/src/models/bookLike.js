import mongoose from "mongoose";

const BookLikeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('BookLike', BookLikeSchema);