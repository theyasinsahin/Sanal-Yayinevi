import { readFileSync } from 'node:fs';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import User from '../src/models/user.js';
import PrintedBookReading from '../src/models/printedBookReading.js';
import * as readings from '../src/services/printedReadingService.js';
import { getAdminRecord, saveAdminRecord } from '../src/services/adminService.js';

const source = readFileSync(new URL('../../Client/src/graphql/printedReadings.js', import.meta.url), 'utf8');
const document = name => source.split(`export const ${name} = gql\``)[1].split('`;')[0];
let api, user, other, admin, book;
const context = actor => ({ user: actor });
const save = (overrides = {}, actor = user) => readings.savePrintedReading(context(actor), { bookId: book.id, rating: 4, review: 'Etkileyici bir anlatım.', ...overrides });
const list = (actor = null, page = 1) => readings.getPrintedReadings(context(actor), { userId: user.id, page });
async function run(name, variables, actor = user) {
  const response = await api.executeOperation({ query: document(name), variables }, { contextValue: context(actor) });
  return response.body.singleResult;
}
beforeAll(async () => { await connect(); await Promise.all([User.init(), Book.init(), PrintedBookReading.init()]); api = new ApolloServer({ schema }); await api.start(); }, 60000);
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  [user, other, admin] = await User.create([
    { username: 'reader', fullName: 'Okur', email: 'reader@test.example', password: 'hash' },
    { username: 'other', fullName: 'Diğer', email: 'other@test.example', password: 'hash' },
    { username: 'admin', fullName: 'Yönetici', email: 'admin@test.example', password: 'hash', role: 'ADMIN' },
  ]);
  book = await Book.create({ title: 'Basılı Roman', printedAuthor: 'Bir Yazar', publisher: 'Yayınevi', kind: 'PRINTED', publicationStatus: 'APPROVED' });
});

test('actual client documents save a reading and expose its score, review and book in the profile library', async () => {
  const saved = await run('SAVE_PRINTED_READING', { bookId: book.id, rating: 5, review: '  Çok beğendim.  ' });
  expect(saved.errors).toBeUndefined();
  expect(saved.data.savePrintedBookReading).toMatchObject({ userId: user.id, rating: 5, review: 'Çok beğendim.' });
  const profile = await run('GET_PRINTED_READINGS', { userId: user.id, page: 1 }, null);
  expect(profile.errors).toBeUndefined();
  expect(profile.data.getPrintedReadings).toMatchObject({ total: 1, canView: true, items: [{ rating: 5, review: 'Çok beğendim.', book: { id: book.id, title: book.title } }] });
  const own = await run('MY_PRINTED_READING', { bookId: book.id });
  expect(own.errors).toBeUndefined(); expect(own.data.myPrintedBookReading.id).toBe(saved.data.savePrintedBookReading.id);
});

test('updating a reading preserves its original read date and never duplicates the book', async () => {
  const first = await save();
  const second = await save({ rating: 2, review: '' });
  expect(second.id).toBe(first.id); expect(second.readAt).toEqual(first.readAt);
  expect(second.rating).toBe(2); expect(second.review).toBe('');
  expect(await PrintedBookReading.countDocuments()).toBe(1);
});

test('simultaneous first saves cannot produce duplicate user-book records', async () => {
  await Promise.all([save({ rating: 3 }), save({ rating: 5 })]);
  expect(await PrintedBookReading.countDocuments({ userId: user.id, bookId: book.id })).toBe(1);
});

test.each([0, 6, 1.5, null])('invalid rating %s is rejected without persisting a record', async rating => {
  await expect(save({ rating })).rejects.toThrow('Puan');
  expect(await PrintedBookReading.countDocuments()).toBe(0);
});

test.each([null, 'x'.repeat(3001)])('invalid review content is rejected', async review => {
  await expect(save({ review })).rejects.toThrow('Yorum');
});

test.each([{ kind: 'DIGITAL' }, { publicationStatus: 'PENDING' }, { publicationStatus: 'REJECTED' }, { isDeleted: true }])('unavailable or digital books cannot be added: %j', async changes => {
  await Book.updateOne({ _id: book._id }, changes);
  await expect(save()).rejects.toThrow('onaylanmış basılı');
  expect(await readings.myPrintedReading(context(user), book.id)).toBeNull();
});

