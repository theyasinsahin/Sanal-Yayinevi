import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import { resources } from '../src/services/adminResources.js';
import * as adminService from '../src/services/adminService.js';
import User from '../src/models/user.js';
import Genre from '../src/models/genre.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Comment from '../src/models/comment.js';
import Quote from '../src/models/quote.js';
import AdminAudit from '../src/models/adminAudit.js';
import AdminControl from '../src/models/adminControl.js';
import Verification from '../src/models/verification.js';
import ReadingSession from '../src/models/readingSession.js';
import Transaction from '../src/models/transaction.js';

let api, admin, member, genre, book;
const source = readFileSync(new URL('../../Client/src/graphql/admin.js', import.meta.url), 'utf8');
const document = name => source.split(`const ${name} = gql\``)[1].split('`;')[0];
const context = () => ({ user: admin });
async function run(name, variables, user = admin) {
  const response = await api.executeOperation({ query: document(name), variables }, { contextValue: { user } });
  return response.body.singleResult;
}
const get = (name, id) => adminService.getAdminRecord(context(), { resource: name, id: String(id) });
async function update(name, id, changes, options = {}) {
  const record = await get(name, id);
  return adminService.saveAdminRecord(context(), { resource: name, id: String(id), revision: record.revision, changes, reason: 'Yönetim düzeltmesi yapıldı.', ...options });
}
beforeAll(async () => {
  await connect();
  await Promise.all([...resources.values()].map(resource => resource.model.init()));
  api = new ApolloServer({ schema }); await api.start();
}, 60000);
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [admin, member] = await User.create([
    { username: 'admin', fullName: 'Yönetici', email: 'admin@fixture.test', password: 'secret-hash', role: 'ADMIN' },
    { username: 'reader', fullName: 'Okur', email: 'reader@fixture.test', password: 'private-hash' },
  ]);
  genre = await Genre.create({ name: 'Roman', slug: 'roman', iconUrl: '📚' });
  book = await Book.create({ title: 'Roman', description: 'Açıklama', authorId: member._id, genreId: genre._id, status: 'DRAFT' });
});

test.each([null, 'USER', 'forged'])('admin API rejects unauthenticated, ordinary and forged role contexts: %s', async kind => {
  const user = kind === null ? null : kind === 'USER' ? member : { _id: member._id, role: 'ADMIN' };
  for (const [name, variables] of [['GET_ADMIN_RESOURCES', {}], ['GET_ADMIN_OVERVIEW', {}], ['GET_ADMIN_RECORDS', { resource: 'User' }], ['GET_ADMIN_RECORD', { resource: 'User', id: admin.id }], ['SAVE_ADMIN_RECORD', { resource: 'Genre', changes: { name: 'Yeni' }, reason: 'Test oluşturma.' }]]) {
    const result = await run(name, variables, user);
    expect(result.errors?.[0].extensions.code).toBe('FORBIDDEN');
  }
});

test('all application models, schema fields, references and indexes are available only to a current admin', async () => {
  const result = await run('GET_ADMIN_RESOURCES'); expect(result.errors).toBeUndefined();
  expect(result.data.getAdminResources).toHaveLength(resources.size);
  expect(result.data.getAdminResources.find(item => item.name === 'User').fields.find(field => field.name === 'password')).toMatchObject({ sensitive: true, editable: false });
  expect(result.data.getAdminResources.find(item => item.name === 'Book').fields.find(field => field.name === 'genreId')).toMatchObject({ reference: 'Genre', editable: true });
  expect(result.data.getAdminResources.find(item => item.name === 'Book').indexes.length).toBeGreaterThan(0);
  await User.updateOne({ _id: admin._id }, { role: 'USER' });
  expect((await run('GET_ADMIN_RESOURCES')).errors[0].extensions.code).toBe('FORBIDDEN');
});

