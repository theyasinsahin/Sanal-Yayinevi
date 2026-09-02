// src/graphql/resolvers/bookFollow.js
import * as BookFollowService from '../../services/bookFollowService.js';

export default {
  Query: {
    isFollowingBook: async (_, { bookId }, { user }) => {
      if (!user) return false;
      return BookFollowService.isFollowingBook(user._id, bookId);
    },
    getFollowedBooks: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return BookFollowService.getFollowedBooks(user._id);
    },
  },

  Mutation: {
    toggleBookFollow: async (_, { bookId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return BookFollowService.toggleBookFollow(user._id, bookId);
    },
  },
};