import { jest } from '@jest/globals';
import { graphql, parse, subscribe } from 'graphql';
import { connect, clearDatabase, closeDatabase } from './db.js';
import schema from '../src/graphql/schema.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import ReadingSession from '../src/models/readingSession.js';
import UserScore from '../src/models/userScore.js';
import PointEvent from '../src/models/pointEvent.js';
import Notification from '../src/models/notification.js';
import Badge from '../src/models/badge.js';
import UserBadge from '../src/models/userBadge.js';
import { startReadingSession, reportReadingTime } from '../src/services/readingService.js';
import * as scores from '../src/services/scoreService.js';
import { getPeriodStart } from '../src/utils/scorePeriod.js';

let reader, author, book, chapter, now;
beforeAll(async () => { await connect(); await scores.initializeScores(); await ReadingSession.init(); });
afterAll(closeDatabase);
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [reader, author] = await User.create(['reader', 'author'].map(username => ({ username, fullName: username, email: `${username}@example.test`, password: 'test' })));
  book = await Book.create({ title: 'Roman', authorId: author.id, status: 'WRITING' });
  chapter = await Chapter.create({ title: 'İlk Bölüm', bookId: book.id, authorId: author.id, content: '<p>Okunabilir bölüm metni.</p>' });
  now = Date.now(); jest.spyOn(Date, 'now').mockImplementation(() => now);
});
async function start(bookId = book.id, chapterId = chapter.id) {
  const result = await startReadingSession(reader, bookId, chapterId);
  now = (await ReadingSession.findOne({ userId: reader.id })).lastHeartbeatAt.getTime();
  return result.sessionId;
}
const report = (sessionId, sequence, seconds, chapterId = chapter.id) => reportReadingTime(reader, { sessionId, sequence, seconds, chapterId });
const advance = seconds => { now += seconds * 1000; };

test('four heartbeats credit one minute and immediately return the current score', async () => {
  const token = await start();
  for (let sequence = 1; sequence <= 4; sequence++) {
    advance(15);
    const result = await report(token, sequence, 15);
    expect(result.acceptedSeconds).toBe(15);
    expect(result.score.totalPoints).toBe(sequence === 4 ? 1 : 0);
  }
  expect((await UserScore.findOne({ userId: reader.id })).stats.minutesRead).toBe(1);
  expect(await PointEvent.countDocuments({ userId: reader.id })).toBe(1);
  expect(await Notification.countDocuments({ userId: reader.id, type: 'POINTS_EARNED' })).toBe(1);
});

test('concurrent duplicate requests are acknowledged without multiplying time or rewards', async () => {
  const token = await start(); advance(60);
  const results = await Promise.all([report(token, 1, 60), report(token, 1, 60), report(token, 1, 60)]);
  expect(results.filter(result => result.earnedPoints === 1)).toHaveLength(1);
  expect((await UserScore.findOne({ userId: reader.id })).totalPoints).toBe(1);
  expect(await PointEvent.countDocuments({ userId: reader.id })).toBe(1);
});

test('partial minutes survive a different book and a new reading session', async () => {
  const token = await start(); advance(26); await report(token, 1, 26);
  const other = await Book.create({ title: 'Diğer Roman', authorId: author.id, status: 'WRITING' });
  const part = await Chapter.create({ title: 'Bölüm', bookId: other.id, authorId: author.id, content: 'Metin' });
  const next = await start(other.id, part.id); advance(34);
  const result = await report(next, 1, 34, part.id);
  expect(result.score.totalPoints).toBe(1);
  expect(result.score.readingRemainderSeconds).toBe(0);
});

test('forged durations, out-of-order sequences and unrelated chapters are rejected', async () => {
  const token = await start();
  await expect(report(token, 1, 10000)).rejects.toThrow('1–60');
  await expect(report(token, 1, 60)).rejects.toThrow('gerçek');
  await expect(reportReadingTime(author, { sessionId: token, sequence: 1, seconds: 15, chapterId: chapter.id })).rejects.toMatchObject({ extensions: { code: 'READING_SESSION_REPLACED' } });
  advance(60);
  await expect(report(token, 2, 15)).rejects.toThrow('sırayla');
  const other = await Chapter.create({ title: 'Yabancı bölüm', bookId: new Book()._id, authorId: author.id, content: 'Metin' });
  await expect(report(token, 1, 15, other.id)).rejects.toThrow('puanı');
  expect(await PointEvent.countDocuments()).toBe(0);
});

test('only the most recent tab/device can record reading time', async () => {
  const old = await start(); const current = await start(); advance(15);
  await expect(report(old, 1, 15)).rejects.toMatchObject({ extensions: { code: 'READING_SESSION_REPLACED' } });
  expect((await report(current, 1, 15)).acceptedSeconds).toBe(15);
});

test('expired sessions cannot credit an offline backlog', async () => {
  const token = await start(); advance(121);
  await expect(report(token, 1, 60)).rejects.toMatchObject({ extensions: { code: 'READING_SESSION_EXPIRED' } });
  expect(await UserScore.countDocuments()).toBe(0);
});

test('an acknowledged packet can be safely recovered after expiration, but removed content cannot gain new points', async () => {
  const token = await start(); advance(15); await report(token, 1, 15); advance(121);
  expect((await report(token, 1, 15)).acceptedSeconds).toBe(0);
  const fresh = await start(); advance(15);
  await Book.updateOne({ _id: book.id }, { isDeleted: true });
  await expect(report(fresh, 1, 15)).rejects.toThrow('puanı');
  expect((await UserScore.findOne({ userId: reader.id })).readingRemainderSeconds).toBe(15);
});

