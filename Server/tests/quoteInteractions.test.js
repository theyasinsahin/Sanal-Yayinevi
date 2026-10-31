import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Quote from '../src/models/quote.js';
import QuoteComment from '../src/models/quoteComment.js';
import Notification from '../src/models/notification.js';
import * as quotes from '../src/services/quoteService.js';

jest.setTimeout(30000);
let author, reader, other, book, chapter, quote;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [author, reader, other] = await User.create(['author', 'reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash' })));
  book = await Book.create({ title: 'Quote source', authorId: author.id, status: 'WRITING' });
  chapter = await Chapter.create({ title: 'Source chapter', authorId: author.id, bookId: book.id, content: 'A useful paragraph from a book.' });
  quote = await quotes.createQuote(author.id, { bookId: book.id, chapterId: chapter.id, text: 'A useful paragraph from a book.' });
});
const run = (source, variables = {}, user = reader) => graphql({ schema, source, variableValues: variables, contextValue: { user, User, Book } });

test('public quote likes toggle without losing other likes and notification preferences are respected', async () => {
  await quotes.toggleQuoteLike(quote.id, reader.id);
  expect(await Notification.countDocuments({ type: 'QUOTE_LIKED', userId: author.id })).toBe(1);
  await quotes.toggleQuoteLike(quote.id, other.id);
  const remaining = await quotes.toggleQuoteLike(quote.id, reader.id);
  expect(remaining.likedBy.map(String)).toEqual([other.id]);
  await User.updateOne({ _id: author.id }, { 'notificationSettings.quoteLike': false });
  await Notification.deleteMany();
  await quotes.toggleQuoteLike(quote.id, reader.id);
  expect(await Notification.countDocuments({ type: 'QUOTE_LIKED' })).toBe(0);
});
test('quote comments populate their author and like state; only their author can delete them', async () => {
  const comment = await quotes.addQuoteComment(reader.id, quote.id, 'Thoughts');
  expect(comment.userId.username).toBe('reader');
  await quotes.toggleQuoteCommentLike(comment.id, other.id);
  expect((await quotes.getQuoteComments(quote.id))[0].likedBy.map(String)).toEqual([other.id]);
  expect((await quotes.toggleQuoteCommentLike(comment.id, other.id)).likedBy).toHaveLength(0);
  await expect(quotes.deleteQuoteComment(comment.id, other.id)).rejects.toThrow();
  expect((await quotes.deleteQuoteComment(comment.id, reader.id)).code).toBe(200);
  expect(await quotes.getQuoteComments(quote.id)).toEqual([]);
  await expect(quotes.deleteQuoteComment(comment.id, reader.id)).rejects.toThrow();
  await expect(quotes.toggleQuoteCommentLike(comment.id, reader.id)).rejects.toThrow();
});
test('deleted and inactive-user quote comments stay out of the public list', async () => {
  const deleted = await quotes.addQuoteComment(reader.id, quote.id, 'Deleted');
  await QuoteComment.updateOne({ _id: deleted.id }, { isDeleted: true });
  await quotes.addQuoteComment(other.id, quote.id, 'Inactive');
  await User.updateOne({ _id: other.id }, { isActive: false });
  expect(await quotes.getQuoteComments(quote.id)).toEqual([]);
});
test('reposting records source and attribution once, and unreposting removes the original counter', async () => {
  const repost = await quotes.repostQuote(reader.id, quote.id, 'My note', true);
  expect(repost).toMatchObject({ isRepost: true, repostComment: 'My note', isSpoiler: true });
  expect(repost.originalQuoteId.id).toBe(quote.id);
  expect((await Quote.findById(quote.id)).repostedBy.map(String)).toEqual([reader.id]);
  await expect(quotes.repostQuote(reader.id, quote.id)).rejects.toThrow();
  await quotes.unrepostQuote(reader.id, quote.id);
  expect((await Quote.findById(quote.id)).repostedBy).toHaveLength(0);
  expect(await Quote.findById(repost.id)).toBeNull();
  await expect(quotes.unrepostQuote(reader.id, quote.id)).rejects.toThrow();
});
test('deleting an original quote removes reposts and its comments without touching other quotes', async () => {
  const repost = await quotes.repostQuote(reader.id, quote.id);
  await quotes.addQuoteComment(reader.id, quote.id, 'Comment');
  const keep = await quotes.createQuote(other.id, { bookId: book.id, chapterId: chapter.id, text: 'A different paragraph in the same book.' });
  await expect(quotes.deleteQuote(quote.id, reader.id)).rejects.toThrow();
  await quotes.deleteQuote(quote.id, author.id);
  expect(await Quote.findById(quote.id)).toBeNull();
  expect(await Quote.findById(repost.id)).toBeNull();
  expect(await QuoteComment.countDocuments({ quoteId: quote.id })).toBe(0);
  expect(await Quote.findById(keep.id)).not.toBeNull();
});
test('the full GraphQL quote query serializes book, chapter and author references', async () => {
  const response = await run('query($id:ID!){getQuoteById(id:$id){id text visibility user{id username} book{id title} chapterId}}', { id: quote.id });
  expect(response.errors).toBeUndefined();
  expect(response.data.getQuoteById).toMatchObject({ id: quote.id, visibility: 'PUBLIC', user: { id: author.id }, book: { id: book.id }, chapterId: chapter.id });
});
