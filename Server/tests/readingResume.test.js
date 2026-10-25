import { ApolloServer } from '@apollo/server';
import { readFileSync } from 'node:fs';
import schema from '../src/graphql/schema.js';
import models from '../src/models/index.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Bookmark from '../src/models/bookmark.js';
import ReadingProgress from '../src/models/readingProgress.js';
import PointEvent from '../src/models/pointEvent.js';
import { saveReadingProgress, getReadingProgress } from '../src/services/readingProgressService.js';
import * as bookmarks from '../src/services/bookmarkService.js';
import { markChapterAsRead } from '../src/services/recommendationService.js';

let api, reader, other, book, chapters;
beforeAll(async () => {
  await connect(); await Promise.all([ReadingProgress.init(), Bookmark.init()]);
  api = new ApolloServer({ schema, plugins: [{ async requestDidStart() { return { async executionDidStart() { return { willResolveField() { return () => {}; } }; } }; } }] });
  await api.start();
});
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  [reader, other] = await User.create(['reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@example.test`, password: 'test' })));
  book = await Book.create({ title: 'Roman', authorId: other.id, status: 'WRITING' });
  chapters = await Chapter.create([0, 1, 2].map(index => ({ title: `Bölüm ${index + 1}`, bookId: book.id, authorId: other.id, content: '<p>İlk paragraf</p><p>İkinci paragraf</p>', createdAt: new Date(1000 + index) })));
});
const snapshot = (chapterId = chapters[2].id, completedChapterIds = chapters.slice(0, 2).map(chapter => chapter.id)) => ({ bookId: book.id, chapterId, completedChapterIds });
async function query(source, variables = {}, user = reader) {
  const response = await api.executeOperation({ query: source, variables }, { contextValue: { ...models, user } });
  return response.body.singleResult;
}
const document = file => readFileSync(new URL(`../../Client/src/graphql/${file}`, import.meta.url), 'utf8');
const getDocument = (file, name) => document(file).split(`export const ${name} = gql\``)[1].split('`;')[0];

test('the actual client mutations and queries persist and restore chapter IDs through Apollo', async () => {
  const saved = await query(getDocument('readingProgress.js', 'SAVE_READING_PROGRESS'), snapshot());
  expect(saved.errors).toBeUndefined();
  expect(saved.data.saveReadingProgress).toMatchObject({ lastChapterId: chapters[2].id, completedChapters: chapters.slice(0, 2).map(chapter => chapter.id), isCompleted: false });
  const restored = await query(getDocument('readingProgress.js', 'GET_READING_PROGRESS'), { bookId: book.id });
  expect(restored.errors).toBeUndefined();
  expect(restored.data.getReadingProgress).toMatchObject({ id: saved.data.saveReadingProgress.id, lastChapterId: chapters[2].id });
  expect(await PointEvent.countDocuments()).toBe(0);
});

test('reading position and completion are private to the authenticated user', async () => {
  await saveReadingProgress(reader.id, snapshot());
  expect(await getReadingProgress(other.id, book.id)).toBeNull();
  const anonymous = await query(getDocument('readingProgress.js', 'GET_READING_PROGRESS'), { bookId: book.id }, null);
  expect(anonymous.errors[0].message).toContain('Giriş');
  const forged = await query(getDocument('readingProgress.js', 'SAVE_READING_PROGRESS'), snapshot(), null);
  expect(forged.errors[0].message).toContain('Giriş');
  expect(await ReadingProgress.countDocuments()).toBe(1);
});

test('completion can be cleared and duplicates or foreign IDs do not inflate completion', async () => {
  const foreign = await Chapter.create({ bookId: new Book()._id, authorId: other.id, title: 'Başka kitap' });
  const saved = await saveReadingProgress(reader.id, snapshot(chapters[2].id, [...chapters.map(chapter => chapter.id), chapters[0].id, foreign.id]));
  expect(saved.completedChapters).toHaveLength(3); expect(saved.isCompleted).toBe(true);
  const unchecked = await saveReadingProgress(reader.id, snapshot(chapters[2].id, [chapters[0].id]));
  expect(unchecked.isCompleted).toBe(false); expect(unchecked.completedChapters).toHaveLength(1);
});