test('list and detail responses exclude passwords, codes and tokens even inside JSON', async () => {
  await User.updateOne({ _id: member._id }, { resetPasswordToken: 'reset-secret', authVersion: 7 });
  const verification = await Verification.create({ email: 'pending@fixture.test', code: '123456' });
  const session = await ReadingSession.create({ userId: member._id, token: 'reading-secret', bookId: book._id, lastHeartbeatAt: new Date(), expiresAt: new Date(Date.now() + 10000) });
  for (const [resource, id, secret] of [['User', member.id, 'private-hash'], ['Verification', verification.id, '123456'], ['ReadingSession', session.id, 'reading-secret']]) {
    const list = await run('GET_ADMIN_RECORDS', { resource }); const detail = await run('GET_ADMIN_RECORD', { resource, id });
    expect(list.errors).toBeUndefined(); expect(detail.errors).toBeUndefined();
    expect(JSON.stringify(list.data)).not.toContain(secret); expect(JSON.stringify(detail.data)).not.toContain(secret);
    expect(JSON.stringify(detail.data)).not.toContain('reset-secret');
  }
});

test('list includes draft, printed and deleted books with search, paging and state filters', async () => {
  await Book.create([{ title: 'Basılı', kind: 'PRINTED', publicationStatus: 'PENDING' }, { title: 'Kaldırılmış', isDeleted: true }]);
  expect((await run('GET_ADMIN_RECORDS', { resource: 'Book', limit: 2 })).data.getAdminRecords).toMatchObject({ total: 3, totalPages: 2 });
  expect((await run('GET_ADMIN_RECORDS', { resource: 'Book', search: 'Roman' })).data.getAdminRecords.items[0].id).toBe(book.id);
  expect((await run('GET_ADMIN_RECORDS', { resource: 'Book', state: 'DELETED' })).data.getAdminRecords.total).toBe(1);
  for (const variables of [{ resource: 'unknown' }, { resource: 'User', limit: 101 }, { resource: 'User', page: 0 }, { resource: 'User', search: 'x'.repeat(121) }, { resource: 'User', relatedField: 'password', relatedId: member.id }]) expect((await run('GET_ADMIN_RECORDS', variables)).errors).toBeDefined();
});

test('genre creation generates a Turkish slug, strips emoji, and records the mutation through the client document', async () => {
  const response = await run('SAVE_ADMIN_RECORD', { resource: 'Genre', changes: { name: '🧙 Çağdaş Öykü' }, reason: 'Yeni tür tanımlandı.' });
  expect(response.errors).toBeUndefined();
  const saved = await Genre.findById(response.data.saveAdminRecord.id);
  expect(saved).toMatchObject({ name: 'Çağdaş Öykü', slug: 'cagdas-oyku', iconUrl: '', isActive: true });
  const audit = await AdminAudit.findOne({ recordId: saved.id });
  expect(audit).toMatchObject({ resource: 'Genre', action: 'CREATE', reason: 'Yeni tür tanımlandı.' });
  expect(String(audit.actorId)).toBe(admin.id);
});

test('genre rename synchronizes named preferences while retaining book and ID-based preferences', async () => {
  await User.updateOne({ _id: member._id }, { 'authorSettings.preferredGenres': ['Roman', 'Şiir'] });
  await update('Genre', genre.id, { name: 'Çağdaş Roman', isActive: false });
  expect((await User.findById(member.id)).authorSettings.preferredGenres).toEqual(['Çağdaş Roman', 'Şiir']);
  expect(String((await Book.findById(book.id)).genreId)).toBe(genre.id);
  expect((await Genre.findById(genre.id)).iconUrl).toBe('');
  expect((await run('GET_ADMIN_RECORDS', { resource: 'Genre', state: 'INACTIVE' })).data.getAdminRecords.total).toBe(1);
  expect((await run('GET_ADMIN_RECORD', { resource: 'Book', id: book.id })).data.getAdminRecord.references).toEqual(expect.arrayContaining([expect.objectContaining({ resource: 'Genre', id: genre.id })]));
});

test('invalid/duplicate genre data and arbitrary schema or computed updates cannot write', async () => {
  for (const changes of [{ name: '' }, { name: '📚' }, { name: 'Başka', slug: 'roman' }, { name: 'roman' }, { name: 'Başka', hexColor: 'red' }, { name: 'Başka', isActive: 'false' }, { name: 'Başka', $where: 'unsafe' }]) {
    await expect(adminService.saveAdminRecord(context(), { resource: 'Genre', changes, reason: 'Yeni tür denemesi.' })).rejects.toThrow();
  }
  await expect(update('User', member.id, { password: 'changed' })).rejects.toThrow('düzenlenemez');
  await expect(update('Book', book.id, { currentFunding: 999 })).rejects.toThrow('düzenlenemez');
  expect(await AdminAudit.countDocuments()).toBe(0);
});

