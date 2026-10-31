import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import User from '../src/models/user.js';
import Quote from '../src/models/quote.js';
import ParagraphComment from '../src/models/paragraphComment.js';
import QuoteComment from '../src/models/quoteComment.js';
import Term from '../src/models/classificationTerm.js';
import { startReadingSession } from '../src/services/readingService.js';
import { saveReadingProgress } from '../src/services/readingProgressService.js';
import { markChapterAsRead } from '../src/services/recommendationService.js';
import { setBookmark } from '../src/services/bookmarkService.js';
import { createQuote, getQuotesFeed } from '../src/services/quoteService.js';
import { getSocialShare } from '../src/services/socialShareService.js';
import { getClassificationOptions } from '../src/services/classificationService.js';

let api, owner, reader, admin, book, visible, hidden;
const secret = 'PRIVATE CHAPTER WORDS never sent to readers';
beforeAll(async () => { await connect(); api = new ApolloServer({ schema }); await api.start(); });
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  [owner, reader, admin] = await User.create([
    { username: 'owner', fullName: 'Owner', email: 'owner@test.example', password: 'test' },
    { username: 'reader', fullName: 'Reader', email: 'reader@test.example', password: 'test' },
    { username: 'admin', fullName: 'Admin', email: 'admin@test.example', password: 'test', role: 'ADMIN' },
  ]);
  book = await Book.create({ title: 'Book', authorId: owner._id, status: 'WRITING', description: 'Book description' });
  [visible, hidden] = await Chapter.create([
    { bookId: book._id, authorId: owner._id, title: 'Open chapter', content: '<p>Visible words</p>', pageCount: 2 },
    { bookId: book._id, authorId: owner._id, title: 'Secret chapter', content: `<p>${secret}</p>`, pageCount: 7, isHidden: true },
  ]);
});
const run = async (query, variables, user = null) => (await api.executeOperation({ query, variables }, { contextValue: { user, Book, Chapter } })).body.singleResult;
const fields = 'id title content pageCount wordCount isHidden canReadContent';
const allEntries = `query($b:ID!,$h:ID!,$a:ID!){ book:getBookById(id:$b){chapters{${fields}}} one:getChapterById(id:$h){${fields}} list:getChaptersByBookId(bookId:$b){${fields}} author:getChaptersByAuthorId(authorId:$a){${fields}} all:getAllChapters{${fields}} reading:getReadingChapter(bookId:$b,chapterId:$h){${fields}} }`;

