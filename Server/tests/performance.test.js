import { parse, print } from 'graphql';
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
const sources = ['queries/book.js', 'printedBooks.js', 'classification.js'].map(path => readFileSync(new URL(`../../Client/src/graphql/${path}`, import.meta.url), 'utf8'));
function document(name) {
  const pattern = new RegExp(`(?:export )?const ${name} = gql` + '`([\\s\\S]*?)`;');
  const raw = sources.map(source => source.match(pattern)?.[1]).find(Boolean);
  const expanded = raw.replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => document(fragment));
  const ast = parse(expanded), seen = new Set();
  ast.definitions = ast.definitions.filter(definition => { const key = definition.name?.value; if (seen.has(key)) return false; seen.add(key); return true; });
  return print(ast);
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
  genre = await models.Genre.create({ name: 'Roman', slug: 'roman', group: 'FICTION', classificationVersion: 1 });
  books = await models.Book.insertMany(Array.from({ length: 48 }, (_, index) => ({ title: `Book ${String(index).padStart(2, '0')}`, description: 'Fixture description.',
    urlSlug: `book-${index}`, authorId: authors[index % 2]._id, genreIds: [genre._id], status: 'WRITING',
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
  expect(large.calls.some(call => call.collection === 'quotes')).toBe(false);
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
    { title: 'Draft', authorId: authors[0]._id, genreIds: [genre._id], status: 'DRAFT' },
    { title: 'Deleted', authorId: authors[0]._id, isDeleted: true, status: 'WRITING' },
    { title: 'Inactive', authorId: authors[2]._id, status: 'WRITING' },
    { title: 'Printed', kind: 'PRINTED', publicationStatus: 'APPROVED', status: 'PUBLISHED' },
  ]);
  const filtered = await getBookFeed({ classification: { genres: ['roman'] }, search: 'Deniz', limit: 48 });
  expect(filtered.books).toHaveLength(24);
  expect(filtered.books.every(book => String(book.authorId) === authors[0].id)).toBe(true);
  expect((await getBookFeed({ search: '.*' })).books).toHaveLength(0);
  expect((await getBookFeed({ classification: { genres: ['missing'] } })).books).toHaveLength(0);
  expect((await getBookFeed({ limit: 48 })).books).toHaveLength(48);
});

test('page size, search length and cursors cannot bypass query bounds', async () => {
  for (const args of [{ limit: 0 }, { limit: 49 }, { search: 'a'.repeat(101) }, { after: 'invalid' }, { after: 'a'.repeat(1001) }]) {
    await expect(getBookFeed(args)).rejects.toThrow();
  }
  const first = await getBookFeed({ limit: 1 });
  await expect(getBookFeed({ after: first.endCursor, sort: 'OLDEST' })).rejects.toThrow();
});

test('catalog search matches Turkish casing in titles, author names and usernames before pagination', async () => {
  await models.User.updateOne({ _id: authors[0]._id }, { $set: { fullName: 'Işıl Yılmaz', username: 'kitapkurdu' } });
  await models.Book.updateOne({ _id: books[0]._id }, { $set: { title: 'İstanbul Hikâyeleri' } });
  for (const search of ['  İSTANBUL  ', 'istanbul']) {
    const page = await getBookFeed({ search, sort: 'POPULAR', limit: 8 });
    expect(page.books.map(book => book.id)).toEqual([books[0].id]);
  }
  for (const search of ['IŞIL', 'ışıl', 'KİTAPKURDU', 'KITAPKURDU']) {
    const page = await getBookFeed({ search, sort: 'POPULAR', limit: 8 });
    expect(page.books).toHaveLength(8);
    expect(page.hasNextPage).toBe(true);
    expect(page.books.every(book => String(book.authorId) === authors[0].id)).toBe(true);
    expect(page.books.map(book => book.stats.likes)).toEqual([46, 44, 42, 40, 38, 36, 34, 32]);
  }
});