test('a stale edit returns a conflict without losing the more recent data', async () => {
  const old = await get('Genre', genre.id);
  await update('Genre', genre.id, { description: 'Yeni açıklama' });
  const response = await run('SAVE_ADMIN_RECORD', { resource: 'Genre', id: genre.id, revision: old.revision, changes: { description: 'Eski ekran' }, reason: 'Eski kaydı değiştirme.' });
  expect(response.errors[0].extensions.code).toBe('CONFLICT');
  expect((await Genre.findById(genre.id)).description).toBe('Yeni açıklama');
  expect(await AdminAudit.countDocuments()).toBe(1);
});

test('audit failure rolls back the content and denormalized preferences', async () => {
  await User.updateOne({ _id: member.id }, { 'authorSettings.preferredGenres': ['Roman'] });
  jest.spyOn(AdminAudit.prototype, 'save').mockRejectedValueOnce(new Error('audit unavailable'));
  await expect(update('Genre', genre.id, { name: 'Yeni Roman' })).rejects.toThrow('audit unavailable');
  expect((await Genre.findById(genre.id)).name).toBe('Roman');
  expect((await User.findById(member.id)).authorSettings.preferredGenres).toEqual(['Roman']);
});

test('account role/status changes invalidate sessions and cannot remove the current administrator', async () => {
  await update('User', member.id, { role: 'ADMIN' });
  expect((await User.findById(member.id)).authVersion).toBe(1);
  await expect(update('User', admin.id, { role: 'USER' })).rejects.toThrow('Kendi');
  await expect(update('User', admin.id, { isActive: false })).rejects.toThrow('Kendi');
  expect(await User.countDocuments({ role: 'ADMIN', isActive: true })).toBe(2);
});

test('concurrent administrators cannot deactivate each other and leave no administrator', async () => {
  await User.updateOne({ _id: member.id }, { role: 'ADMIN' });
  await AdminControl.updateOne({ _id: 'users' }, { $set: { version: 0 } }, { upsert: true });
  const [a, b] = await Promise.all([get('User', admin.id), get('User', member.id)]);
  await Promise.allSettled([
    adminService.saveAdminRecord({ user: admin }, { resource: 'User', id: member.id, revision: b.revision, changes: { isActive: false }, reason: 'Diğer yöneticiyi kapatma.' }),
    adminService.saveAdminRecord({ user: member }, { resource: 'User', id: admin.id, revision: a.revision, changes: { isActive: false }, reason: 'Diğer yöneticiyi kapatma.' }),
  ]);
  expect(await User.countDocuments({ role: 'ADMIN', isActive: true, isDeleted: false })).toBeGreaterThanOrEqual(1);
});

test('book archive/restore preserves independently removed chapters and comments', async () => {
  const [active, removed] = await Chapter.create([{ bookId: book.id, authorId: member.id, title: 'Aktif', content: 'Metin' }, { bookId: book.id, authorId: member.id, title: 'Önceden silinmiş', content: 'Gizli', isDeleted: true }]);
  const comment = await Comment.create({ bookId: book.id, userId: member.id, content: 'Yorum' });
  await update('Book', book.id, { isDeleted: true });
  expect((await Chapter.findById(active.id)).isDeleted).toBe(true); expect((await Comment.findById(comment.id)).isDeleted).toBe(true);
  await expect(update('Chapter', active.id, { isDeleted: false })).rejects.toThrow('kitabı');
  await update('Book', book.id, { isDeleted: false });
  expect((await Chapter.findById(active.id)).isDeleted).toBe(false); expect((await Chapter.findById(removed.id)).isDeleted).toBe(true);
  expect((await Comment.findById(comment.id)).isDeleted).toBe(false);
});

