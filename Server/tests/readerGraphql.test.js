import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Genre from '../src/models/genre.js';
import Notification from '../src/models/notification.js';

jest.setTimeout(30000);
let reader, other, book, chapter, genre;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [reader, other] = await User.create(['reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash' })));
  genre = await Genre.create({ name: 'Gizem', slug: 'gizem', classificationVersion: 1 });
  book = await Book.create({ title: 'Public book', authorId: other.id, status: 'WRITING', genreIds: [genre.id] });
  chapter = await Chapter.create({ title: 'First chapter', authorId: other.id, bookId: book.id, content: '<p>Content</p>' });
});
const run = (source, variables = {}, user = reader) => graphql({ schema, source, variableValues: variables, contextValue: { user, Book, User, Genre } });

test('bookmarks preserve paragraph position, use authoritative chapter titles, and remain private per reader', async () => {
  const source = 'mutation($book:ID!,$chapter:ID!){setBookmark(bookId:$book,chapterId:$chapter,chapterIndex:99,paragraphIndex:3,chapterTitle:"Forged"){chapterId chapterIndex paragraphIndex chapterTitle updatedAt}}';
  const saved = await run(source, { book: book.id, chapter: chapter.id });
  expect(saved.errors).toBeUndefined();
  expect(saved.data.setBookmark).toMatchObject({ chapterId: chapter.id, chapterIndex: 0, paragraphIndex: 3, chapterTitle: 'First chapter' });
  expect(Number.isNaN(Date.parse(saved.data.setBookmark.updatedAt))).toBe(false);
  const query = 'query($book:ID!){getBookmark(bookId:$book){paragraphIndex}}';
  expect((await run(query, { book: book.id })).data.getBookmark.paragraphIndex).toBe(3);
  expect((await run(query, { book: book.id }, other)).data.getBookmark).toBeNull();
  expect((await run(query, { book: book.id }, null)).data.getBookmark).toBeNull();
  expect((await run('mutation($book:ID!){removeBookmark(bookId:$book){code}}', { book: book.id })).data.removeBookmark.code).toBe(200);
  expect((await run(query, { book: book.id })).data.getBookmark).toBeNull();
});
test('preferences round trip through the schema with populated classification names', async () => {
  expect((await run('{getUserPreference{id}}')).data.getUserPreference).toBeNull();
  const saved = await run('mutation($genres:[ID!]!){saveUserPreference(genreIds:$genres){id userId onboardingCompleted preferredGenres{id name}}}', { genres: [genre.id] });
  expect(saved.errors).toBeUndefined();
  expect(saved.data.saveUserPreference).toMatchObject({ userId: reader.id, onboardingCompleted: true, preferredGenres: [{ id: genre.id, name: 'Gizem' }] });
  expect((await run('{getUserPreference{onboardingCompleted preferredGenres{name}}}')).data.getUserPreference.preferredGenres).toEqual([{ name: 'Gizem' }]);
});
test('chapter completion returns schema-compatible progress and reader history', async () => {
  const result = await run('mutation($book:ID!,$chapter:ID!){markChapterAsRead(bookId:$book,chapterId:$chapter){id completedChapters lastReadAt isCompleted bookId{id title}}}', { book: book.id, chapter: chapter.id });
  expect(result.errors).toBeUndefined();
  expect(result.data.markChapterAsRead).toMatchObject({ completedChapters: [chapter.id], isCompleted: true, bookId: { id: book.id, title: 'Public book' } });
  const history = await run('{getUserReadingHistory{id bookId{id title} completedChapters}}');
  expect(history.errors).toBeUndefined();
  expect(history.data.getUserReadingHistory).toHaveLength(1);
  expect((await run('{getUserReadingHistory{id}}', {}, other)).data.getUserReadingHistory).toEqual([]);
});
test('informational notifications and read updates are isolated per user', async () => {
  await Notification.create([
    { userId: reader.id, type: 'NEW_CHAPTER', title: 'Chapter', message: 'New' },
    { userId: reader.id, type: 'FOLLOW_REQUEST', title: 'Request', message: 'Pending' },
    { userId: other.id, type: 'NEW_CHAPTER', title: 'Other', message: 'Private' },
  ]);
  const before = await run('{getNotifications{id title isRead} getUnreadNotificationCount}');
  expect(before.errors).toBeUndefined();
  expect(before.data.getNotifications.map(n => n.title)).toEqual(['Chapter']);
  expect(before.data.getUnreadNotificationCount).toBe(1);
  expect((await run('mutation{markNotificationsRead}')).data.markNotificationsRead).toBe(true);
  expect((await run('{getUnreadNotificationCount}')).data.getUnreadNotificationCount).toBe(0);
  expect((await run('{getUnreadNotificationCount}', {}, other)).data.getUnreadNotificationCount).toBe(1);
  expect((await run('{getUnreadNotificationCount}', {}, null)).data.getUnreadNotificationCount).toBe(0);
});
test.each([
  '{getUserPreference{id}}', '{getRecommendations{score}}', '{getUserReadingHistory{id}}', '{getNotifications{id}}',
  'query($book:ID!){getReadingProgress(bookId:$book){id}}',
  'mutation{markNotificationsRead}', 'mutation{saveUserPreference(genreIds:[]){id}}',
  'mutation($book:ID!){removeBookmark(bookId:$book){code}}',
])('anonymous reader-specific operations are rejected: %s', async source => {
  expect((await run(source, { book: book.id }, null)).errors).toBeDefined();
});
