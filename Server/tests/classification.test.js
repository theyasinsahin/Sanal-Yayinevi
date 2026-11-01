import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase, getTestDatabaseUri } from './db.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readdir, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Book from '../src/models/book.js';
import Genre from '../src/models/genre.js';
import Term from '../src/models/classificationTerm.js';
import User from '../src/models/user.js';
import Chapter from '../src/models/chapter.js';
import Preference from '../src/models/userPreference.js';
import { validateClassification, seedClassification, normalizeTag } from '../src/services/classificationService.js';
import { migrateClassification, rollbackClassification } from '../src/services/classificationMigration.js';
import { getBookFeed } from '../src/services/bookCatalogService.js';

let api, author, input;
beforeAll(async () => { await connect(); api = new ApolloServer({ schema }); await api.start(); });
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  await seedClassification(); await Term.init();
  author = await User.create({ username: 'writer', fullName: 'Writer', email: 'writer@example.test', password: 'test' });
  input = { formatId: String((await Term.findOne({ kind: 'FORMAT', slug: 'roman' }))._id), genreIds: [String((await Genre.findOne({ slug: 'fantastik' }))._id)], tags: [], narrativeFeatureIds: [], contentWarningIds: [] };
});
const execute = async (query, variables, user = author) => (await api.executeOperation({ query, variables }, { contextValue: { user, Book } })).body.singleResult;
test('all initial options exist and genres are grouped independently from formats', async () => {
  const result = await execute('{ getClassificationOptions { formats { slug } genres { slug group } narrativeFeatures { slug } targetAudiences { slug } contentWarnings { slug } } }');
  expect(result.errors).toBeUndefined();
  const options = result.data.getClassificationOptions;
  expect(options.formats).toHaveLength(22); expect(options.genres).toHaveLength(45); expect(options.narrativeFeatures).toHaveLength(8);
  expect(options.genres.some(genre => genre.slug === 'roman')).toBe(false);
  expect(new Set(options.genres.map(genre => genre.group))).toEqual(new Set(['FICTION', 'KNOWLEDGE']));
});
test('create and edit flow stores references and requires ownership', async () => {
  const result = await execute('mutation($c: ClassificationInput!) { createBook(title:"New work",description:"Description",imageUrl:"",classification:$c) { id format { slug } genres { slug } classificationStatus } }', { c: input });
  expect(result.errors).toBeUndefined(); expect(result.data.createBook.format.slug).toBe('roman');
  const id = result.data.createBook.id;
  const query = 'mutation($id:ID!,$c:ClassificationInput!){updateBookClassification(bookId:$id,classification:$c){id tags genres{slug}}}';
  const updated = await execute(query, { id, c: { ...input, tags: ['Yapay Zekâ'] } });
  expect(updated.errors).toBeUndefined(); expect(updated.data.updateBookClassification.tags).toEqual(['Yapay Zekâ']);
  const denied = await execute(query, { id, c: input }, { _id: new mongoose.Types.ObjectId() });
  expect(denied.errors[0].message).toContain('yetkiniz');
  const anonymous = await execute(query, { id, c: input }, null);
  expect(anonymous.errors[0].message).toContain('Giriş');
});
test('classification validates cardinality, duplicate IDs, inactive and mismatched terms', async () => {
  const genres = await Genre.find().limit(4);
  for (const patch of [
    { formatId: null }, { genreIds: [] }, { genreIds: genres.map(item => String(item._id)) },
    { genreIds: [input.genreIds[0], input.genreIds[0]] }, { genreIds: [String(new mongoose.Types.ObjectId())] },
    { narrativeFeatureIds: [input.formatId] }, { tags: Array.from({ length: 9 }, (_, i) => `Tag ${i}`) },
    { tags: ['Yapay Zekâ', ' yapay   zekâ '] },
  ]) await expect(validateClassification({ ...input, ...patch }, author._id)).rejects.toThrow();
  await Genre.updateOne({ _id: input.genreIds[0] }, { isActive: false });
  await expect(validateClassification(input, author._id)).rejects.toThrow();
});
test('Turkish tags preserve display names, normalize case and spaces, and cannot bypass moderation', async () => {
  const first = await validateClassification({ ...input, tags: ['  İhanet   ve Işık '] }, author._id);
  const second = await validateClassification({ ...input, tags: ['ihanet ve ışık'] }, author._id);
  expect(String(first.tagIds[0])).toBe(String(second.tagIds[0]));
  expect((await Term.findById(first.tagIds[0])).name).toBe('İhanet ve Işık');
  expect(normalizeTag('Öykü')).toMatchObject({ normalizedName: 'öykü' });
  await Term.updateOne({ _id: first.tagIds[0] }, { isActive: false });
  await expect(validateClassification({ ...input, tags: ['ihanet ve ışık'] }, author._id)).rejects.toThrow('kapatılmış');
});
test('multiple catalog filters use AND across dimensions and OR inside a dimension', async () => {
  const feature = await Term.findOne({ kind: 'FEATURE', slug: 'seri-kurgu' });
  const valid = await validateClassification({ ...input, narrativeFeatureIds: [String(feature._id)], tags: ['Büyü'] }, author._id);
  await Book.create({ title: 'Match', authorId: author._id, status: 'WRITING', ...valid });
  await Book.create({ title: 'Other', authorId: author._id, status: 'WRITING', ...valid, narrativeFeatureIds: [] });
  const tag = await Term.findById(valid.tagIds[0]);
  const result = await getBookFeed({ classification: { formats: ['roman'], genres: ['fantastik', 'gizem'], features: ['seri-kurgu'], tags: [tag.slug] } });
  expect(result.books.map(book => book.title)).toEqual(['Match']);
  expect((await getBookFeed({ classification: null })).books).toHaveLength(2);
  expect((await getBookFeed({ classification: { formats: ['siir'], genres: ['fantastik'] } })).books).toEqual([]);
});
test('migration dry run is read only; apply is repeatable and rollback preserves unrelated content', async () => {
  const oldGenre = await Genre.create({ name: 'Roman', slug: 'roman' });
  const book = await Book.create({ title: 'Legacy', authorId: author._id, genreId: oldGenre._id, tags: ['Büyü', ' büyü ', 'bad!'], status: 'WRITING', stats: { likes: 7 }, comments: [new mongoose.Types.ObjectId()] });
  const chapter = await Chapter.create({ bookId: book._id, authorId: author._id, title: 'One', content: '<p>Original words</p>' });
  await Preference.create({ userId: author._id, preferredGenres: [oldGenre._id], onboardingCompleted: true });
  const before = await Book.findById(book._id).lean();
  const dry = await migrateClassification();
  expect(dry.dryRun).toBe(true); expect(dry.books[0].mapping).toEqual(['FORMAT', 'roman']);
  expect((await Book.findById(book._id)).classificationVersion).toBeUndefined();
  const applied = await migrateClassification({ apply: true });
  expect(applied.applied).toBeGreaterThan(0);
  const migrated = await Book.findById(book._id);
  expect(migrated.formatId).toBeTruthy(); expect(migrated.genreIds).toHaveLength(0);
  expect(migrated.classificationStatus).toBe('NEEDS_REVIEW'); expect(migrated.tags).toEqual(before.tags);
  expect(migrated.stats.likes).toBe(7); expect(migrated.comments.map(String)).toEqual(before.comments.map(String));
  expect((await Chapter.findById(chapter._id)).content).toBe('<p>Original words</p>');
  expect((await migrateClassification({ apply: true })).applied).toBe(0);
  const rolled = await rollbackClassification(); expect(rolled.conflicts).toEqual([]);
  const restored = await Book.findById(book._id).lean();
  expect(restored.genreId).toEqual(before.genreId); expect(restored.classificationVersion).toBeUndefined();
});
test('migration never guesses a format and rollback skips author reclassification', async () => {
  const old = await Genre.create({ name: 'Aşk', slug: 'ask' });
  const book = await Book.create({ title: 'Legacy topic', authorId: author._id, genreId: old._id });
  await migrateClassification({ apply: true });
  expect((await Book.findById(book._id)).formatId).toBeNull();
  await Book.updateOne({ _id: book._id }, await validateClassification(input, author._id));
  expect((await rollbackClassification()).conflicts).toContain(String(book._id));
});

