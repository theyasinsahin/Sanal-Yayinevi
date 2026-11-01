import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { parse, print } from 'graphql';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Genre from '../src/models/genre.js';
import Quote from '../src/models/quote.js';
import { FundingCampaign } from '../src/models/printFunding.js';
import { getBookFeed } from '../src/services/bookCatalogService.js';
import { fundingSummary } from '../src/services/bookFundingService.js';
import { connect, clearDatabase, closeDatabase } from './db.js';

let api, sequence = 0;
const sources = ['queries/book.js', 'classification.js', 'printedBooks.js'].map(path => readFileSync(new URL(`../../Client/src/graphql/${path}`, import.meta.url), 'utf8'));
function document(name) {
  const pattern = new RegExp(`(?:export )?const ${name} = gql` + '`([\\s\\S]*?)`;');
  const raw = sources.map(source => source.match(pattern)?.[1]).find(Boolean);
  const ast = parse(raw.replace(/\$\{([A-Z_]+)\}/g, (_, fragment) => document(fragment)));
  const seen = new Set();
  ast.definitions = ast.definitions.filter(definition => { const key = definition.name?.value; if (seen.has(key)) return false; seen.add(key); return true; });
  return print(ast);
}
const oid = () => new mongoose.Types.ObjectId();
async function fixture({ book: bookChanges = {}, campaign: campaignChanges = {}, noCampaign = false } = {}) {
  const number = ++sequence;
  const author = await User.create({ username: `author${number}`, fullName: `Yazar ${number}`, email: `author${number}@example.test`, password: 'test-only' });
  const book = await Book.create({ title: `Kitap ${number}`, description: 'Test eseri açıklaması.', authorId: author._id, status: 'WRITING', digitalStatus: 'PUBLISHED', ...bookChanges });
  const campaign = noCampaign ? null : await FundingCampaign.create({ bookId: book._id, authorId: author._id, applicationId: oid(), versionId: oid(), tariffId: oid(),
    title: book.title, targetMinor: 100000, acceptedMinor: 25000, reservedMinor: 50000, startsAt: new Date('2026-01-01'), endsAt: new Date('2099-01-01'), ...campaignChanges });
  return { author, book, campaign };
}
async function run(name, variables = {}, user = null) {
  const result = (await api.executeOperation({ query: document(name), variables }, { contextValue: { user } })).body.singleResult;
  expect(result.errors).toBeUndefined(); return result.data;
}
const ids = page => page.books.map(book => book.id);
beforeAll(async () => {
  await connect(); await Promise.all([Book.init(), User.init(), FundingCampaign.init()]);
  api = new ApolloServer({ schema }); await api.start();
}, 60000);
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
afterAll(async () => { await api.stop(); await closeDatabase(); });

test('real card/feed queries show accepted support and never add legacy totals or reservations', async () => {
  const { book } = await fixture({ book: { currentFunding: 999999, fundingTarget: 999999 }, campaign: { acceptedMinor: 12345 } });
  for (const [name, variables] of [['GET_BOOK_FEED', {}], ['GET_BOOK_CARD', { id: book.id }]]) {
    const result = await run(name, variables);
    const summary = (name === 'GET_BOOK_FEED' ? result.getBookFeed.books[0] : result.getBookById).fundingSummary;
    expect(summary).toMatchObject({ acceptedMinor: 12345, targetMinor: 100000, remainingMinor: 87655, progressPercent: 12.345, isOpen: true, goalReached: false, environment: 'SANDBOX' });
    expect(JSON.stringify(summary)).not.toMatch(/reservedMinor|financeIssue|tariffId|shippingAddress|applicationId/);
  }
});

test('closest-to-target orders open campaigns by remaining TRY rather than completion percentage', async () => {
  const small = await fixture({ campaign: { targetMinor: 10000, acceptedMinor: 5000 } });
  const large = await fixture({ campaign: { targetMinor: 1000000, acceptedMinor: 990000 } });
  await fixture({ noCampaign: true });
  await fixture({ campaign: { state: 'SUCCEEDED', targetMinor: 10000, acceptedMinor: 10000, activeLock: false } });
  const page = await getBookFeed({ sort: 'CLOSEST_TO_TARGET' });
  expect(ids(page)).toEqual([small.book.id, large.book.id]);
  await FundingCampaign.updateOne({ _id: large.campaign._id }, { acceptedMinor: 999000 });
  expect(ids(await getBookFeed({ sort: 'CLOSEST_TO_TARGET' }))).toEqual([large.book.id, small.book.id]);
});

