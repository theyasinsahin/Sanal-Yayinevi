import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import express from 'express';
import schema from '../src/graphql/schema.js';
import models from '../src/models/index.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import { getBookFeed } from '../src/services/bookCatalogService.js';
import { createLoaders } from '../src/graphql/loaders.js';
import { compressResponses, operationTiming } from '../src/config/httpPerformance.js';

let api, authors, books, chapters, genre;
const sources = ['queries/book.js', 'printedBooks.js'].map(path => readFileSync(new URL(`../../Client/src/graphql/${path}`, import.meta.url), 'utf8'));
function document(name) {
  const pattern = new RegExp(`(?:export )?const ${name} = gql` + '`([\\s\\S]*?)`;');
  const raw = sources.map(source => source.match(pattern)?.[1]).find(Boolean);
  return raw.replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => document(fragment));
}
async function run(name, variables, user = null) {
  const calls = [];
  mongoose.set('debug', (collection, method, ...args) => calls.push({ collection, method, args }));
  try {
    const response = await api.executeOperation({ query: document(name), variables }, { contextValue: { ...models, user } });
    expect(response.body.singleResult.errors).toBeUndefined();
    return { data: response.body.singleResult.data, calls };
  } finally { mongoose.set('debug', false); }
}
beforeAll(async () => {
  await connect();
  await Promise.all(Object.values(models).filter(model => typeof model?.init === 'function').map(model => model.init()));
  api = new ApolloServer({ schema, plugins: [operationTiming] }); await api.start();
}, 60000);
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  authors = await models.User.insertMany([
    { username: 'deniz', fullName: 'Deniz Yazar', email: 'deniz@fixture.test', password: 'test' },
    { username: 'ada', fullName: 'Ada Yazar', email: 'ada@fixture.test', password: 'test' },
    { username: 'inactive', fullName: 'Inactive User', email: 'inactive@fixture.test', password: 'test', isActive: false },
  ]);
  genre = await models.Genre.create({ name: 'Roman', slug: 'roman' });
  books = await models.Book.insertMany(Array.from({ length: 48 }, (_, index) => ({ title: `Book ${String(index).padStart(2, '0')}`, description: 'Fixture description.',
    urlSlug: `book-${index}`, authorId: authors[index % 2]._id, genreId: genre._id, status: 'WRITING',
    publishDate: new Date(1700000000000 + Math.floor(index / 3) * 1000), stats: { likes: index, views: index },
  })));
  chapters = await models.Chapter.create(Array.from({ length: 12 }, (_, index) => ({ bookId: books[0]._id,
    authorId: authors[0]._id, title: `Chapter ${index}`, content: 'chapter body '.repeat(1000),
    createdAt: new Date(1700000000000 + index * 1000),
  })));
  await models.Comment.create(books.flatMap(book => [
    ...[0, 1, 2].map(() => ({ bookId: book._id, userId: authors[0]._id, content: 'A comment' })),
    { bookId: book._id, userId: authors[0]._id, content: 'Removed', isDeleted: true },
    { bookId: book._id, userId: authors[2]._id, content: 'Inactive' },
  ]));
}, 30000);

test('the real catalog document has a constant database-call budget and never loads comments or manuscripts', async () => {
  const small = await run('GET_BOOK_FEED', { limit: 4 });
  const large = await run('GET_BOOK_FEED', { limit: 48 });
  expect(small.data.getBookFeed.books).toHaveLength(4);
  expect(large.data.getBookFeed.books).toHaveLength(48);
  expect(large.calls.length).toBeLessThanOrEqual(8);
  expect(large.calls.length).toBe(small.calls.length);
  expect(large.calls.filter(call => call.collection === 'users' && call.method === 'find')).toHaveLength(1);
  expect(large.calls.filter(call => call.collection === 'comments').map(call => call.method)).toEqual(['aggregate']);
  expect(large.calls.some(call => call.collection === 'chapters')).toBe(false);
  expect(large.data.getBookFeed.books.every(book => book.commentCount === 3 && book.author.username)).toBe(true);
});

test.each(['NEWEST', 'OLDEST', 'UPDATED', 'POPULAR'])('%s cursor pages preserve ordering without duplicates even when sort values tie', async sort => {
  const expected = await getBookFeed({ sort, limit: 48 });
  const ids = []; let after;
  do {
    const page = await getBookFeed({ sort, limit: 7, after });
    ids.push(...page.books.map(book => book.id)); after = page.hasNextPage ? page.endCursor : null;
  } while (after);
  expect(ids).toEqual(expected.books.map(book => book.id));
  expect(new Set(ids).size).toBe(48);
});

