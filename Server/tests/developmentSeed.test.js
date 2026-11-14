import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Genre from '../src/models/genre.js';
import Term from '../src/models/classificationTerm.js';
import Badge from '../src/models/badge.js';
import UserBadge from '../src/models/userBadge.js';
import { getClassificationOptions } from '../src/services/classificationService.js';
import { seedDevelopmentReferenceData } from '../src/services/developmentReferenceData.js';
import { createBook } from '../src/services/bookService.js';
import { graphql } from 'graphql';
import schema from '../src/graphql/schema.js';
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

test('fresh database supports real book creation, chapter saving, publication and reading', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  const options = await getClassificationOptions();
  expect(options.formats).toHaveLength(27);
  expect(options.genres).toHaveLength(45);
  expect(options.narrativeFeatures).toHaveLength(46);
  expect(options.targetAudiences).toHaveLength(4);
  expect(options.contentWarnings).toHaveLength(7);
  expect(await Badge.countDocuments()).toBe(10);
  const author = await User.findById(developmentIds.author);
  const contextValue = { user: author, User, Book, Chapter };
  const created = await graphql({ schema, contextValue, source: `mutation($c:ClassificationInput!){
    createBook(title:"Fresh database work",description:"A real local workflow",imageUrl:"",classification:$c){id format{slug} genres{slug}}
  }`, variableValues: { c: { formatId: options.formats[0].id, genreIds: [options.genres[0].id] } } });
  expect(created.errors).toBeUndefined();
  const bookId = created.data.createBook.id;
  const added = await graphql({ schema, contextValue, source: `mutation($b:ID!){
    createChapter(bookId:$b,title:"First chapter",content:"<p>Fresh text</p>"){id content}
  }`, variableValues: { b: bookId } });
  expect(added.errors).toBeUndefined();
  const published = await graphql({ schema, contextValue, source: `mutation($id:ID!){updateBookStatus(bookId:$id,status:"PUBLISHED"){id status}}`, variableValues: { id: bookId } });
  expect(published.errors).toBeUndefined();
  const read = await graphql({ schema, contextValue: { User, Book, Chapter }, source: `query($b:ID!){getBookById(id:$b){title description imageUrl chapters{id content canReadContent}}}`, variableValues: { b: bookId } });
  expect(read.errors).toBeUndefined();
  expect(read.data.getBookById.chapters[0].content).toContain('Fresh text');
  const badge = await Badge.findOne({ key: 'first_publish' });
  expect(await UserBadge.exists({ userId: author.id, badgeId: badge.id })).toBeTruthy();
  const fixtures = await graphql({ schema, contextValue, source: '{getBooksByAuthorId(authorId:"000000000000000000000102"){id title description imageUrl chapters{id content}}}' });
  expect(fixtures.errors).toBeUndefined();
  expect(fixtures.data.getBooksByAuthorId).toHaveLength(3);
});

test('bootstrap restores missing reference data but preserves administrator edits and inactive choices', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  await Term.updateOne({ kind: 'FORMAT', slug: 'roman' }, { $set: { name: 'Custom format', isActive: false } });
  await Genre.updateOne({ slug: 'fantastik' }, { $set: { name: 'Custom genre', isActive: false, group: 'KNOWLEDGE' } });
  await Badge.updateOne({ key: 'first_publish' }, { $set: { name: 'Custom badge', 'condition.threshold': 2 } });
  const format = await Term.findOne({ kind: 'FORMAT', slug: 'roman' }).lean();
  const genre = await Genre.findOne({ slug: 'fantastik' }).lean();
  const badge = await Badge.findOne({ key: 'first_publish' }).lean();
  await Term.deleteOne({ kind: 'FORMAT', slug: 'siir' });
  await Badge.deleteOne({ key: 'first_quote' });
  await seedDevelopmentData('Another-local-password');
  expect(await Term.findOne({ kind: 'FORMAT', slug: 'roman' }).lean()).toEqual(format);
  expect(await Genre.findOne({ slug: 'fantastik' }).lean()).toEqual(genre);
  expect(await Badge.findOne({ key: 'first_publish' }).lean()).toEqual(badge);
  expect(await Term.countDocuments({ kind: 'FORMAT' })).toBe(27);
  expect(await Badge.countDocuments()).toBe(10);
});

test('legacy demo draft missing its non-null description is repaired without touching other edits', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  await Book.updateOne({ _id: developmentIds.draft }, { $unset: { description: 1 }, $set: { title: 'Edited draft' } });
  const before = await Book.findById(developmentIds.draft);
  await seedDevelopmentData('Synthetic-local-password');
  const draft = await Book.findById(developmentIds.draft);
  expect(draft.description).toBeTruthy();
  expect(draft.title).toBe('Edited draft');
  expect(draft.updatedAt).toEqual(before.updatedAt);
});

test('all disabled mandatory choices fail initialization clearly instead of silently starting a broken form', async () => {
  await seedDevelopmentData('Synthetic-local-password');
  await Term.updateMany({ kind: 'FORMAT' }, { $set: { isActive: false } });
  await expect(seedDevelopmentReferenceData()).rejects.toThrow('aktif eser biçimi');
  await expect(createBook({ title: 'Invalid', classification: { formatId: null, genreIds: [] } }, developmentIds.author)).rejects.toThrow();
  expect(await Chapter.countDocuments()).toBe(4);
});
