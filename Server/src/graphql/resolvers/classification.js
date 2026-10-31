import { getClassificationOptions, searchTags, validateClassification } from '../../services/classificationService.js';
import Book from '../../models/book.js';
import { getLoaders } from '../loaders.js';
const many = async (loader, ids = []) => (await loader.loadMany(ids)).filter(item => item && !(item instanceof Error));
export default {
  Mutation: {
    updateBookClassification: async (_, { bookId, classification }, { user }) => {
      if (!user || user.isDeleted || user.isActive === false) throw new Error('Giriş yapmalısınız.');
      const book = await Book.findOne({ _id: bookId, isDeleted: false });
      if (!book) throw new Error('Kitap bulunamadı.');
      const actorId = String(user._id || user.id);
      const permitted = user.role === 'ADMIN' || String(book.authorId) === actorId || (book.kind === 'PRINTED' && book.publicationStatus !== 'APPROVED' && String(book.submittedBy) === actorId);
      if (!permitted) throw new Error('Bu eserin sınıflandırmasını değiştirme yetkiniz yok.');
      const validated = await validateClassification(classification, user._id || user.id);
      return Book.findOneAndUpdate({ _id: bookId, isDeleted: false }, { $set: validated }, { new: true, runValidators: true });
    },
  },
  Query: { getClassificationOptions: () => getClassificationOptions(), searchClassificationTags: (_, { search }) => searchTags(search) },
  Book: {
    format: (book, _, context) => book.formatId ? getLoaders(context).classificationTerms.load(book.formatId) : null,
    genres: (book, _, context) => many(getLoaders(context).genres, book.genreIds),
    classificationTags: (book, _, context) => many(getLoaders(context).classificationTerms, book.tagIds),
    narrativeFeatures: (book, _, context) => many(getLoaders(context).classificationTerms, book.narrativeFeatureIds),
    targetAudience: (book, _, context) => book.targetAudienceId ? getLoaders(context).classificationTerms.load(book.targetAudienceId) : null,
    contentWarnings: (book, _, context) => many(getLoaders(context).classificationTerms, book.contentWarningIds),
    tags: async (book, _, context) => (await many(getLoaders(context).classificationTerms, book.tagIds)).map(tag => tag.name),
    classificationStatus: book => book.classificationStatus || 'NEEDS_REVIEW',
  },
};
