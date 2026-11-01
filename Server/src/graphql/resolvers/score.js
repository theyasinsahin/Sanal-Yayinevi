// src/graphql/resolvers/score.js
import * as ScoreService from '../../services/scoreService.js';
import * as ReadingService from '../../services/readingService.js';
import { pubsub } from '../../config/pubsub.js';

function periodPoints(period) {
  return async (parent, _, context) => {
    const userId = String(parent.userId?._id || parent.userId?.id || parent.userId);
    context.scorePeriods ||= new Map();
    if (!context.scorePeriods.has(userId)) context.scorePeriods.set(userId, ScoreService.getScorePeriods(userId));
    return (await context.scorePeriods.get(userId))[period];
  };
}

export default {
  Subscription: {
    myScoreUpdated: { subscribe: (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return pubsub.asyncIterableIterator(`SCORE_UPDATED:${user._id}`);
    } },
    leaderboardUpdated: { subscribe: () => pubsub.asyncIterableIterator('LEADERBOARD_UPDATED') },
  },
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
    addReadingMinutes: async (_, __, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      throw new Error('Okuma puanı için uygulamayı yenileyip doğrulanmış okuma oturumunu kullanın.');
    },
    startReadingSession: async (_, { bookId, chapterId }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ReadingService.startReadingSession(user, bookId, chapterId);
    },
    reportReadingTime: async (_, args, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return ReadingService.reportReadingTime(user, args);
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
    dailyPoints: periodPoints('daily'),
    weeklyPoints: periodPoints('weekly'),
    monthlyPoints: periodPoints('monthly'),
  },
};
