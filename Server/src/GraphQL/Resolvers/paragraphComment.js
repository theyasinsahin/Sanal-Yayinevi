// src/graphql/resolvers/paragraphComment.js
import * as ParagraphCommentService from '../../services/paragraphCommentService.js';

export default {
  Query: {
    getParagraphComments: (_, { chapterId, paragraphIndex }) =>
      ParagraphCommentService.getParagraphComments(chapterId, paragraphIndex),
    getParagraphCommentCounts: (_, { chapterId }) =>
      ParagraphCommentService.getParagraphCommentCounts(chapterId),
  },

  Mutation: {
    addParagraphComment: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ParagraphCommentService.addParagraphComment(user._id, args);
    },
    deleteParagraphComment: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ParagraphCommentService.deleteParagraphComment(id, user._id);
    },
    toggleParagraphCommentLike: async (_, { id }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ParagraphCommentService.toggleParagraphCommentLike(id, user._id);
    },
  },

  ParagraphComment: {
    user: (parent) => parent.userId,
  },
};