test('chapter edits update the book page total without awarding writing points', async () => {
  const chapter = await Chapter.create({ title: 'Bir', bookId: book.id, authorId: member.id, content: 'Metin', pageCount: 2 });
  await update('Chapter', chapter.id, { pageCount: 5, content: '<p>Yeni metin</p>' });
  expect((await Book.findById(book.id)).pageCount).toBe(5);
  expect(await resources.get('PointEvent').model.countDocuments()).toBe(0);
});

test('quotation edits keep duplicate detection and repost text in sync', async () => {
  const quote = await Quote.create({ text: 'Eski', normalizedText: 'eski', userId: member.id, bookId: book.id });
  const repost = await Quote.create({ text: 'Eski', normalizedText: 'eski', userId: admin.id, bookId: book.id, isRepost: true, originalQuoteId: quote.id });
  await update('Quote', quote.id, { text: 'Yeni alıntı.' });
  expect((await Quote.findById(quote.id)).normalizedText).toBe('yeni alnt');
  expect((await Quote.findById(repost.id)).text).toBe('Yeni alıntı.');
});

test('dashboard derives real totals and groups successful amounts by currency', async () => {
  await Transaction.create([{ userId: member.id, bookId: book.id, amount: 100, currency: 'TRY', status: 'SUCCESS' }, { userId: member.id, bookId: book.id, amount: 20, currency: 'USD', status: 'SUCCESS' }, { userId: member.id, bookId: book.id, amount: 500, currency: 'TRY', status: 'FAILED' }]);
  const response = await run('GET_ADMIN_OVERVIEW'); expect(response.errors).toBeUndefined();
  expect(response.data.getAdminOverview.revenue).toEqual(expect.arrayContaining([{ currency: 'TRY', amount: 100, count: 1 }, { currency: 'USD', amount: 20, count: 1 }]));
  const legacy = await api.executeOperation({ query: '{ getAllTransactions { id amount } }' }, { contextValue: context() });
  expect(legacy.body.singleResult.errors).toBeUndefined(); expect(legacy.body.singleResult.data.getAllTransactions).toHaveLength(3);
});

test('account archive and restore keep related records and invalidate old sessions', async () => {
  await update('User', member.id, { isDeleted: true });
  expect((await User.findById(member.id)).isActive).toBe(false);
  expect((await Book.findById(book.id)).isDeleted).toBe(false);
  await update('User', member.id, { isDeleted: false, isActive: true });
  expect((await User.findById(member.id)).authVersion).toBe(2);
  expect((await User.findById(member.id)).isDeleted).toBe(false);
  await expect(update('User', admin.id, { isDeleted: true })).rejects.toThrow('Kendi');
});

test('reading preferences synchronize author genre names and reject inactive references', async () => {
  const preference = await resources.get('UserPreference').model.create({ userId: member.id, preferredGenres: [genre.id], onboardingCompleted: true });
  const second = await Genre.create({ name: 'Öykü', slug: 'oyku' });
  await update('UserPreference', preference.id, { preferredGenres: [second.id] });
  expect((await User.findById(member.id)).authorSettings.preferredGenres).toEqual(['Öykü']);
  await Genre.updateOne({ _id: second.id }, { isActive: false });
  await expect(update('UserPreference', preference.id, { preferredGenres: [second.id] })).rejects.toThrow('pasif');
  await expect(update('UserPreference', preference.id, { preferredGenres: [] })).rejects.toThrow('en az');
});

test('progress and bookmark corrections validate the book and compute dependent fields', async () => {
  const first = await Chapter.create({ bookId: book.id, authorId: member.id, title: 'İlk', content: 'Metin', createdAt: new Date('2026-01-01') });
  const second = await Chapter.create({ bookId: book.id, authorId: member.id, title: 'İkinci', content: 'Metin', createdAt: new Date('2026-01-02') });
  const foreign = await Chapter.create({ bookId: new mongoose.Types.ObjectId(), authorId: member.id, title: 'Yabancı', content: 'Metin' });
  const progress = await resources.get('ReadingProgress').model.create({ userId: member.id, bookId: book.id });
  await expect(update('ReadingProgress', progress.id, { lastChapterId: foreign.id })).rejects.toThrow('bu kitapta');
  await update('ReadingProgress', progress.id, { lastChapterId: second.id, completedChapters: [first.id, second.id] });
  expect((await resources.get('ReadingProgress').model.findById(progress.id)).isCompleted).toBe(true);
  const bookmark = await resources.get('Bookmark').model.create({ userId: member.id, bookId: book.id, chapterId: first.id, chapterIndex: 0, paragraphIndex: 0, chapterTitle: 'İlk' });
  await update('Bookmark', bookmark.id, { chapterId: second.id, paragraphIndex: 2 });
  expect(await resources.get('Bookmark').model.findById(bookmark.id)).toMatchObject({ chapterTitle: 'İkinci', chapterIndex: 1, paragraphIndex: 2 });
  expect(await resources.get('PointEvent').model.countDocuments()).toBe(0);
});