test('bootstrap preserves existing stable codes and reports conflicting legacy codes before writing works', async () => {
  await Genre.updateOne({ slug: 'fantastik' }, { slug: 'eski-fantastik' });
  const before = await Book.create({ title: 'Unchanged', authorId: author._id });
  const report = await migrateClassification();
  expect(report.seedConflicts).toContainEqual(expect.objectContaining({ name: 'Fantastik', existingCode: 'eski-fantastik', proposedCode: 'fantastik' }));
  await expect(migrateClassification({ apply: true })).rejects.toThrow('kodu çakışması');
  expect((await Genre.findOne({ name: 'Fantastik' })).slug).toBe('eski-fantastik');
  expect((await Book.findById(before._id)).classificationVersion).toBeUndefined();
});

test('the default migration CLI creates only a report, with no database writes or implicit indexes', async () => {
  const uri = getTestDatabaseUri('classification_dry_run');
  const isolated = await mongoose.createConnection(uri, { autoIndex: false, autoCreate: false }).asPromise();
  const directory = await mkdtemp(join(tmpdir(), 'betik-classification-'));
  try {
    const original = { _id: new mongoose.Types.ObjectId(), title: 'Untouched source', tags: ['Büyü'] };
    await isolated.collection('books').insertOne(original);
    const beforeCollections = await isolated.db.listCollections().toArray();
    const beforeIndexes = await isolated.collection('books').indexes();
    const script = fileURLToPath(new URL('../src/scripts/migrateClassification.js', import.meta.url));
    await promisify(execFile)(process.execPath, [script], { cwd: directory, env: { ...process.env, MONGO_URI: uri, MONGODB_URI: uri }, timeout: 30000 });
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    const report = JSON.parse(await readFile(join(directory, files[0]), 'utf8'));
    expect(report.dryRun).toBe(true); expect(report.books).toHaveLength(1);
    expect(await isolated.collection('books').findOne({ _id: original._id })).toEqual(original);
    expect((await isolated.db.listCollections().toArray()).map(item => item.name).sort()).toEqual(beforeCollections.map(item => item.name).sort());
    expect(await isolated.collection('books').indexes()).toEqual(beforeIndexes);
  } finally {
    await isolated.close();
    for (const file of await readdir(directory)) if (/^classification-report-\d+\.json$/.test(file)) await unlink(join(directory, file));
    await rmdir(directory);
  }
}, 40000);
