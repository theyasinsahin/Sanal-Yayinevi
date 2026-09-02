// src/graphql/resolvers/quote.js
import * as QuoteService from '../../services/quoteService.js';

export default {
  Query: {
    getQuotesByBook: (_, { bookId }) => QuoteService.getQuotesByBook(bookId),
    getQuotesByUser: (_, { userId }) => QuoteService.getQuotesByUser(userId),
    getQuotesFeed: (_, { limit, offset, sortBy }) => QuoteService.getQuotesFeed(limit, offset, sortBy),
    searchQuotes: (_, { query, limit, offset }) => QuoteService.searchQuotes(query, limit, offset),
    checkQuoteExists: (_, { text, bookId }) => QuoteService.checkQuoteExists(text, bookId),
    getQuoteComments: (_, { quoteId }) => QuoteService.getQuoteComments(quoteId),
  },

  Mutation: {
    createQuote: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.createQuote(user._id, args);
    },
    repostQuote: async (_, { originalQuoteId, repostComment, isSpoiler }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.repostQuote(user._id, originalQuoteId, repostComment, isSpoiler);
    },
    deleteQuote: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.deleteQuote(id, user._id);
    },
    toggleQuoteLike: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.toggleQuoteLike(id, user._id);
    },
    addQuoteComment: async (_, { quoteId, content }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.addQuoteComment(user._id, quoteId, content);
    },
    deleteQuoteComment: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.deleteQuoteComment(id, user._id);
    },
    toggleQuoteCommentLike: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.toggleQuoteCommentLike(id, user._id);
    },
    unrepostQuote: async (_, { originalQuoteId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return QuoteService.unrepostQuote(user._id, originalQuoteId);
    },
  },

  Quote: {
    user: (parent) => parent.userId,
    book: (parent) => parent.bookId,
    originalQuote: (parent) => parent.originalQuoteId,
    commentCount: async (parent) => {
      const QuoteComment = (await import('../../models/quoteComment.js')).default;
      return await QuoteComment.countDocuments({ quoteId: parent._id || parent.id });
    },
  },

  QuoteComment: {
    user: (parent) => parent.userId,
  },
};