test('closest-to-target cursors preserve deterministic ties across all pages', async () => {
  const fixtures = [];
  for (let index = 0; index < 5; index++) fixtures.push(await fixture({ campaign: { acceptedMinor: index < 3 ? 90000 : 50000 } }));
  const expected = ids(await getBookFeed({ sort: 'CLOSEST_TO_TARGET' }));
  const collected = []; let after;
  do {
    const page = await getBookFeed({ sort: 'CLOSEST_TO_TARGET', limit: 2, after });
    collected.push(...ids(page)); after = page.hasNextPage ? page.endCursor : null;
  } while (after);
  expect(collected).toEqual(expected);
  expect(collected.slice(0, 3)).toEqual(fixtures.slice(0, 3).map(item => item.book.id).sort());
  expect(new Set(collected).size).toBe(5);
});

test.each([
  { state: 'CANCELLED' }, { state: 'REFUNDING' }, { state: 'REFUNDED' }, { state: 'FAILED' },
  { endsAt: new Date('2020-01-01') }, { startsAt: new Date('2098-01-01') },
  { financeIssue: 'LEDGER_MISMATCH' }, { targetMinor: 0, acceptedMinor: 0 },
])('campaign %j is excluded from open support and has no active card bar', async campaign => {
  const item = await fixture({ campaign });
  expect(ids(await getBookFeed({ funding: 'ACTIVE' }))).toEqual([]);
  expect(ids(await getBookFeed({ sort: 'CLOSEST_TO_TARGET' }))).toEqual([]);
  const result = await run('GET_BOOK_CARD', { id: item.book.id });
  expect(result.getBookById.fundingSummary).toMatchObject({ isOpen: false, goalReached: false });
});

test.each([
  { state: 'SUCCEEDED', activeLock: false }, { state: 'CLOSING', outcome: 'TARGET' }, { state: 'ACTIVE' },
])('completed target %j is listed separately with 100 percent support', async changes => {
  const item = await fixture({ campaign: { targetMinor: 100000, acceptedMinor: 100000, ...changes } });
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([item.book.id]);
  expect(ids(await getBookFeed({ funding: 'ACTIVE' }))).toEqual([]);
  const result = await run('GET_BOOK_FEED', { funding: 'FUNDED' });
  expect(result.getBookFeed.books[0].fundingSummary).toMatchObject({ goalReached: true, isOpen: false, progressPercent: 100, remainingMinor: 0 });
});

test('cancelled, refunded and unreconciled finance-issue campaigns cannot appear completed', async () => {
  for (const changes of [{ state: 'CLOSING', outcome: 'CANCELLED' }, { state: 'REFUNDING' }, { state: 'REFUNDED' }, { state: 'SUCCEEDED', financeIssue: 'LEDGER_MISMATCH' }]) {
    await fixture({ campaign: { acceptedMinor: 100000, ...changes } });
  }
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([]);
});

test('the newest campaign controls both card totals and membership, even with equal timestamps', async () => {
  const item = await fixture({ campaign: { state: 'SUCCEEDED', acceptedMinor: 100000, activeLock: false, createdAt: new Date('2026-01-01') } });
  const newest = await FundingCampaign.create({ ...item.campaign.toObject(), _id: oid(), applicationId: oid(), versionId: oid(), state: 'ACTIVE', acceptedMinor: 20000, activeLock: true });
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([]);
  const result = await run('GET_BOOK_CARD', { id: item.book.id });
  expect(result.getBookById.fundingSummary).toMatchObject({ id: newest.id, acceptedMinor: 20000, isOpen: true });
  await FundingCampaign.updateOne({ _id: newest._id }, { state: 'FAILED', activeLock: false });
  expect(ids(await getBookFeed({ funding: 'ACTIVE' }))).toEqual([]);
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([]);
});

test('search by title, author, quote and classification is applied before support sorting and pagination', async () => {
  const genre = await Genre.create({ name: 'Roman', slug: 'roman', group: 'FICTION', classificationVersion: 1 });
  const first = await fixture({ book: { title: 'İstanbul Romanı', genreIds: [genre._id] }, campaign: { acceptedMinor: 95000 } });
  const second = await fixture({ book: { title: 'Başka Kitap', genreIds: [genre._id] }, campaign: { acceptedMinor: 70000 } });
  await User.updateOne({ _id: first.author._id }, { fullName: 'İpek Yazar' });
  await Quote.create({ bookId: second.book._id, userId: second.author._id, text: 'Deniz ve yıldızlar.', normalizedText: 'deniz ve yıldızlar' });
  await fixture({ campaign: { acceptedMinor: 99000 } });
  for (const search of ['istanbul', 'ipek']) {
    expect(ids(await getBookFeed({ funding: 'ACTIVE', sort: 'CLOSEST_TO_TARGET', classification: { genres: ['roman'] }, search, limit: 1 }))).toEqual([first.book.id]);
  }
  expect(ids(await getBookFeed({ funding: 'ACTIVE', search: 'yıldızlar', classification: { genres: ['roman'] } }))).toEqual([second.book.id]);
  expect(ids(await getBookFeed({ funding: 'ACTIVE', search: '.*' }))).toEqual([]);
  expect(ids(await getBookFeed({ funding: 'ACTIVE', classification: { genres: ['missing'] } }))).toEqual([]);
});

