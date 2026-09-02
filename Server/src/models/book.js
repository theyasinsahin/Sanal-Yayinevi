import mongoose from 'mongoose';

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  imageUrl: { type: String, default: '' },
  pageCount: { type: Number, default: 0 },
  genreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre' },
  tags: { type: [String], default: [] },
  description: String,
  stats: {
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
  },
  likedBy: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: []
  },
  publishDate: { type: Date, default: Date.now },
  comments: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    default: [],
  },
  chapters: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' }],
    default: [],
  },
  status: {
    type: String,
    enum: ['DRAFT', 'WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'],
    default: 'DRAFT'
  },
  printConfig: {
    paperType: { type: String, enum: ['enzo', 'ivory', 'coated'], default: 'enzo' },
    coverType: { type: String, enum: ['hardcover', 'paperback'], default: 'paperback' },
    dimension: { type: String, default: '13.5x21' },
    estimatedPageCount: { type: Number, default: 0 }
  },
  fundingTarget: { type: Number, default: 0 },
  currentFunding: { type: Number, default: 0 },
  backerCount: { type: Number, default: 0 },
  fundingDeadline: { type: Date },

  // ── Soft-delete ──────────────────────────────────────────────────
  // Cascade mantığı (chapters/comments'in de soft-delete edilmesi ve
  // kullanıcıların savedBooks/usersBooks listelerinden çıkarılması)
  // services/bookService.js -> softDeleteBook() içinde yönetiliyor.
  // NOT: Bu yüzden aşağıda daha önce burada bulunan
  // 'findOneAndDelete' / 'deleteOne' pre-hook'ları ve cleanupOnDelete
  // fonksiyonu kaldırıldı — gerçek silme artık hiçbir yoldan tetiklenmemeli.
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

BookSchema.index({ isDeleted: 1 });

export default mongoose.model('Book', BookSchema);