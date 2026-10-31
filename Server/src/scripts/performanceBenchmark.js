import { parse, print } from 'graphql';
// Isolated fixture benchmark. Never reads MONGO_URI or connects to application data.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { ApolloServer } from '@apollo/server';
import schema from '../graphql/schema.js';
import models from '../models/index.js';

const label = process.argv[2] || 'optimized';
if (!['baseline', 'optimized'].includes(label)) throw new Error('Use baseline or optimized.');
const output = new URL(`../../../docs/performance/${label}.json`, import.meta.url);
const bookSource = fs.readFileSync(new URL('../../../Client/src/graphql/queries/book.js', import.meta.url), 'utf8');
const printedSource = fs.readFileSync(new URL('../../../Client/src/graphql/printedBooks.js', import.meta.url), 'utf8');
function document(name) {
  const sources = [bookSource, printedSource, fs.readFileSync(new URL('../../../Client/src/graphql/classification.js', import.meta.url), 'utf8')];
  const pattern = new RegExp(`(?:export )?const ${name} = gql` + '`([\\s\\S]*?)`;');
  const raw = sources.map(source => source.match(pattern)?.[1]).find(Boolean);
  if (!raw) return null;
  const expanded = raw.replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => document(fragment));
  const ast = parse(expanded), seen = new Set();
  ast.definitions = ast.definitions.filter(definition => { const key = definition.name?.value; if (seen.has(key)) return false; seen.add(key); return true; });
  return print(ast);
}
const db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
let api;
try {
  await mongoose.connect(db.getUri());
  await Promise.all(Object.values(models).filter(model => typeof model?.init === 'function').map(model => model.init()));
  const authors = await models.User.create(Array.from({ length: 6 }, (_, i) => ({ username: `author${i}`, fullName: `Author ${i}`, email: `author${i}@fixture.test`, password: 'fixture' })));
  const genre = await models.Genre.create({ name: 'Roman', slug: 'roman', group: 'FICTION', classificationVersion: 1 });
  const books = await models.Book.create(Array.from({ length: 48 }, (_, i) => ({ title: `Fixture Book ${String(i).padStart(2, '0')}`, urlSlug: `fixture-book-${i}`, authorId: authors[i % 6]._id, genreIds: [genre._id], status: 'WRITING', description: 'Fixture description.', createdAt: new Date(1700000000000 + i * 1000), publishDate: new Date(1700000000000 + i * 1000), stats: { views: i, likes: i, shares: 0 } })));
  const chapters = await models.Chapter.insertMany(books.flatMap(book => Array.from({ length: 12 }, (_, i) => ({ bookId: book._id, authorId: book.authorId, title: `Chapter ${i + 1}`, content: `<p>${'Okuma metni. '.repeat(1000)}</p>`, pageCount: 8, createdAt: new Date(1700000000000 + i * 1000) }))));
  await models.Book.bulkWrite(books.map(book => ({ updateOne: { filter: { _id: book._id }, update: { $set: { chapters: chapters.filter(chapter => String(chapter.bookId) === book.id).map(chapter => chapter._id) } } } })));
  await models.Comment.insertMany(books.flatMap(book => Array.from({ length: 5 }, (_, i) => ({ bookId: book._id, userId: authors[i]._id, content: 'Yorum metni. '.repeat(20), date: new Date() }))));
  api = new ApolloServer({ schema }); await api.start();
  const query = async (source, variables) => {
    const response = await api.executeOperation({ query: source, variables }, { contextValue: { ...models, user: null } });
    const result = response.body.singleResult;
    if (result.errors) throw new Error(JSON.stringify(result.errors));
    return result.data;
  };
  const cases = [
    ['catalog', document('GET_BOOK_FEED') || document('GET_BOOKS'), { limit: 24, sort: 'NEWEST' }],
    ['detail', document('GET_BOOK_DETAIL') || document('GET_BOOK_BY_ID'), { id: books[0].id }],
    ['reader', document('GET_BOOK_READER_DATA'), { id: books[0].id }],
  ];
  if (document('GET_BOOK_FEED')) {
    cases.push(['landing', document('GET_BOOK_FEED'), { limit: 4 }]);
    cases.push(['catalogAllCards', document('GET_BOOK_FEED'), { limit: 48 }]);
  }
  if (document('GET_READING_CHAPTER')) cases.push(['readingChapter', document('GET_READING_CHAPTER'), { bookId: books[0].id, chapterId: chapters[0].id }]);
  const report = { label, fixture: { books: 48, chaptersPerBook: 12, commentsPerBook: 5, contentBytesPerChapter: Buffer.byteLength(chapters[0].content) }, operations: {} };
  for (const [name, source, variables] of cases) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const calls = {};
      mongoose.set('debug', (collection, method) => { const key = `${collection}.${method}`; calls[key] = (calls[key] || 0) + 1; });
      const begin = performance.now(); const data = await query(source, variables); const ms = performance.now() - begin;
      mongoose.set('debug', false);
      const bytes = Buffer.from(JSON.stringify(data));
      runs.push({ ms: Math.round(ms * 10) / 10, jsonBytes: bytes.length, gzipBytes: gzipSync(bytes).length, databaseCalls: Object.values(calls).reduce((sum, count) => sum + count, 0), calls });
    }
    report.operations[name] = runs.sort((a, b) => a.ms - b.ms)[1];
  }
  const manifestUrl = new URL('../../../Client/build/asset-manifest.json', import.meta.url);
  if (fs.existsSync(manifestUrl)) {
    const manifest = JSON.parse(fs.readFileSync(manifestUrl));
    const entrypoints = manifest.entrypoints.filter(file => file.endsWith('.js'));
    report.bundle = { entrypoints, javascriptBytes: 0, gzipBytes: 0 };
    for (const entry of entrypoints) { const bytes = fs.readFileSync(new URL(`../../../Client/build/${entry}`, import.meta.url)); report.bundle.javascriptBytes += bytes.length; report.bundle.gzipBytes += gzipSync(bytes).length; }
  }
  fs.mkdirSync(new URL('.', output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { mongoose.set('debug', false); if (api) await api.stop(); await mongoose.disconnect(); await db.stop(); }