test('draft/deleted/printed books and inactive/missing authors do not enter funding lists', async () => {
  for (const book of [{ status: 'DRAFT', digitalStatus: 'DRAFT' }, { status: 'WRITING', digitalStatus: 'DRAFT' }, { isDeleted: true }, { kind: 'PRINTED' }]) {
    const item = await fixture({ book });
    expect(fundingSummary(item.campaign).isOpen).toBe(true);
    const result = await run('GET_BOOK_CARD', { id: item.book.id }, item.author);
    if (result.getBookById) expect(result.getBookById.fundingSummary).toBeNull();
  }
  const inactive = await fixture(); await User.updateOne({ _id: inactive.author._id }, { isActive: false });
  const missing = await fixture(); await User.deleteOne({ _id: missing.author._id });
  expect(ids(await getBookFeed({ funding: 'ACTIVE' }))).toEqual([]);
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([]);
});

test('legacy book totals never create a campaign summary or funded listing', async () => {
  const item = await fixture({ noCampaign: true, book: { status: 'FUNDED', currentFunding: 10000, fundingTarget: 10000 } });
  const result = await run('GET_BOOK_CARD', { id: item.book.id });
  expect(result.getBookById.fundingSummary).toBeNull();
  expect(ids(await getBookFeed({ funding: 'ACTIVE' }))).toEqual([]);
  expect(ids(await getBookFeed({ funding: 'FUNDED' }))).toEqual([]);
  expect(ids(await getBookFeed())).toEqual([item.book.id]);
});

test('card campaign reads are batched once and filtered feeds reuse their already loaded campaign', async () => {
  for (let index = 0; index < 5; index++) await fixture();
  const aggregate = jest.spyOn(FundingCampaign, 'aggregate');
  await run('GET_BOOK_FEED'); expect(aggregate).toHaveBeenCalledTimes(1);
  aggregate.mockClear();
  await run('GET_BOOK_FEED', { funding: 'ACTIVE' }); expect(aggregate).not.toHaveBeenCalled();
});

test('cursors cannot be reused with another funding filter, search, genre or sort', async () => {
  await fixture();
  const first = await getBookFeed({ sort: 'CLOSEST_TO_TARGET', funding: 'ACTIVE', limit: 1 });
  for (const changes of [{ funding: 'FUNDED', sort: 'NEWEST' }, { funding: 'ALL', sort: 'NEWEST' }, { search: 'other' }, { classification: { genres: ['roman'] } }]) {
    await expect(getBookFeed({ funding: 'ACTIVE', sort: 'CLOSEST_TO_TARGET', after: first.endCursor, ...changes })).rejects.toThrow();
  }
  for (const value of [-1, 0.5, '500', null]) {
    const cursor = JSON.parse(Buffer.from(first.endCursor, 'base64url').toString()); cursor.value = value;
    await expect(getBookFeed({ sort: 'CLOSEST_TO_TARGET', after: Buffer.from(JSON.stringify(cursor)).toString('base64url') })).rejects.toThrow();
  }
});

test('invalid sort/filter combinations are rejected explicitly', async () => {
  await expect(getBookFeed({ funding: 'FUNDED', sort: 'CLOSEST_TO_TARGET' })).rejects.toThrow();
  await expect(getBookFeed({ funding: 'UNKNOWN' })).rejects.toThrow();
});

test.each(['NEWEST', 'OLDEST', 'UPDATED', 'POPULAR'])('the existing %s sort still paginates correctly inside open-campaign results', async sort => {
  const first = await fixture({ book: { stats: { likes: 1 }, publishDate: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') } });
  const second = await fixture({ book: { stats: { likes: 9 }, publishDate: new Date('2026-02-01'), updatedAt: new Date('2026-02-01') } });
  const page = await getBookFeed({ funding: 'ACTIVE', sort, limit: 1 });
  const next = await getBookFeed({ funding: 'ACTIVE', sort, limit: 1, after: page.endCursor });
  expect([...ids(page), ...ids(next)]).toEqual(sort === 'OLDEST' ? [first.book.id, second.book.id] : [second.book.id, first.book.id]);
  expect(next.hasNextPage).toBe(false);
});