test('anonymous, deleted and inactive users cannot modify a reading', async () => {
  expect((await run('SAVE_PRINTED_READING', { bookId: book.id, rating: 5 }, null)).errors[0].extensions.code).toBe('UNAUTHENTICATED');
  for (const changes of [{ isActive: false }, { isActive: true, isDeleted: true }]) {
    await User.updateOne({ _id: user._id }, changes);
    await expect(save()).rejects.toThrow('Giriş');
    await expect(readings.removePrintedReading(context(user), book.id)).rejects.toThrow('Giriş');
  }
});

test('read records are separate from saved books and users can remove only their own record', async () => {
  await User.updateOne({ _id: user._id }, { savedBooks: [book._id] });
  await save(); await save({ rating: 2 }, other);
  const removed = await run('REMOVE_PRINTED_READING', { bookId: book.id });
  expect(removed.errors).toBeUndefined(); expect(removed.data.removePrintedBookReading).toBe(true);
  expect((await list(user)).total).toBe(0);
  expect((await readings.myPrintedReading(context(other), book.id)).rating).toBe(2);
  expect((await User.findById(user.id)).savedBooks.map(String)).toEqual([book.id]);
  await readings.removePrintedReading(context(user), book.id);
  await save(); expect((await list(user)).total).toBe(1);
  expect(await PrintedBookReading.countDocuments({ userId: user.id })).toBe(1);
});

test('library privacy protects reviews and totals from guests, other users and admins', async () => {
  await save(); await User.updateOne({ _id: user._id }, { 'privacySettings.isLibraryPublic': false });
  for (const viewer of [null, other, admin]) expect(await list(viewer)).toMatchObject({ canView: false, total: 0, items: [] });
  expect((await list(user)).total).toBe(1);
});

test('private profiles require the current approved follower relationship', async () => {
  await save(); await User.updateOne({ _id: user._id }, { 'privacySettings.isProfilePublic': false });
  expect((await list(other)).canView).toBe(false);
  await User.updateOne({ _id: user._id }, { followers: [other._id] });
  expect((await list(other)).total).toBe(1);
  await User.updateOne({ _id: user._id }, { followers: [] });
  expect((await list(other)).canView).toBe(false);
});

test('inactive profiles and archived books disappear without deleting the reading', async () => {
  await save(); await Book.updateOne({ _id: book._id }, { isDeleted: true });
  expect((await list(user)).total).toBe(0);
  await readings.removePrintedReading(context(user), book.id);
  expect((await PrintedBookReading.findOne({ userId: user.id })).isDeleted).toBe(true);
  await Book.updateOne({ _id: book._id }, { isDeleted: false }); await save();
  await User.updateOne({ _id: user._id }, { isActive: false });
  expect(await list(null)).toMatchObject({ canView: false, items: [] });
});

test('pagination counts only available approved books and has stable ordering', async () => {
  const books = await Book.insertMany(Array.from({ length: 15 }, (_, index) => ({ title: `Roman ${index}`, kind: 'PRINTED', publicationStatus: index === 14 ? 'PENDING' : 'APPROVED', isDeleted: index === 13 })));
  await PrintedBookReading.insertMany(books.map(item => ({ userId: user._id, bookId: item._id, rating: 4, readAt: new Date('2026-01-01') })));
  const first = await list(user), second = await list(user, 2);
  expect(first).toMatchObject({ total: 13, totalPages: 2 });
  expect(first.items).toHaveLength(12); expect(second.items).toHaveLength(1);
  expect(new Set([...first.items, ...second.items].map(item => String(item.bookId))).size).toBe(13);
  expect((await list(user, 3)).items).toEqual([]);
});

test('admin moderation cannot be bypassed by resaving or removing then resaving', async () => {
  const reading = await save();
  const contextValue = context(admin);
  const record = await getAdminRecord(contextValue, { resource: 'PrintedBookReading', id: reading.id });
  await saveAdminRecord(contextValue, { resource: 'PrintedBookReading', id: reading.id, revision: record.revision, changes: { isDeleted: true }, reason: 'Uygunsuz yorum kaldırıldı.' });
  await expect(save()).rejects.toThrow('yönetim tarafından');
  await readings.removePrintedReading(context(user), book.id);
  await expect(save()).rejects.toThrow('yönetim tarafından');
  expect((await list(user)).total).toBe(0);
});

test('invalid IDs and pagination are rejected cleanly', async () => {
  await expect(save({ bookId: 'invalid' })).rejects.toThrow('Geçerli');
  await expect(list(user, 0)).rejects.toThrow('sayfa');
  await expect(list(user, 1.5)).rejects.toThrow('sayfa');
});
