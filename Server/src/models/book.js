import mongoose from 'mongoose';

const BookSchema = new mongoose.Schema({
  title: {type: String, required: true},
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
  },
  likedBy: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
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

BookSchema.pre('findOneAndDelete', async function(next) {
    // Silinmekte olan kitabı bul
    const book = await this.model.findOne(this.getQuery());
    
    if (book) {
        // TRIGGER GÖREVİ: Kitaba bağlı chapter'ları ve yorumları sil
        await mongoose.model('Chapter').deleteMany({ _id: { $in: book.chapters } });
        await mongoose.model('Comment').deleteMany({ _id: { $in: book.comments } });
        console.log('Trigger çalıştı: Bağlı veriler temizlendi.');
    }
    next();
});

export default mongoose.model('Book', BookSchema);