test.each([[8, 'POPULAR'], [24, 'NEWEST']])('quote matches join title and author matches once per book with limit %s and sort %s', async (limit, sort) => {
  const text = 'Görünmeyen yıldızlar geceyi aydınlatır.';
  await models.User.updateOne({ _id: authors[1]._id }, { $set: { fullName: 'Görünmeyen Yıldızlar' } });
  await models.Book.updateOne({ _id: books[4]._id }, { $set: { title: 'Görünmeyen Yıldızlar' } });
  await models.Quote.create([
    { text, normalizedText: 'first', bookId: books[0]._id, userId: authors[0]._id },
    { text, normalizedText: 'duplicate', bookId: books[0]._id, userId: authors[1]._id },
    { text, normalizedText: 'second', bookId: books[2]._id, userId: authors[0]._id },
    { text, normalizedText: 'author-overlap', bookId: books[3]._id, userId: authors[0]._id },
  ]);
  const expected = books.filter((_, index) => index % 2 === 1 || [0, 2, 4].includes(index))
    .sort((a, b) => sort === 'POPULAR' ? b.stats.likes - a.stats.likes : b.publishDate - a.publishDate || b.id.localeCompare(a.id))
    .map(book => book.id);
  const ids = [];
  let after;
  do {
    const { data, calls } = await run('GET_BOOK_FEED', { limit, sort, search: '  GÖRÜNMEYEN YILDIZLAR  ', after });
    const page = data.getBookFeed;
    ids.push(...page.books.map(book => book.id));
    expect(page.books.length).toBeLessThanOrEqual(limit);
    expect(page.books.every(book => book.publicPath.startsWith('/kitap/'))).toBe(true);
    expect(calls.filter(call => call.collection === 'quotes').map(call => call.method)).toEqual(['distinct']);
    expect(calls.length).toBeLessThanOrEqual(10);
    after = page.hasNextPage ? page.endCursor : null;
  } while (after);
  expect(ids).toEqual(expected);
  expect(new Set(ids).size).toBe(27);
});

test('quote search respects deleted quotes, inactive users, book visibility and genre filters', async () => {
  const text = 'Alıntıya özgü benzersiz satır';
  const otherGenre = await models.Genre.create({ name: 'Şiir', slug: 'siir' });
  const deletedUser = await models.User.create({ username: 'removed', fullName: 'Removed Reader', email: 'removed@fixture.test', password: 'test', isDeleted: true });
  const hiddenBooks = await models.Book.create([
    { title: 'Draft', authorId: authors[0]._id, genreIds: [genre._id], status: 'DRAFT' },
    { title: 'Removed book', authorId: authors[0]._id, genreIds: [genre._id], status: 'WRITING', isDeleted: true },
    { title: 'Inactive author', authorId: authors[2]._id, genreIds: [genre._id], status: 'WRITING' },
    { title: 'Printed', kind: 'PRINTED', publicationStatus: 'APPROVED', genreIds: [genre._id], status: 'PUBLISHED' },
    { title: 'Another genre', authorId: authors[0]._id, genreIds: [otherGenre._id], status: 'WRITING' },
    { title: 'Deleted author', authorId: deletedUser._id, genreIds: [genre._id], status: 'WRITING' },
  ]);
  const original = await models.Quote.create({ text, normalizedText: 'visible', bookId: books[0]._id, userId: authors[0]._id });
  await models.Quote.create([
    { text, normalizedText: 'removed', bookId: books[1]._id, userId: authors[0]._id, isDeleted: true },
    { text, normalizedText: 'inactive', bookId: books[2]._id, userId: authors[2]._id },
    { text, normalizedText: 'repost', bookId: books[3]._id, userId: authors[0]._id, isRepost: true, originalQuoteId: original._id },
    { text: 'Farklı bir alıntı', note: text, normalizedText: 'note-only', bookId: books[4]._id, userId: authors[0]._id },
    { text, normalizedText: 'deleted-user', bookId: books[5]._id, userId: deletedUser._id },
    ...hiddenBooks.map((book, index) => ({ text, normalizedText: `hidden-${index}`, bookId: book._id, userId: authors[0]._id })),
  ]);
  await models.Quote.collection.insertOne({ text, normalizedText: 'legacy', bookId: books[6]._id, userId: authors[0]._id, isRepost: false });
  const page = await getBookFeed({ search: text, classification: { genres: ['roman'] }, sort: 'POPULAR', limit: 48 });
  expect(page.books.map(book => book.id)).toEqual([books[6].id, books[0].id]);
  expect(page.hasNextPage).toBe(false);
});

test('quote searches treat punctuation as literal text', async () => {
  await models.Quote.create([
    { text: 'Bir ifade: (.*)+[x] ve devamı', normalizedText: 'literal', bookId: books[0]._id, userId: authors[0]._id },
    { text: 'Aramayla eşleşmemesi gereken bir alıntı', normalizedText: 'unrelated', bookId: books[1]._id, userId: authors[0]._id },
  ]);
  const page = await getBookFeed({ search: '(.*)+[x]' });
  expect(page.books.map(book => book.id)).toEqual([books[0].id]);
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
