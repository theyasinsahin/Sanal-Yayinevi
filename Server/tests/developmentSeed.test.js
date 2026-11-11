import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import { developmentIds, seedDevelopmentData } from '../src/scripts/seedDevelopment.js';

beforeAll(connect);
afterEach(clearDatabase);
afterAll(closeDatabase);

test('development fixtures include a guest preview, hidden chapter and the required account roles', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  expect(await User.countDocuments()).toBe(4);
  expect(await Book.countDocuments()).toBe(3);
  const chapters = await Chapter.find({ bookId: developmentIds.story }).sort({ createdAt: 1, _id: 1 });
  expect(chapters).toHaveLength(4);
  expect(chapters[0].isHidden).toBe(true);
  expect(chapters.slice(1).every(chapter => !chapter.isHidden)).toBe(true);
  expect((await User.findById(developmentIds.publisher)).role).toBe('PUBLISHER');
});

test('repeating the seed preserves edited books, chapter visibility and account credentials', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  const user = await User.findById(developmentIds.reader);
  await Book.updateOne({ _id: developmentIds.story }, { $set: { title: 'My local edit' } });
  await Chapter.updateOne({ bookId: developmentIds.story, isHidden: false }, { $set: { isHidden: true } });
  const edited = await Book.findById(developmentIds.story);
  await seedDevelopmentData('Different-local-password');
  expect(await User.countDocuments()).toBe(4);
  expect(await Chapter.countDocuments()).toBe(4);
  expect((await User.findById(developmentIds.reader)).password).toBe(user.password);
  expect((await Book.findById(developmentIds.story)).title).toBe('My local edit');
  expect((await Book.findById(developmentIds.story)).updatedAt).toEqual(edited.updatedAt);
  expect((await User.findById(developmentIds.reader)).updatedAt).toEqual(user.updatedAt);
  expect(await Chapter.countDocuments({ isHidden: true })).toBe(2);
});