test('an administrator can unsubscribe but cannot fabricate renewed newsletter consent', async () => {
  const subscription = await resources.get('NewsletterSubscription').model.create({ email: 'newsletter@fixture.test', status: 'active', tokenHash: 'secret' });
  await update('NewsletterSubscription', subscription.id, { status: 'unsubscribed' });
  const saved = await resources.get('NewsletterSubscription').model.findById(subscription.id);
  expect(saved.status).toBe('unsubscribed'); expect(saved.unsubscribedAt).toBeInstanceOf(Date); expect(saved.tokenHash).toBeUndefined();
  await expect(update('NewsletterSubscription', subscription.id, { status: 'active' })).rejects.toThrow('onayı');
});

test('badge creation validates actual score statistics instead of arbitrary field names', async () => {
  const input = { resource: 'Badge', changes: { key: 'new_badge', name: 'Yeni rozet', description: 'Yeni koşul', 'condition.stat': 'quotesCreated', 'condition.threshold': 10 }, reason: 'Yeni rozet tanımlandı.' };
  const saved = await adminService.saveAdminRecord(context(), input);
  expect(saved.values.condition).toMatchObject({ stat: 'quotesCreated', threshold: 10 });
  await expect(adminService.saveAdminRecord(context(), { ...input, changes: { ...input.changes, key: 'invalid', 'condition.stat': 'unknown' } })).rejects.toThrow('istatistiği');
});

test('printed metadata has ISBN validation while digital page counts remain computed', async () => {
  const printed = await Book.create({ title: 'Basılı kitap', kind: 'PRINTED', pageCount: 100 });
  await update('Book', printed.id, { isbn: '0-14-032872-6', pageCount: 210 });
  expect((await Book.findById(printed.id)).isbn).toBe('9780140328721');
  await expect(update('Book', book.id, { pageCount: 10 })).rejects.toThrow('basılı');
  await expect(update('Book', printed.id, { isbn: 'invalid' })).rejects.toThrow('ISBN');
});

test('legacy user deactivation and genre mutations use current authorization and audit', async () => {
  const source = `mutation($id:ID!){deleteUserById(id:$id){code message}}`;
  const denied = await api.executeOperation({ query: source, variables: { id: member.id } }, { contextValue: { user: member } });
  expect(denied.body.singleResult.errors).toBeDefined();
  const allowed = await api.executeOperation({ query: source, variables: { id: member.id } }, { contextValue: context() });
  expect(allowed.body.singleResult.errors).toBeUndefined(); expect((await User.findById(member.id)).isActive).toBe(false);
  const created = await api.executeOperation({ query: 'mutation{createGenre(name:"Bilim Kurgu",slug:"bilim-kurgu"){id name iconUrl}}' }, { contextValue: context() });
  expect(created.body.singleResult.errors).toBeUndefined(); expect(created.body.singleResult.data.createGenre.iconUrl).toBe('');
  expect(await AdminAudit.countDocuments()).toBe(2);
});

test('payment records stay provider controlled and finance search resolves user names', async () => {
  const transaction = await Transaction.create({ userId: member.id, bookId: book.id, amount: 100 });
  await expect(update('Transaction', transaction.id, { status: 'SUCCESS' })).rejects.toThrow('düzenlenemez');
  const response = await run('GET_ADMIN_RECORDS', { resource: 'Transaction', search: member.username });
  expect(response.errors).toBeUndefined(); expect(response.data.getAdminRecords.total).toBe(1);
});
