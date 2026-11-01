import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import AdminAudit from '../src/models/adminAudit.js';
import { FundingCampaign } from '../src/models/printFunding.js';
import { publisherCatalog } from '../src/services/publisherService.js';
import { getAdminRecord, getAdminResources, saveAdminRecord } from '../src/services/adminService.js';
import { connect, clearDatabase, closeDatabase } from './db.js';

let api, publisher, admin, author, book;
const source = readFileSync(new URL('../../Client/src/graphql/publisher.js', import.meta.url), 'utf8');
const query = source.split('gql`')[1].split('`;')[0];
const userQueries = readFileSync(new URL('../../Client/src/graphql/queries/user.js', import.meta.url), 'utf8');
const sessionQuery = userQueries.split('const ME_QUERY = gql`')[1].split('`;')[0];
const context = user => ({ user });
const list = (args = {}, user = publisher) => publisherCatalog(context(user), args);
const objectId = () => new mongoose.Types.ObjectId();
async function campaign(overrides = {}) {
  return FundingCampaign.create({
    bookId: book._id, authorId: author._id, applicationId: objectId(), versionId: objectId(), tariffId: objectId(),
    title: book.title, targetMinor: 100000, acceptedMinor: 12345, reservedMinor: 9000, supporterCount: 3,
    startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() + 86400000), ...overrides,
  });
}
beforeAll(async () => {
  await connect();
  await Promise.all([User.init(), Book.init(), FundingCampaign.init()]);
  api = new ApolloServer({ schema }); await api.start();
}, 60000);
afterEach(clearDatabase);
afterAll(async () => { await api.stop(); await closeDatabase(); });
beforeEach(async () => {
  [publisher, admin, author] = await User.create([
    { username: 'publisher', fullName: 'Yayınevi Sahibi', email: 'publisher@example.test', password: 'test-hash', role: 'PUBLISHER' },
    { username: 'admin', fullName: 'Yönetici', email: 'admin@example.test', password: 'test-hash', role: 'ADMIN' },
    { username: 'author', fullName: 'İpek Yazar', email: 'author@example.test', password: 'private-hash' },
  ]);
  book = await Book.create({ title: 'Yeni Roman', authorId: author._id, status: 'WRITING', digitalStatus: 'PUBLISHED' });
});

test.each(['PUBLISHER', 'ADMIN'])('%s can use the actual client operation without exposing private fields', async role => {
  await campaign();
  const result = (await api.executeOperation({ query, variables: { page: 1, limit: 20, search: '', funding: 'ALL' } }, { contextValue: context(role === 'ADMIN' ? admin : publisher) })).body.singleResult;
  expect(result.errors).toBeUndefined();
  expect(result.data.publisherCatalog).toMatchObject({ total: 1, page: 1, totalPages: 1, items: [{
    title: 'Yeni Roman', authorName: 'İpek Yazar', writingStatus: 'WRITING', campaign: { acceptedMinor: 12345, targetMinor: 100000, supporterCount: 3, environment: 'SANDBOX' },
  }] });
  expect(JSON.stringify(result.data)).not.toMatch(/email|password|reservedMinor|shippingAddress|tariffId/);
});

test.each(['ADMIN', 'PUBLISHER', 'USER'])('the actual session query returns the %s database role used by portal guards', async role => {
  const actor = role === 'ADMIN' ? admin : role === 'PUBLISHER' ? publisher : author;
  const result = (await api.executeOperation({ query: sessionQuery }, { contextValue: context(actor) })).body.singleResult;
  expect(result.errors).toBeUndefined();
  expect(result.data.me).toMatchObject({ id: actor.id, role });
});

test('anonymous, ordinary and forged privileged contexts are rejected by the database role', async () => {
  await expect(list({}, null)).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
  for (const actor of [author, { _id: author._id, role: 'PUBLISHER' }, { _id: author._id, role: 'ADMIN' }]) {
    await expect(list({}, actor)).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  }
});

test.each([{ role: 'USER' }, { isActive: false }, { isDeleted: true }])('an open portal loses server access immediately after %j', async changes => {
  expect((await list()).total).toBe(1);
  await User.updateOne({ _id: publisher._id }, changes);
  await expect(list()).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
});

test('drafts, archived books, printed books and disabled or missing authors stay out', async () => {
  const hiddenAuthor = await User.create({ username: 'hidden', fullName: 'Hidden', email: 'hidden@example.test', password: 'test', isActive: false });
  await Book.create([
    { title: 'Taslak', authorId: author._id, status: 'DRAFT' },
    { title: 'Yeni taslak', authorId: author._id, status: 'COMPLETED', digitalStatus: 'DRAFT' },
    { title: 'Silindi', authorId: author._id, status: 'PUBLISHED', isDeleted: true },
    { title: 'Basılı', authorId: author._id, status: 'PUBLISHED', kind: 'PRINTED' },
    { title: 'Pasif yazar', authorId: hiddenAuthor._id, status: 'PUBLISHED' },
    { title: 'Eksik yazar', authorId: objectId(), status: 'PUBLISHED' },
    { title: 'Eski dijital yayın', authorId: author._id, status: 'COMPLETED' },
  ]);
  expect((await list()).items.map(item => item.title).sort()).toEqual(['Eski dijital yayın', 'Yeni Roman']);
  await User.updateOne({ _id: author._id }, { isDeleted: true });
  expect((await list()).total).toBe(0);
});