test.each(['guest', 'reader'])('%s sees chapter existence and length, with no content through any GraphQL entry point', async role => {
  const result = await run(allEntries, { b: book.id, h: hidden.id, a: owner.id }, role === 'guest' ? null : reader);
  expect(result.errors).toBeUndefined();
  expect(JSON.stringify(result.data)).not.toContain(secret);
  expect(result.data.one).toMatchObject({ title: 'Secret chapter', content: '', pageCount: 7, wordCount: 7, isHidden: true, canReadContent: false });
  expect(result.data.book.chapters.find(chapter => chapter.id === visible.id).content).toContain('Visible words');
});
test.each(['owner', 'admin'])('%s can read and edit the hidden chapter', async role => {
  const actor = role === 'owner' ? owner : admin;
  const result = await run(`query($id:ID!){getChapterById(id:$id){${fields}}}`, { id: hidden.id }, actor);
  expect(result.errors).toBeUndefined(); expect(result.data.getChapterById.content).toContain(secret);
  expect(result.data.getChapterById.canReadContent).toBe(true);
});
test('only the book owner or admin can hide/reveal a chapter and revealing restores public content', async () => {
  const mutation = 'mutation($id:ID!,$hidden:Boolean!){updateChapter(chapterId:$id,isHidden:$hidden){id isHidden content}}';
  for (const actor of [null, reader]) expect((await run(mutation, { id: hidden.id, hidden: false }, actor)).errors).toBeDefined();
  const changed = await run(mutation, { id: hidden.id, hidden: false }, owner);
  expect(changed.errors).toBeUndefined();
  const shown = await run(`query($id:ID!){getChapterById(id:$id){${fields}}}`, { id: hidden.id });
  expect(shown.data.getChapterById.content).toContain(secret);
});
test('a chapter can be private from its first creation', async () => {
  const result = await run('mutation($id:ID!){createChapter(bookId:$id,title:"Private from start",content:"New private words",isHidden:true){id isHidden content wordCount}}', { id: book.id }, owner);
  expect(result.errors).toBeUndefined();
  expect(result.data.createChapter).toMatchObject({ isHidden: true, wordCount: 3 });
  const readerResult = await run('query($id:ID!){getChapterById(id:$id){content isHidden}}', { id: result.data.createChapter.id });
  expect(readerResult.data.getChapterById).toMatchObject({ content: '', isHidden: true });
});
test('hidden chapters cannot earn reading points, be marked read or bookmarked by readers', async () => {
  await expect(startReadingSession(reader, book.id, hidden.id)).rejects.toThrow();
  await expect(markChapterAsRead(reader.id, book.id, hidden.id)).rejects.toThrow();
  await expect(setBookmark(reader.id, { bookId: book.id, chapterId: hidden.id, paragraphIndex: 0 })).rejects.toThrow();
  const progress = await saveReadingProgress(reader.id, { bookId: book.id, chapterId: hidden.id, completedChapterIds: [visible.id, hidden.id] });
  expect(progress.completedChapters.map(String)).toEqual([visible.id]); expect(progress.isCompleted).toBe(false);
});
test('paragraph comments, quotes, feeds and public shares cannot expose a hidden chapter', async () => {
  await ParagraphComment.create({ userId: reader._id, bookId: book._id, chapterId: hidden._id, paragraphIndex: 0, content: secret });
  const quote = await Quote.create({ userId: reader._id, bookId: book._id, chapterId: hidden._id, text: secret, normalizedText: 'secret' });
  const quoteComment = await QuoteComment.create({ userId: reader._id, quoteId: quote._id, content: secret });
  const result = await run('query($id:ID!,$book:ID!){getParagraphComments(chapterId:$id,paragraphIndex:0){content} getParagraphCommentCounts(chapterId:$id){count} getQuotesByBook(bookId:$book){text}}', { id: hidden.id, book: book.id });
  expect(result.errors).toBeUndefined(); expect(result.data.getParagraphComments).toEqual([]); expect(result.data.getQuotesByBook).toEqual([]);
  expect(await getQuotesFeed()).toEqual([]);
  await expect(createQuote(reader.id, { bookId: book.id, chapterId: hidden.id, text: 'Another secret quote' })).rejects.toThrow();
  await expect(getSocialShare('CHAPTER', hidden.id)).rejects.toThrow();
  const denied = await run('mutation($b:ID!,$c:ID!){addParagraphComment(bookId:$b,chapterId:$c,paragraphIndex:0,content:"Comment"){id}}', { b: book.id, c: hidden.id }, reader);
  expect(denied.errors).toBeDefined();
  const like = await run('mutation($id:ID!){toggleQuoteCommentLike(id:$id){content}}', { id: quoteComment.id }, reader);
  expect(like.errors).toBeUndefined(); expect(like.data.toggleQuoteCommentLike.content).toBe('');
});
test('legacy chapters remain public and the retired content warning is excluded even in an unmigrated database', async () => {
  await Chapter.collection.updateOne({ _id: visible._id }, { $unset: { isHidden: 1, wordCount: 1 } });
  const result = await run(`query($id:ID!){getChapterById(id:$id){${fields}}}`, { id: visible.id });
  expect(result.errors).toBeUndefined(); expect(result.data.getChapterById).toMatchObject({ isHidden: false, canReadContent: true, wordCount: 2 });
  await run('mutation($id:ID!){updateChapter(chapterId:$id,isHidden:true){id}}', { id: visible.id }, owner);
  const metadata = await run('query($id:ID!){getBookById(id:$id){chapters{id wordCount canReadContent}}}', { id: book.id });
  expect(metadata.data.getBookById.chapters.find(chapter => chapter.id === visible.id)).toMatchObject({ wordCount: 2, canReadContent: false });
  await Term.create({ kind: 'WARNING', slug: 'istismar', name: 'İstismar', isActive: true });
  expect((await getClassificationOptions()).contentWarnings).toEqual([]);
});
