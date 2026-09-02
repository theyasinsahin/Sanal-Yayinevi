// src/graphql/resolvers/recommendation.js
import * as RecommendationService from '../../services/recommendationService.js';

export default {
  Query: {
    getRecommendations: async (_, { limit = 10, offset = 0 }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return RecommendationService.getRecommendations(user._id, { limit, offset });
    },

    getReadingProgress: async (_, { bookId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return RecommendationService.getReadingProgress(user._id, bookId);
    },

    getUserReadingHistory: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return RecommendationService.getUserReadingHistory(user._id);
    },

    getUserPreference: async (_, __, { user }) => {
        if (!user) throw new Error('Giriş yapmalısınız.');

        const pref = await RecommendationService.getUserPreference(user._id);
        if (!pref) return null;

        return {
            id:                  pref._id.toString(),
            userId:              pref.userId?.toString(),
            preferredGenres:     pref.preferredGenres ?? [],
            onboardingCompleted: pref.onboardingCompleted ?? false,
        };
    },
  },

  Mutation: {
    markChapterAsRead: async (_, { bookId, chapterId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      const progress = await RecommendationService.markChapterAsRead(user._id, bookId, chapterId);
      return {
        ...progress.toObject(),
        id: progress._id?.toString(), // ← aynı düzeltme burada da
      };    
    },

    saveUserPreference: async (_, { genreIds }, { user }) => {
        if (!user) throw new Error('Giriş yapmalısınız.');

        const pref = await RecommendationService.saveUserPreference(user._id, genreIds);

        // toObject() veya spread yerine alanları açıkça map'le
        return {
            id:                  pref._id.toString(),
            userId:              pref.userId.toString(),
            preferredGenres:     pref.preferredGenres ?? [],
            onboardingCompleted: pref.onboardingCompleted ?? true,
        };
    },
  },

  // Field resolver: ReadingProgress.bookId populate edilmiş Book objesi döner
  UserPreference: {
    preferredGenres: async (parent, _, { Genre }) => {
      if (!parent.preferredGenres?.length) return [];
      if (typeof parent.preferredGenres[0] === 'object' && parent.preferredGenres[0].name) {
        return parent.preferredGenres;
      }
      return Genre.find({ _id: { $in: parent.preferredGenres } });
    },
  },

  ReadingProgress: {
    bookId: async (parent, _, { Book }) => {
      if (parent.bookId && typeof parent.bookId === 'object' && parent.bookId.title) {
        return parent.bookId;
      }
      return Book.findById(parent.bookId);
    },
    lastReadAt: (parent) => {
      return parent.lastReadAt
        ? new Date(parent.lastReadAt).toISOString()
        : new Date().toISOString();
    },
  },
};