test('the latest campaign wins over history; reserved and legacy funding are never counted as accepted', async () => {
  await Book.updateOne({ _id: book._id }, { currentFunding: 999999, fundingTarget: 999999 });
  await campaign({ state: 'FAILED', activeLock: false, acceptedMinor: 0, createdAt: new Date('2026-01-01') });
  const latest = await campaign({ createdAt: new Date('2026-02-01') });
  expect((await list()).items[0].campaign).toMatchObject({ id: latest.id, acceptedMinor: 12345 });
  expect((await list({ funding: 'HAS_CAMPAIGN' })).total).toBe(1);
  expect((await list({ funding: 'ACTIVE' })).total).toBe(1);
  expect((await list({ funding: 'SUCCEEDED' })).total).toBe(0);
  await FundingCampaign.updateOne({ _id: latest._id }, { state: 'SUCCEEDED', acceptedMinor: 100000, activeLock: false });
  expect((await list({ funding: 'ACTIVE' })).total).toBe(0);
  expect((await list({ funding: 'SUCCEEDED' })).items[0].campaign.acceptedMinor).toBe(100000);
});

test('expired campaigns remain in history but are excluded from open support', async () => {
  await campaign({ endsAt: new Date(Date.now() - 1000) });
  expect((await list({ funding: 'ACTIVE' })).total).toBe(0);
  expect((await list({ funding: 'HAS_CAMPAIGN' })).total).toBe(1);
});

test('books without a new campaign remain discoverable without invented historical totals', async () => {
  await Book.updateOne({ _id: book._id }, { status: 'FUNDING', currentFunding: 500 });
  expect((await list()).items[0].campaign).toBeNull();
  expect((await list({ funding: 'HAS_CAMPAIGN' })).total).toBe(0);
});

test('search handles titles, Turkish author names, usernames and literal regex characters', async () => {
  for (const search of ['roman', 'ipek', 'author', '  Yeni  ']) expect((await list({ search })).total).toBe(1);
  expect((await list({ search: '.*' })).total).toBe(0);
  expect((await list({ search: '[' })).total).toBe(0);
});

test('pagination has a stable ID tie breaker and returns accurate empty/end page counts', async () => {
  const publishDate = new Date('2026-03-01');
  await Book.updateOne({ _id: book._id }, { publishDate });
  await Book.create({ title: 'İkinci Kitap', authorId: author._id, status: 'COMPLETED', publishDate });
  const first = await list({ limit: 1 }), second = await list({ page: 2, limit: 1 }), empty = await list({ page: 3, limit: 1 });
  expect(first).toMatchObject({ total: 2, totalPages: 2 });
  expect(first.items[0].id).not.toBe(second.items[0].id);
  expect((await list({ limit: 1 })).items[0].id).toBe(first.items[0].id);
  expect(empty.items).toEqual([]);
});

test.each([{ page: 0 }, { page: 1.5 }, { page: 10001 }, { limit: 0 }, { limit: 49 }, { search: 'x'.repeat(101) }, { search: null }, { funding: 'UNKNOWN' }])('invalid catalog arguments fail before querying: %j', async args => {
  await expect(list(args)).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
});

test('only admins can assign the new role; assignment is audited and invalidates existing sessions', async () => {
  const record = await getAdminRecord(context(admin), { resource: 'User', id: author.id });
  const input = { resource: 'User', id: author.id, revision: record.revision, changes: { role: 'PUBLISHER' }, reason: 'Yayınevi sahibi hesabı doğrulandı.' };
  await expect(saveAdminRecord(context(publisher), input)).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  await saveAdminRecord(context(admin), input);
  expect(await User.findById(author._id)).toMatchObject({ role: 'PUBLISHER', authVersion: 1 });
  expect(await AdminAudit.findOne({ recordId: author.id })).toMatchObject({ actorId: admin._id, fields: ['role'] });
  const resources = await getAdminResources(context(admin));
  expect(resources.find(item => item.name === 'User').fields.find(field => field.name === 'role').enumValues).toContain('PUBLISHER');
});

test('publisher access does not grant admin data or print application review permissions', async () => {
  await expect(getAdminResources(context(publisher))).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } });
  const result = (await api.executeOperation({ query: 'mutation($input: ReviewPrintApplicationInput!) { reviewPrintApplication(input: $input) { id } }', variables: {
    input: { applicationId: String(objectId()), revision: 0, decision: 'APPROVED', reason: 'Yetkisiz onay denemesi.' },
  } }, { contextValue: context(publisher) })).body.singleResult;
  expect(result.errors[0].extensions.code).toBe('FORBIDDEN');
});
