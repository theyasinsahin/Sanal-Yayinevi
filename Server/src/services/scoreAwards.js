import mongoose from 'mongoose';
import UserScore from '../models/userScore.js';
import PointEvent from '../models/pointEvent.js';
import Badge from '../models/badge.js';
import UserBadge from '../models/userBadge.js';
import Notification from '../models/notification.js';
import { publishScoreUpdate } from './scoreUpdates.js';

export const initializeScores = () => Promise.all([UserScore.init(), PointEvent.init(), Badge.init(), UserBadge.init(), Notification.init()]);

export async function awardPoints(userId, points, action, options = {}) {
  const { stat, amount = 1, sourceId, message, meta = {}, session: existingSession } = options;
  const operation = async session => {
    if (sourceId && await PointEvent.exists({ userId, action, sourceId }).session(session)) return UserScore.findOne({ userId }).session(session).exec();
    await PointEvent.create([{ userId, points, action, ...(sourceId ? { sourceId: String(sourceId) } : {}) }], { session });
    const increments = { totalPoints: points, ...(stat ? { [`stats.${stat}`]: amount } : {}) };
    const score = await UserScore.findOneAndUpdate({ userId }, { $inc: increments }, { upsert: true, new: true, session }).exec();
    await Notification.create([{ userId, type: 'POINTS_EARNED', title: `+${points} Puan!`, message, icon: '⭐', meta: { ...meta, points } }], { session });
    const badges = await Badge.find().session(session).exec();
    for (const badge of badges) {
      if ((score.stats[badge.condition.stat] || 0) < badge.condition.threshold) continue;
      const earned = await UserBadge.updateOne({ userId, badgeId: badge._id }, { $setOnInsert: { earnedAt: new Date() } }, { upsert: true, session }).exec();
      if (earned.upsertedCount) await Notification.create([{
        userId, type: 'BADGE_EARNED', title: 'Yeni Rozet Kazandın! 🏅',
        message: `${badge.icon} ${badge.name} rozeti kazandın: ${badge.description}`, icon: badge.icon, meta: { badgeKey: badge.key },
      }], { session });
    }
    return score;
  };
  if (existingSession) return operation(existingSession);
  await initializeScores();
  try {
    const score = await mongoose.connection.transaction(operation);
    await publishScoreUpdate(userId);
    return score;
  }
  catch (error) {
    if (error.code === 11000 && sourceId && await PointEvent.exists({ userId, action, sourceId })) return UserScore.findOne({ userId }).exec();
    throw error;
  }
}

export const onQuoteCreated = (userId, sourceId) => awardPoints(userId, 10, 'quote', { stat: 'quotesCreated', sourceId: sourceId && String(sourceId), message: 'Alıntı yaptığın için puan kazandın.' });
export const onCommentCreated = (userId, sourceId) => awardPoints(userId, 5, 'comment', { stat: 'commentsCreated', sourceId: sourceId && String(sourceId), message: 'Yorum yaptığın için puan kazandın.' });
export const onRepostCreated = (userId, sourceId) => awardPoints(userId, 3, 'repost', { stat: 'repostsCreated', sourceId: sourceId && String(sourceId), message: 'Alıntıyı yeniden paylaştığın için puan kazandın.' });
export const onBookPublished = (userId, sourceId) => awardPoints(userId, 50, 'publish', { stat: 'booksPublished', sourceId: sourceId && String(sourceId), message: 'Kitap yayınladığın için puan kazandın.' });
export const onChapterAdded = (userId, sourceId) => awardPoints(userId, 15, 'chapter', { stat: 'chaptersAdded', sourceId: sourceId && String(sourceId), message: 'Bölüm eklediğin için puan kazandın.' });
export const onSessionEntryAdded = (userId, sourceId) => awardPoints(userId, 5, 'sessionEntry', { stat: 'sessionEntriesCreated', sourceId: sourceId && String(sourceId), message: 'Oturuma katkı sağladığın için puan kazandın.' });
