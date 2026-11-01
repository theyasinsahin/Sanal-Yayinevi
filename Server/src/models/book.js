import mongoose from 'mongoose';

const BookSchema = new mongoose.Schema({
  urlSlug: { type: String, unique: true, sparse: true },
  kind: { type: String, enum: ['DIGITAL', 'PRINTED'], default: 'DIGITAL' },
  isbn: { type: String },
  printedAuthor: { type: String, default: '' },
  publisher: { type: String, default: '' },
  publicationYear: Number,
  publicationStatus: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'] },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publicationEvidenceUrl: { type: String, default: '' },
  purchaseUrl: { type: String, default: '' },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  claimVersion: { type: Number, default: 0 },
  title: { type: String, required: true },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  imageUrl: { type: String, default: '' },
  pageCount: { type: Number, default: 0 },
  genreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre' },
  // genreId and tags are retained only as reversible migration source data.
  formatId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassificationTerm' },
  genreIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Genre' }],
  tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClassificationTerm' }],
  narrativeFeatureIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClassificationTerm' }],
  targetAudienceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassificationTerm' },
  contentWarningIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClassificationTerm' }],
  classificationStatus: { type: String, enum: ['COMPLETE', 'NEEDS_REVIEW'], default: 'NEEDS_REVIEW' },
  classificationVersion: Number,
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
  // Additive fields. Missing legacy values are interpreted by applicationService.
  digitalStatus: { type: String, enum: ['DRAFT', 'PUBLISHED'] },
  writingStatus: { type: String, enum: ['WRITING', 'COMPLETED'] },
  completedAt: Date,
  printRevision: { type: Number, default: 0, min: 0 },
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
  adminArchiveId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminAudit' },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

BookSchema.index({ isDeleted: 1 });
BookSchema.index({ isbn: 1 }, { unique: true, partialFilterExpression: { isbn: { $type: 'string' } } });
BookSchema.index({ kind: 1, publicationStatus: 1, createdAt: -1 });
BookSchema.index({ isDeleted: 1, publishDate: -1, _id: -1 });
BookSchema.index({ isDeleted: 1, updatedAt: -1, _id: -1 });
BookSchema.index({ isDeleted: 1, 'stats.likes': -1, _id: -1 });
for (const field of ['formatId', 'genreIds', 'tagIds', 'narrativeFeatureIds', 'targetAudienceId']) {
  BookSchema.index({ isDeleted: 1, [field]: 1, publishDate: -1, _id: -1 });
}

export default mongoose.model('Book', BookSchema);
