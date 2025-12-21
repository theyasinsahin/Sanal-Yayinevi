import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
},
  title: String,
  content: String,
  pageCount: { type: Number, default: 0 },
}, {timestamps: true});

export default mongoose.model('Chapter', ChapterSchema);
