import { canReadChapter } from '../utils/chapterAccess.js';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import ReadingSession from '../models/readingSession.js';
import UserScore from '../models/userScore.js';
import Chapter from '../models/chapter.js';
import { findBookById } from './bookService.js';
import { awardPoints, initializeScores } from './scoreService.js';
import { publishScoreUpdate } from './scoreUpdates.js';

const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
async function readableBook(user, bookId, chapterId) {
  if (!mongoose.isObjectIdOrHexString(bookId) || !mongoose.isObjectIdOrHexString(chapterId)) throw fail('Geçerli bir kitap ve bölüm seçmelisiniz.');
  const book = await findBookById(bookId, { viewer: user });
  const chapter = book && await Chapter.findOne({ _id: chapterId, bookId, isDeleted: false }).select('content isHidden isDeleted').lean().exec();
  if (!canReadChapter(chapter, book, user) || !book || book.status === 'DRAFT' || (book.kind === 'PRINTED' && book.publicationStatus !== 'APPROVED') || !chapter?.content?.replace(/<[^>]*>/g, '').trim()) throw fail('Bu içerik için okuma puanı kazanılamaz.');
}

export async function startReadingSession(user, bookId, chapterId) {
  await readableBook(user, bookId, chapterId);
  await Promise.all([ReadingSession.init(), initializeScores()]);
  const now = new Date();
  const token = randomUUID();
  // A single active session per account prevents parallel tabs/devices from
  // multiplying reading time. Remainders live on UserScore, across sessions.
  await ReadingSession.findOneAndUpdate({ userId: user._id }, { $set: {
    token, bookId, lastHeartbeatAt: now, expiresAt: new Date(now.getTime() + 120000), clockBudgetMs: 0, sequence: 0,
  } }, { upsert: true, new: true }).exec();
  return { sessionId: token };
}

export async function reportReadingTime(user, { sessionId, sequence, seconds, chapterId }) {
  if (!Number.isSafeInteger(sequence) || sequence < 1 || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 60) throw fail('Okuma kaydı 1–60 saniye ve geçerli bir sıra numarası içermelidir.');
  await Promise.all([ReadingSession.init(), initializeScores()]);
  const result = await mongoose.connection.transaction(async session => {
    const state = await ReadingSession.findOne({ userId: user._id, token: sessionId }).session(session).exec();
    if (!state) throw fail('Okuma oturumu başka bir okuyucuda açıldı veya sona erdi.', 'READING_SESSION_REPLACED');
    const currentScore = () => UserScore.findOne({ userId: user._id }).session(session).exec();
    if (sequence <= state.sequence) return { sequence, acceptedSeconds: 0, earnedPoints: 0, score: await currentScore() };
    if (sequence !== state.sequence + 1) throw fail('Okuma kayıtları sırayla gönderilmelidir.');
    const now = Date.now();
    if (now > state.expiresAt.getTime()) throw fail('Okuma oturumunun süresi doldu.', 'READING_SESSION_EXPIRED');
    await readableBook(user, state.bookId, chapterId);
    const budget = Math.min(60000, state.clockBudgetMs + Math.max(0, now - state.lastHeartbeatAt.getTime()));
    if (seconds * 1000 > budget) throw fail('Okuma süresi geçen gerçek süreden uzun olamaz.', 'READING_TOO_FAST');
    state.clockBudgetMs = budget - seconds * 1000;
    state.lastHeartbeatAt = new Date(now);
    state.expiresAt = new Date(now + 120000);
    state.sequence = sequence;
    await state.save({ session });
    let score = await UserScore.findOneAndUpdate({ userId: user._id }, { $inc: { readingRemainderSeconds: seconds } }, { upsert: true, new: true, session }).exec();
    const minutes = Math.floor(score.readingRemainderSeconds / 60);
    if (minutes) {
      await UserScore.updateOne({ _id: score._id }, { $inc: { readingRemainderSeconds: -minutes * 60 } }, { session }).exec();
      score = await awardPoints(user._id, minutes, 'readMinute', {
        stat: 'minutesRead', amount: minutes, sourceId: `${sessionId}:${sequence}`,
        message: `${minutes} dakika okudun, puan kazandın.`, meta: { minutes }, session,
      });
    }
    return { sequence, acceptedSeconds: seconds, earnedPoints: minutes, score };
  });
  if (result.earnedPoints) await publishScoreUpdate(user._id);
  return result;
}
