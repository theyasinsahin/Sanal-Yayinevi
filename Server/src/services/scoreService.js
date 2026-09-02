// src/services/scoreService.js
import UserScore from '../models/userScore.js';
import PointEvent from '../models/pointEvent.js';
import Badge from '../models/badge.js';
import UserBadge from '../models/userBadge.js';
import Notification from '../models/notification.js';
import mongoose from 'mongoose';

const POINTS = {
  quote:        10,
  comment:       5,
  repost:        3,
  publish:      50,
  chapter:      15,
  readMinute:    1,
  sessionEntry:  5,
};

// --- YARDIMCI: Periyot başlangıç tarihlerini hesapla ---
// SQL'deki DATE_SUB(NOW(), INTERVAL 1 DAY) mantığı
const getPeriodStart = (period) => {
  const now = new Date();
  switch (period) {
    case 'daily':
      // Bugünün başlangıcı (00:00:00)
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      // Bu haftanın Pazartesi'si
      const day = now.getDay(); // 0=Pazar, 1=Pazartesi...
      const diff = (day === 0 ? -6 : 1 - day); // Pazartesi'ye geri git
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      return monday;
    case 'monthly':
      // Bu ayın ilk günü
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return null; // total — tarih filtresi yok
  }
};

// --- YARDIMCI: Puan ekle (PointEvent + UserScore) ---
const addPoints = async (userId, points, action) => {
  // 1. PointEvent kaydı oluştur (SQL'deki INSERT INTO point_events)
  await PointEvent.create({ userId, points, action });

  // 2. UserScore'daki totalPoints'i güncelle
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { totalPoints: points } },
    { upsert: true, new: true }
  );

  return score;
};

// --- BADGE KONTROLÜ ---
const checkAndAwardBadges = async (userId, stats) => {
  const allBadges = await Badge.find();
  const earnedBadgeIds = (await UserBadge.find({ userId }))
    .map(ub => ub.badgeId.toString());

  for (const badge of allBadges) {
    if (earnedBadgeIds.includes(badge._id.toString())) continue;
    const statValue = stats[badge.condition.stat] || 0;
    if (statValue >= badge.condition.threshold) {
      await UserBadge.create({ userId, badgeId: badge._id });
      await Notification.create({
        userId,
        type: 'BADGE_EARNED',
        title: 'Yeni Rozet Kazandın! 🏅',
        message: `${badge.icon} ${badge.name} rozeti kazandın: ${badge.description}`,
        icon: badge.icon,
        meta: { badgeKey: badge.key },
      });
    }
  }
};

// --- AKSİYON FONKSİYONLARI ---
export const onQuoteCreated = async (userId) => {
  await addPoints(userId, POINTS.quote, 'quote');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.quotesCreated': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.quote} Puan!`, message: 'Alıntı yaptığın için puan kazandın.', icon: '⭐', meta: { points: POINTS.quote } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onCommentCreated = async (userId) => {
  await addPoints(userId, POINTS.comment, 'comment');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.commentsCreated': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.comment} Puan!`, message: 'Yorum yaptığın için puan kazandın.', icon: '⭐', meta: { points: POINTS.comment } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onRepostCreated = async (userId) => {
  await addPoints(userId, POINTS.repost, 'repost');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.repostsCreated': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.repost} Puan!`, message: 'Alıntı repostladığın için puan kazandın.', icon: '⭐', meta: { points: POINTS.repost } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onBookPublished = async (userId) => {
  await addPoints(userId, POINTS.publish, 'publish');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.booksPublished': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.publish} Puan!`, message: 'Kitap yayınladığın için puan kazandın.', icon: '⭐', meta: { points: POINTS.publish } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onChapterAdded = async (userId) => {
  await addPoints(userId, POINTS.chapter, 'chapter');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.chaptersAdded': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.chapter} Puan!`, message: 'Bölüm eklediğin için puan kazandın.', icon: '⭐', meta: { points: POINTS.chapter } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onReadingMinutes = async (userId, minutes) => {
  if (minutes <= 0) return;
  const points = minutes * POINTS.readMinute;
  await addPoints(userId, points, 'readMinute');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.minutesRead': minutes } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${points} Puan!`, message: `${minutes} dakika okudun, puan kazandın.`, icon: '⭐', meta: { points, minutes } });
  await checkAndAwardBadges(userId, score.stats);
};

export const onSessionEntryAdded = async (userId) => {
  await addPoints(userId, POINTS.sessionEntry, 'sessionEntry');
  const score = await UserScore.findOneAndUpdate(
    { userId },
    { $inc: { 'stats.sessionEntriesCreated': 1 } },
    { upsert: true, new: true }
  );
  await Notification.create({ userId, type: 'POINTS_EARNED', title: `+${POINTS.sessionEntry} Puan!`, message: 'Oturuma katkı sağladığın için puan kazandın.', icon: '⭐', meta: { points: POINTS.sessionEntry } });
  await checkAndAwardBadges(userId, score.stats);
};

// --- LİDERBOARD ---
// SQL karşılığı:
// SELECT userId, SUM(points) as total
// FROM point_events
// WHERE createdAt >= :periodStart        -- periyot filtresi
// GROUP BY userId                        -- kullanıcı bazında topla
// ORDER BY total DESC                    -- en yüksekten sırala
// LIMIT 10                               -- ilk 10
export const getLeaderboard = async (period = 'totalPoints') => {
  const periodStart = getPeriodStart(period);

  // MongoDB Aggregation — SQL'deki GROUP BY + SUM mantığı
  const pipeline = [
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
    { $sort: { points: -1 } },

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
  return await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20);
};

export const markNotificationsRead = async (userId) => {
  await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return true;
};

export const getUnreadCount = async (userId) => {
  return await Notification.countDocuments({ userId, isRead: false });
};