test('unpublished, removed, empty and unapproved content cannot earn reading points', async () => {
  await Book.updateOne({ _id: book.id }, { status: 'DRAFT' });
  await expect(start()).rejects.toThrow('puanı');
  await Book.updateOne({ _id: book.id }, { status: 'WRITING' });
  await Chapter.updateOne({ _id: chapter.id }, { content: '<p> </p>' });
  await expect(start()).rejects.toThrow('puanı');
  await Chapter.updateOne({ _id: chapter.id }, { content: 'Metin', isDeleted: true });
  await expect(start()).rejects.toThrow('puanı');
  await Chapter.updateOne({ _id: chapter.id }, { isDeleted: false });
  await Book.updateOne({ _id: book.id }, { kind: 'PRINTED', publicationStatus: 'PENDING', submittedBy: reader.id });
  await expect(start()).rejects.toThrow('puanı');
});

test('the legacy minute endpoint is closed and the new GraphQL endpoint requires authentication', async () => {
  const old = await graphql({ schema, source: 'mutation{addReadingMinutes(minutes:10000){totalPoints}}', contextValue: { user: reader } });
  expect(old.errors[0].message).toContain('doğrulanmış');
  const anonymous = await graphql({ schema, source: `mutation{startReadingSession(bookId:"${book.id}",chapterId:"${chapter.id}"){sessionId}}`, contextValue: {} });
  expect(anonymous.errors[0].message).toContain('Giriş');
  expect(await PointEvent.countDocuments()).toBe(0);
});

test('a failure rolls back the reading sequence, score, event and notification together', async () => {
  const token = await start(); advance(60);
  jest.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('notification unavailable'));
  await expect(report(token, 1, 60)).rejects.toThrow('notification unavailable');
  expect(await PointEvent.countDocuments()).toBe(0);
  expect(await UserScore.countDocuments()).toBe(0);
  expect((await ReadingSession.findOne({ userId: reader.id })).sequence).toBe(0);
  expect((await report(token, 1, 60)).score.totalPoints).toBe(1);
});

test('content rewards and badges are atomic and awarded once for each source', async () => {
  await Badge.create({ key: 'first_quote', name: 'Alıntı', description: 'İlk alıntı', condition: { stat: 'quotesCreated', threshold: 1 } });
  await Promise.all([scores.onQuoteCreated(reader.id, 'quote-one'), scores.onQuoteCreated(reader.id, 'quote-one')]);
  await scores.onBookPublished(reader.id, book.id); await scores.onBookPublished(reader.id, book.id);
  await scores.onSessionEntryAdded(reader.id, 'entry-one');
  const score = await UserScore.findOne({ userId: reader.id });
  expect(score.totalPoints).toBe(65);
  expect(score.stats.quotesCreated).toBe(1);
  expect(score.stats.booksPublished).toBe(1);
  expect(score.stats.sessionEntriesCreated).toBe(1);
  expect(await UserBadge.countDocuments()).toBe(1);
  expect(await Notification.countDocuments({ type: 'BADGE_EARNED' })).toBe(1);
});

test('period totals are returned by the actual score query, with Istanbul calendar boundaries', async () => {
  expect(getPeriodStart('daily', new Date('2026-10-25T21:30:00Z')).toISOString()).toBe('2026-10-25T21:00:00.000Z');
  expect(getPeriodStart('weekly', new Date('2026-10-25T21:30:00Z')).toISOString()).toBe('2026-10-25T21:00:00.000Z');
  await scores.onQuoteCreated(reader.id, 'quote-one');
  const response = await graphql({ schema, source: `query{getUserScore(userId:"${reader.id}"){totalPoints dailyPoints weeklyPoints monthlyPoints}}`, contextValue: {} });
  expect(response.errors).toBeUndefined();
  expect(response.data.getUserScore).toMatchObject({ totalPoints: 10, dailyPoints: 10, weeklyPoints: 10, monthlyPoints: 10 });
});

test('score subscriptions deliver committed awards to the owner and the open leaderboard', async () => {
  const personal = await subscribe({ schema, document: parse('subscription{myScoreUpdated}'), contextValue: { user: reader } });
  const board = await subscribe({ schema, document: parse('subscription{leaderboardUpdated}'), contextValue: {} });
  const personalUpdate = personal.next(); const boardUpdate = board.next();
  await scores.onCommentCreated(reader.id, 'comment-one');
  expect((await personalUpdate).value.data.myScoreUpdated).toBe(true);
  expect((await boardUpdate).value.data.leaderboardUpdated).toBe(true);
  await personal.return(); await board.return();
});

test('removed accounts do not occupy leaderboard places or inflate active users ranks', async () => {
  await scores.onBookPublished(author.id, book.id);
  await scores.onCommentCreated(reader.id, 'comment-one');
  await User.updateOne({ _id: author.id }, { isDeleted: true });
  expect((await scores.getLeaderboard('total')).map(entry => entry.user.id)).toEqual([reader.id]);
  expect(await scores.getUserRank(reader.id)).toMatchObject({ rank: 1, points: 5 });
  expect(await scores.getUserRank(author.id)).toMatchObject({ rank: null, points: 0 });
});
