import { ApolloServer } from '@apollo/server';
import { connect, clearDatabase, closeDatabase } from './db.js';
import schema from '../src/graphql/schema.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Quote from '../src/models/quote.js';
import QuoteComment from '../src/models/quoteComment.js';
import Conversation from '../src/models/conversation.js';
import Message from '../src/models/message.js';
import UserScore from '../src/models/userScore.js';
import * as quotes from '../src/services/quoteService.js';
import { getBookFeed } from '../src/services/bookCatalogService.js';
import { getPublicQuote, getSocialShare } from '../src/services/socialShareService.js';
import { sendMessage } from '../src/services/messageService.js';
import messageResolvers from '../src/graphql/resolvers/message.js';
import { getAdminRecords, getAdminRecord, saveAdminRecord, getAdminOverview } from '../src/services/adminService.js';

let api, owner, visitor, admin, book, chapter, hidden, visible;
beforeAll(async () => { await connect(); api = new ApolloServer({ schema }); await api.start(); });
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  [owner, visitor, admin] = await User.create(['owner', 'visitor', 'admin'].map(username => ({ username, fullName: username, email: `${username}@example.test`, password: 'test', role: username === 'admin' ? 'ADMIN' : 'USER' })));
  book = await Book.create({ title: 'Book title', description: 'Description', authorId: owner._id, status: 'WRITING' });
  chapter = await Chapter.create({ bookId: book._id, authorId: owner._id, title: 'Chapter', content: 'Content' });
  hidden = await quotes.createQuote(owner._id, { bookId: book.id, chapterId: chapter.id, text: 'secret phrase only in a private quote', note: 'personal note', visibility: 'PRIVATE' });
  visible = await Quote.create({ bookId: book.id, chapterId: chapter.id, userId: owner.id, text: 'public quotation for all readers', normalizedText: 'public quotation for all readers' });
});
const ids = list => list.map(item => String(item._id || item.id));
async function execute(query, variables, user) {
  const response = await api.executeOperation({ query, variables }, { contextValue: { user } });
  return response.body.singleResult;
}

test('owner sees private quotes on profile/book/direct link; guests, visitors and admins do not', async () => {
  for (const user of [undefined, visitor, admin, owner]) {
    const expected = user === owner ? expect.arrayContaining([hidden.id, visible.id]) : [visible.id];
    expect(ids(await quotes.getQuotesByUser(owner.id, user))).toEqual(expected);
    expect(ids(await quotes.getQuotesByBook(book.id, user))).toEqual(expected);
    const result = await execute('query($id:ID!){getQuoteById(id:$id){id text note visibility}}', { id: hidden.id }, user);
    expect(result.errors).toBeUndefined();
    if (user === owner) expect(result.data.getQuoteById).toMatchObject({ text: hidden.text, note: 'personal note', visibility: 'PRIVATE' });
    else expect(result.data.getQuoteById).toBeNull();
  }
});

test('public feeds, quote searches and book searches never match private text', async () => {
  expect(ids(await quotes.getQuotesFeed())).toEqual([visible.id]);
  expect(await quotes.searchQuotes('secret phrase')).toEqual([]);
  expect((await getBookFeed({ search: 'secret phrase' })).books).toEqual([]);
  expect(ids((await getBookFeed({ search: 'public quotation' })).books)).toEqual([book.id]);
  for (const user of [undefined, visitor, owner]) {
    expect(await quotes.checkQuoteExists(hidden.text, book.id, user)).toMatchObject({ exists: false, quote: null });
    const check = await quotes.checkQuoteExists(hidden.text, book.id, user, 'PRIVATE');
    expect(check.exists).toBe(user === owner);
    if (user !== owner) expect(check.quote).toBeNull();
  }
});

test('duplicate detection permits personal copies and never returns another owners private ID', async () => {
  const data = { bookId: book.id, chapterId: chapter.id, text: hidden.text };
  const personal = await quotes.createQuote(visitor.id, { ...data, visibility: 'PRIVATE' });
  expect(personal.id).not.toBe(hidden.id);
  const shared = await quotes.createQuote(visitor.id, data);
  expect(shared.visibility).toBe('PUBLIC');
  await expect(quotes.createQuote(visitor.id, { ...data, visibility: 'PRIVATE' })).rejects.toThrow(`QUOTE_EXISTS:${personal.id}`);
  const privatePublicCopy = await quotes.createQuote(owner.id, { ...data, text: visible.text, visibility: 'PRIVATE' });
  expect(privatePublicCopy.visibility).toBe('PRIVATE');
  expect((await quotes.checkQuoteExists(hidden.text, book.id, visitor, 'PRIVATE')).quote.id).toBe(personal.id);
});

