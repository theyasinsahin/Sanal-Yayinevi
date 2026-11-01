import { pendingFollowRequestCount } from './followService.js';
import UserScore from '../models/userScore.js';
import PointEvent from '../models/pointEvent.js';
import Notification from '../models/notification.js';
import mongoose from 'mongoose';
import { inactiveUserIds } from '../utils/activeUsers.js';
export { awardPoints, initializeScores, onQuoteCreated, onCommentCreated, onRepostCreated, onBookPublished, onChapterAdded, onSessionEntryAdded } from './scoreAwards.js';

import { getPeriodStart } from '../utils/scorePeriod.js';

export async function getScorePeriods(userId) {
  const starts = Object.fromEntries(['daily', 'weekly', 'monthly'].map(period => [period, getPeriodStart(period)]));
  const [totals] = await PointEvent.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: new Date(Math.min(...Object.values(starts).map(date => date.getTime()))) } } },
    { $group: { _id: null, ...Object.fromEntries(Object.entries(starts).map(([period, start]) => [period, { $sum: { $cond: [{ $gte: ['$createdAt', start] }, '$points', 0] } }])) } },
  ]);
  return totals || { daily: 0, weekly: 0, monthly: 0 };
}

export const getLeaderboard = async (period = 'totalPoints') => {
  const periodStart = getPeriodStart(period);

  // MongoDB Aggregation — SQL'deki GROUP BY + SUM mantığı
  const pipeline = [
    { $match: { userId: { $nin: await inactiveUserIds() } } },
    // WHERE createdAt >= periodStart
    ...(periodStart ? [{ $match: { createdAt: { $gte: periodStart } } }] : []),

    // GROUP BY userId, SUM(points)
    {
      $group: {
        _id: '$userId',
        points: { $sum: '$points' }
      }
    },

    // ORDER BY points DESC
    { $sort: { points: -1, _id: 1 } },

    // LIMIT 10
    { $limit: 10 },

    // JOIN users — SQL'deki LEFT JOIN users ON point_events.userId = users.id
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
        pipeline: [{ $project: { username: 1, fullName: 1, profilePicture: 1 } }]
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ];

  const results = await PointEvent.aggregate(pipeline);

  return results.map((entry, index) => ({
    rank: index + 1,
    user: entry.user ? { ...entry.user, id: entry.user._id.toString() } : null,
    points: entry.points,
  }));
};

// --- KULLANICI SIRASI ---
// SQL karşılığı:
// SELECT COUNT(*) + 1 as rank
// FROM (
//   SELECT userId, SUM(points) as total
//   FROM point_events WHERE createdAt >= :periodStart
//   GROUP BY userId
// ) ranked
// WHERE total > :userTotal
export const getUserRank = async (userId, period = 'total') => {
  const periodStart = getPeriodStart(period);
  const inactive = await inactiveUserIds();
  if (inactive.some(id => String(id) === String(userId))) return { rank: null, points: 0 };

  // Önce kullanıcının kendi puanını bul
  const userPipeline = [
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        ...(periodStart ? { createdAt: { $gte: periodStart } } : {})
      }
    },
    { $group: { _id: '$userId', points: { $sum: '$points' } } }
  ];

  const userResult = await PointEvent.aggregate(userPipeline);
  const userPoints = userResult[0]?.points || 0;

  if (userPoints === 0) return { rank: null, points: 0 };

  // Kaç kişi bu kullanıcıdan fazla puana sahip?
  const rankPipeline = [
    { $match: { userId: { $nin: inactive } } },
    ...(periodStart ? [{ $match: { createdAt: { $gte: periodStart } } }] : []),
    { $group: { _id: '$userId', points: { $sum: '$points' } } },
    { $match: { points: { $gt: userPoints } } },
    { $count: 'higherCount' }
  ];

  const rankResult = await PointEvent.aggregate(rankPipeline);
  const rank = (rankResult[0]?.higherCount || 0) + 1;

  return { rank, points: userPoints };
};

// --- DİĞER FONKSİYONLAR (değişmedi) ---
export const getUserScore = async (userId) => {
  return await UserScore.findOne({ 
    userId: new mongoose.Types.ObjectId(userId)
  }).populate('userId', 'username fullName profilePicture');
};

export const getNotifications = async (userId) => {
  return await Notification.find({ userId, type: { $ne: 'FOLLOW_REQUEST' } })
    .sort({ createdAt: -1 })
    .limit(20);
};

export const markNotificationsRead = async (userId) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return true;
};

export const getUnreadCount = async (userId) => {
  const [unread, pending] = await Promise.all([
    Notification.countDocuments({ userId, isRead: false, type: { $ne: 'FOLLOW_REQUEST' } }),
    pendingFollowRequestCount(userId),
  ]);
  return unread + pending;
};
