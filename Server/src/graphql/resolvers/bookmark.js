// src/graphql/resolvers/bookmark.js
import * as BookmarkService from '../../services/bookmarkService.js';

export default {
  Query: {
    getBookmark: async (_, { bookId }, { user }) => {
      if (!user) return null;
      return BookmarkService.getBookmark(user._id, bookId);
    },
  },

  Mutation: {
    setBookmark: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return BookmarkService.setBookmark(user._id, args);
    },
    removeBookmark: async (_, { bookId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return BookmarkService.removeBookmark(user._id, bookId);
    },
  },
};