test('private content cannot be liked, commented, reposted, previewed or sent as a message even by owner', async () => {
  const conversation = await Conversation.create({ participants: [owner.id, visitor.id] });
  for (const user of [owner, visitor]) {
    await expect(quotes.toggleQuoteLike(hidden.id, user.id)).rejects.toThrow();
    await expect(quotes.addQuoteComment(user.id, hidden.id, 'comment')).rejects.toThrow();
    await expect(quotes.repostQuote(user.id, hidden.id)).rejects.toThrow();
    await expect(sendMessage(user.id, { conversationId: conversation.id, type: 'QUOTE', attachedQuoteId: hidden.id })).rejects.toThrow();
  }
  await expect(getPublicQuote(hidden.id)).rejects.toThrow();
  await expect(getSocialShare('QUOTE', hidden.id)).rejects.toThrow();
  await expect(quotes.getQuoteComments(hidden.id, visitor)).rejects.toThrow();
  expect(await quotes.getQuoteComments(hidden.id, owner)).toEqual([]);
  expect(await Message.countDocuments()).toBe(0);
  expect(await QuoteComment.countDocuments()).toBe(0);
  expect((await Quote.findById(hidden.id)).likedBy).toHaveLength(0);
});

test('populated stale message attachments are checked again before GraphQL serialization', async () => {
  const stale = { attachedQuoteId: hidden.toObject() };
  expect(await messageResolvers.Message.attachedQuote(stale)).toBeNull();
  expect((await messageResolvers.Message.attachedQuote({ attachedQuoteId: visible.id })).id).toBe(visible.id);
});

test('private quote records and related comments cannot be read or edited through admin CRUD', async () => {
  const context = { user: admin };
  const comment = await QuoteComment.create({ quoteId: hidden.id, userId: owner.id, content: 'old private note' });
  const result = await getAdminRecords(context, { resource: 'Quote' });
  expect(ids(result.items)).toEqual([visible.id]);
  expect(await getAdminRecord(context, { resource: 'Quote', id: hidden.id })).toBeNull();
  expect(await getAdminRecord(context, { resource: 'QuoteComment', id: comment.id })).toBeNull();
  expect((await getAdminRecords(context, { resource: 'QuoteComment' })).items).toEqual([]);
  await expect(saveAdminRecord(context, { resource: 'Quote', id: hidden.id, revision: 'unknown', changes: { note: 'changed' }, reason: 'Testing privacy' })).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  expect((await Quote.findById(hidden.id)).note).toBe('personal note');
});

test('legacy quotes remain public and invalid GraphQL visibility is rejected', async () => {
  await Quote.collection.updateOne({ _id: visible._id }, { $unset: { visibility: '' } });
  expect(ids(await quotes.getQuotesFeed())).toEqual([visible.id]);
  const result = await execute('query($id:ID!){getQuoteById(id:$id){id visibility}}', { id: visible.id });
  expect(result.data.getQuoteById.visibility).toBe('PUBLIC');
  const invalid = await execute('mutation($book:ID!,$chapter:ID!,$visibility:QuoteVisibility){createQuote(bookId:$book,chapterId:$chapter,text:"New quotation here",visibility:$visibility){id}}', { book: book.id, chapter: chapter.id, visibility: 'INVALID' }, owner);
  expect(invalid.errors).toBeDefined();
});

test('GraphQL creation persists visibility, keeps private activity out of public scores and protects deletion', async () => {
  const mutation = 'mutation($book:ID!,$chapter:ID!,$visibility:QuoteVisibility){createQuote(bookId:$book,chapterId:$chapter,text:"A newly created quotation",visibility:$visibility){id visibility}}';
  expect(await UserScore.findOne({ userId: owner.id })).toBeNull();
  const privateResult = await execute(mutation, { book: book.id, chapter: chapter.id, visibility: 'PRIVATE' }, owner);
  expect(privateResult.errors).toBeUndefined();
  expect(privateResult.data.createQuote.visibility).toBe('PRIVATE');
  expect(await UserScore.findOne({ userId: owner.id })).toBeNull();
  const publicResult = await execute(mutation, { book: book.id, chapter: chapter.id }, owner);
  expect(publicResult.errors).toBeUndefined();
  expect(publicResult.data.createQuote.visibility).toBe('PUBLIC');
  expect((await UserScore.findOne({ userId: owner.id })).stats.quotesCreated).toBe(1);
  await expect(quotes.deleteQuote(hidden.id, visitor.id)).rejects.toThrow();
  expect((await getAdminOverview({ user: admin })).counts.find(item => item.resource === 'Quote').total).toBe(2);
  await quotes.deleteQuote(hidden.id, owner.id);
  expect(await Quote.findById(hidden.id)).toBeNull();
});

test('a malformed public repost cannot expose a private original', async () => {
  const repost = await Quote.create({ userId: visitor.id, bookId: book.id, text: hidden.text, normalizedText: hidden.normalizedText, isRepost: true, originalQuoteId: hidden.id });
  expect(await quotes.getQuotesByUser(visitor.id, visitor)).toEqual([]);
  await expect(getPublicQuote(repost.id)).rejects.toThrow();
  const result = await execute('query($id:ID!){getQuoteById(id:$id){id text}}', { id: repost.id }, visitor);
  expect(result.data.getQuoteById).toBeNull();
});
