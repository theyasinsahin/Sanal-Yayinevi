// src/graphql/resolvers/score.js
import * as ScoreService from '../../services/scoreService.js';

export default {
  Query: {
    getLeaderboard: async (_, { period }) => {
      return ScoreService.getLeaderboard(period || 'total');
    },
getUserScore: async (_, { userId }) => {
    return await ScoreService.getUserScore(userId);
  },    getUserRank: (_, { userId, period }) => ScoreService.getUserRank(userId, period || 'total'),
    getUserBadges: async (_, { userId }, { UserBadge }) => {
      return await UserBadge.find({ userId }).populate('badgeId');
    },
    getNotifications: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ScoreService.getNotifications(user._id);
    },
    getUnreadNotificationCount: async (_, __, { user }) => {
      if (!user) return 0;
      return ScoreService.getUnreadCount(user._id);
    },
  },

  Mutation: {
    addReadingMinutes: async (_, { minutes }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ScoreService.onReadingMinutes(user._id, minutes);
    },
    markNotificationsRead: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ScoreService.markNotificationsRead(user._id);
    },
  },

  UserBadge: {
    badge: (parent) => parent.badgeId,
  },

  UserScore: {
    userId: (parent) => parent.userId,
  },
};