test('a foreign or deleted current chapter cannot overwrite valid progress', async () => {
  await saveReadingProgress(reader.id, snapshot());
  const foreign = await Chapter.create({ bookId: new Book()._id, authorId: other.id, title: 'Başka kitap' });
  await expect(saveReadingProgress(reader.id, snapshot(foreign.id))).rejects.toThrow('bölüm');
  await Chapter.updateOne({ _id: chapters[2].id }, { isDeleted: true });
  await expect(saveReadingProgress(reader.id, snapshot())).rejects.toThrow('bölüm');
  expect((await ReadingProgress.findOne({ userId: reader.id })).lastChapterId.toString()).toBe(chapters[2].id);
  const cleaned = await getReadingProgress(reader.id, book.id);
  expect(cleaned.lastChapterId).toBeNull(); expect(cleaned.isCompleted).toBe(true);
});

test('legacy progress and history have valid GraphQL IDs and ignore removed chapters', async () => {
  await ReadingProgress.create({ userId: reader.id, bookId: book.id, completedChapters: [chapters[0].id, chapters[2].id] });
  await Chapter.updateOne({ _id: chapters[2].id }, { isDeleted: true });
  const result = await query('query($bookId:ID!){getReadingProgress(bookId:$bookId){id lastChapterId completedChapters} getUserReadingHistory{id bookId{id}}}', { bookId: book.id });
  expect(result.errors).toBeUndefined(); expect(result.data.getReadingProgress.lastChapterId).toBeNull();
  expect(result.data.getReadingProgress.completedChapters).toEqual([chapters[0].id]);
});

test('bookmarks use the actual chapter ID and recompute stale chapter indices', async () => {
  const saved = await bookmarks.setBookmark(reader.id, { bookId: book.id, chapterId: chapters[2].id, chapterIndex: 0, paragraphIndex: 1, chapterTitle: 'Eski başlık' });
  expect(saved.chapterIndex).toBe(2); expect(saved.chapterTitle).toBe(chapters[2].title);
  await Chapter.collection.updateOne({ _id: chapters[0]._id }, { $set: { createdAt: new Date(9999) } });
  expect((await bookmarks.getBookmark(reader.id, book.id)).chapterIndex).toBe(1);
  await Chapter.updateOne({ _id: chapters[2].id }, { isDeleted: true });
  expect(await bookmarks.getBookmark(reader.id, book.id)).toBeNull();
});

test('foreign bookmark chapters and negative paragraphs are rejected without saving a marker', async () => {
  const foreign = await Chapter.create({ bookId: new Book()._id, authorId: other.id, title: 'Başka kitap' });
  await expect(bookmarks.setBookmark(reader.id, { bookId: book.id, chapterId: foreign.id, paragraphIndex: 0 })).rejects.toThrow('bölüm');
  await expect(bookmarks.setBookmark(reader.id, { bookId: book.id, chapterId: chapters[0].id, paragraphIndex: -1 })).rejects.toThrow('paragraf');
  expect(await Bookmark.countDocuments()).toBe(0);
});

test('legacy chapter completion remains concurrent-safe and validates chapter membership', async () => {
  await Promise.all(chapters.map(chapter => markChapterAsRead(reader.id, book.id, chapter.id)));
  expect((await getReadingProgress(reader.id, book.id)).isCompleted).toBe(true);
  await expect(markChapterAsRead(reader.id, book.id, new Chapter().id)).rejects.toThrow('bölüm');
});

test('removed books and inaccessible drafts cannot receive progress updates', async () => {
  await Book.updateOne({ _id: book.id }, { status: 'DRAFT' });
  await expect(saveReadingProgress(reader.id, snapshot())).rejects.toThrow('erişim');
  await Book.updateOne({ _id: book.id }, { status: 'WRITING', isDeleted: true });
  await expect(saveReadingProgress(reader.id, snapshot())).rejects.toThrow('erişim');
});