test('search, genre and public visibility are enforced on the server before pagination', async () => {
  await models.Book.create([
    { title: 'Draft', authorId: authors[0]._id, genreId: genre._id, status: 'DRAFT' },
    { title: 'Deleted', authorId: authors[0]._id, isDeleted: true, status: 'WRITING' },
    { title: 'Inactive', authorId: authors[2]._id, status: 'WRITING' },
    { title: 'Printed', kind: 'PRINTED', publicationStatus: 'APPROVED', status: 'PUBLISHED' },
  ]);
  const filtered = await getBookFeed({ genre: 'roman', search: 'Deniz', limit: 48 });
  expect(filtered.books).toHaveLength(24);
  expect(filtered.books.every(book => String(book.authorId) === authors[0].id)).toBe(true);
  expect((await getBookFeed({ search: '.*' })).books).toHaveLength(0);
  expect((await getBookFeed({ genre: 'missing' })).books).toHaveLength(0);
  expect((await getBookFeed({ limit: 48 })).books).toHaveLength(48);
});

test('page size, search length and cursors cannot bypass query bounds', async () => {
  for (const args of [{ limit: 0 }, { limit: 49 }, { search: 'a'.repeat(101) }, { after: 'invalid' }, { after: 'a'.repeat(1001) }]) {
    await expect(getBookFeed(args)).rejects.toThrow();
  }
  const first = await getBookFeed({ limit: 1 });
  await expect(getBookFeed({ after: first.endCursor, sort: 'OLDEST' })).rejects.toThrow();
});

test('book detail and reader metadata exclude chapter bodies at the database projection', async () => {
  for (const name of ['GET_BOOK_DETAIL', 'GET_BOOK_READER_DATA']) {
    const { data, calls } = await run(name, { id: books[0].id });
    expect(data.getBookById.chapters).toHaveLength(12);
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThan(6000);
    const query = calls.find(call => call.collection === 'chapters' && call.method === 'find');
    expect(query.args[1].projection.content).toBe(0);
    expect(data.getBookById.chapters[0]).not.toHaveProperty('content');
  }
  const selected = await run('GET_READING_CHAPTER', { bookId: books[0].id, chapterId: chapters[5].id });
  expect(selected.data.getReadingChapter.content).toBe(chapters[5].content);
  expect(selected.calls.filter(call => call.collection === 'chapters').map(call => call.method)).toEqual(['findOne']);
  const full = await run('GET_BOOK_READER_FULL', { id: books[0].id });
  expect(full.data.getBookById.chapters.every(chapter => chapter.content)).toBe(true);
});

test('single chapter loading keeps draft, removed chapter and cross-book access checks', async () => {
  const query = document('GET_READING_CHAPTER');
  const read = async (user, bookId = books[0].id, chapterId = chapters[0].id) => {
    const response = await api.executeOperation({ query, variables: { bookId, chapterId } }, { contextValue: { ...models, user } });
    expect(response.body.singleResult.errors).toBeUndefined(); return response.body.singleResult.data.getReadingChapter;
  };
  expect(await read(null, books[1].id)).toBeNull();
  await models.Book.updateOne({ _id: books[0]._id }, { $set: { status: 'DRAFT' } });
  expect(await read(null)).toBeNull(); expect(await read(authors[1])).toBeNull();
  expect((await read(authors[0])).id).toBe(chapters[0].id);
  await models.Chapter.updateOne({ _id: chapters[0]._id }, { $set: { isDeleted: true } });
  expect(await read(authors[0])).toBeNull();
});

test('loader caches belong to one request and retain duplicate-key ordering', async () => {
  const first = createLoaders();
  const values = await first.users.loadMany([authors[1]._id, authors[0].id, authors[1].id, authors[2].id]);
  expect(values.map(user => user?.username || null)).toEqual(['ada', 'deniz', 'ada', null]);
  await models.User.updateOne({ _id: authors[0]._id }, { $set: { fullName: 'Updated' } });
  expect((await first.users.load(authors[0].id)).fullName).toBe('Deniz Yazar');
  expect((await createLoaders().users.load(authors[0].id)).fullName).toBe('Updated');
});

test('HTTP compression negotiates gzip and identity without altering JSON', async () => {
  const payload = { content: 'body '.repeat(5000) };
  const app = express(); app.use(compressResponses()); app.get('/', (_, response) => response.json(payload));
  const listener = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  try {
    const url = `http://127.0.0.1:${listener.address().port}`;
    const compressed = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(compressed.headers.get('content-encoding')).toBe('gzip');
    expect(compressed.headers.get('vary')).toContain('Accept-Encoding');
    expect(await compressed.json()).toEqual(payload);
    const plain = await fetch(url, { headers: { 'Accept-Encoding': 'identity' } });
    expect(plain.headers.get('content-encoding')).toBeNull(); expect(await plain.json()).toEqual(payload);
  } finally { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); }
});
