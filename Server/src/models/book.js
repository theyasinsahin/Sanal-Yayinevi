import mongoose from 'mongoose';

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
  publishDate: {type:Date, default: Date.now},
  comments: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  default: [],
},
chapters: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],
  default: [],
}
},{timestamps: true});

export default mongoose.model('Book', BookSchema);
