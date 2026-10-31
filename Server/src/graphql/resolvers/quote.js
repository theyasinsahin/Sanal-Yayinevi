// src/graphql/resolvers/quote.js
import * as QuoteService from '../../services/quoteService.js';
import { getLoaders } from '../loaders.js';

const visibleText = field => async (quote, _, context) => {
  const chapter = quote.chapterId ? await getLoaders(context).chapters.load(quote.chapterId) : null;
  return chapter?.isHidden ? '' : quote[field] || '';
};

export default {
  Query: {
    getQuotesByBook: (_, { bookId }) => QuoteService.getQuotesByBook(bookId),
    getQuotesByUser: (_, { userId }, { user }) => QuoteService.getQuotesByUser(userId, user),
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
    text: visibleText('text'),
    note: visibleText('note'),
    repostComment: visibleText('repostComment'),
    user: (parent) => parent.userId,
    book: (parent) => parent.bookId,
    originalQuote: (parent) => parent.originalQuoteId,
    commentCount: async (parent) => {
      const QuoteComment = (await import('../../models/quoteComment.js')).default;
      return await QuoteComment.countDocuments({ quoteId: parent._id || parent.id });
    },
  },

  QuoteComment: {
    content: async (comment, _, context) => {
      const quote = comment.quoteId ? await getLoaders(context).quotes.load(comment.quoteId) : null;
      const chapter = quote?.chapterId ? await getLoaders(context).chapters.load(quote.chapterId) : null;
      return chapter?.isHidden ? '' : comment.content;
    },
    user: (parent) => parent.userId,
  },
};
