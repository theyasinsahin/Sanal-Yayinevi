import { jest } from '@jest/globals';
import { parse } from 'graphql';
import mongoose from 'mongoose';
import { connect, clearDatabase, closeDatabase } from './db.js';
import { createLoaders, getLoaders, selectedFields } from '../src/graphql/loaders.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Comment from '../src/models/comment.js';

jest.setTimeout(30000);
beforeAll(connect);
afterAll(closeDatabase);
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
const user = username => User.create({ username, fullName: username, email: `${username}@test.com`, password: 'hash' });

test('raw IDs and populated documents resolve to the same cached user without extra database reads', async () => {
  const author = await user('author');
  const find = jest.spyOn(User, 'find');
  const loaders = createLoaders();
  const [byId, byDocument, missing] = await loaders.users.loadMany([author.id, author, new mongoose.Types.ObjectId()]);
  expect(byId.id).toBe(author.id);
  expect(byDocument).toBe(byId);
  expect(missing).toBeNull();
  expect(find).toHaveBeenCalledTimes(1);
  await loaders.users.load(author._id);
  expect(find).toHaveBeenCalledTimes(1);
});
test('inactive and deleted users are not returned even for populated references', async () => {
  const inactive = await user('inactive'), deleted = await user('deleted');
  await User.updateOne({ _id: inactive.id }, { isActive: false });
  await User.updateOne({ _id: deleted.id }, { isDeleted: true });
  expect(await createLoaders().users.loadMany([inactive, deleted])).toEqual([null, null]);
});
test('chapter metadata loader never retrieves chapter content', async () => {
  const author = await user('author');
  const book = await Book.create({ title: 'Book', authorId: author.id });
  const chapter = await Chapter.create({ title: 'Chapter', bookId: book.id, authorId: author.id, content: 'Private manuscript' });
  const loaded = await createLoaders().chapters.load(chapter.id);
  expect(loaded.title).toBe('Chapter');
  expect(loaded.content).toBeUndefined();
});
test('batched comment counts preserve key order and exclude deleted and inactive users comments', async () => {
  const active = await user('active'), inactive = await user('inactive');
  await User.updateOne({ _id: inactive.id }, { isActive: false });
  const [a, b] = await Book.create([{ title: 'A' }, { title: 'B' }]);
  await Comment.create([
    { bookId: a.id, userId: active.id, content: 'Visible' },
    { bookId: a.id, userId: active.id, content: 'Deleted', isDeleted: true },
    { bookId: a.id, userId: inactive.id, content: 'Inactive' },
  ]);
  expect(await createLoaders().commentCounts.loadMany([b.id, a.id])).toEqual([0, 1]);
});
test('loader caches are isolated to each request context', () => {
  const first = {}, second = {};
  expect(getLoaders(first)).toBe(getLoaders(first));
  expect(getLoaders(first)).not.toBe(getLoaders(second));
});
test('selected fields resolve aliases and fragments without collecting nested fields or looping', () => {
  const document = parse('query { book { alias: title ...Parts ... on Book { stats { views } } } } fragment Parts on Book { description ...Cycle } fragment Cycle on Book { ...Parts id }');
  const [operation, ...fragments] = document.definitions;
  const info = { fieldNodes: operation.selectionSet.selections, fragments: Object.fromEntries(fragments.map(fragment => [fragment.name.value, fragment])) };
  expect([...selectedFields(info)].sort()).toEqual(['description', 'id', 'stats', 'title']);
});
