import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import mongoose from 'mongoose';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import ParagraphComment from '../src/models/paragraphComment.js';
import * as comments from '../src/services/paragraphCommentService.js';

jest.setTimeout(30000);
let author, reader, other, book, chapter;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [author, reader, other] = await User.create(['author', 'reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash' })));
  book = await Book.create({ title: 'Book', authorId: author.id, status: 'WRITING' });
  chapter = await Chapter.create({ title: 'Chapter', bookId: book.id, authorId: author.id, content: '<p>Content</p>' });
});
const add = (user = reader, paragraphIndex = 0, content = 'Comment') => comments.addParagraphComment(user.id, { bookId: book.id, chapterId: chapter.id, paragraphIndex, content });
const run = (source, variables, user) => graphql({ schema, source, variableValues: variables, contextValue: { user } });

test('comments belong to their paragraph and return the public author through GraphQL', async () => {
  const result = await run('mutation($book:ID!,$chapter:ID!){addParagraphComment(bookId:$book,chapterId:$chapter,paragraphIndex:2,content:"Thought"){id content paragraphIndex user{id username}}}', { book: book.id, chapter: chapter.id }, reader);
  expect(result.errors).toBeUndefined();
  expect(result.data.addParagraphComment).toMatchObject({ content: 'Thought', paragraphIndex: 2, user: { id: reader.id, username: 'reader' } });
  expect(await comments.getParagraphComments(chapter.id, 0)).toEqual([]);
  expect((await comments.getParagraphComments(chapter.id, 2))[0].content).toBe('Thought');
});

test('counts group by paragraph and exclude deleted comments and inactive authors', async () => {
  const removed = await add(reader, 0);
  await ParagraphComment.updateOne({ _id: removed.id }, { isDeleted: true });
  await add(other, 0);
  await add(reader, 0);
  await add(reader, 2);
  await User.updateOne({ _id: other.id }, { isActive: false });
  expect((await comments.getParagraphCommentCounts(chapter.id)).sort((a, b) => a.paragraphIndex - b.paragraphIndex)).toEqual([{ paragraphIndex: 0, count: 1 }, { paragraphIndex: 2, count: 1 }]);
  expect(await comments.getParagraphComments(chapter.id, 0)).toHaveLength(1);
});

test('likes toggle per reader without removing other readers likes', async () => {
  const comment = await add();
  await comments.toggleParagraphCommentLike(comment.id, reader.id);
  await comments.toggleParagraphCommentLike(comment.id, other.id);
  const remaining = await comments.toggleParagraphCommentLike(comment.id, reader.id);
  expect(remaining.likedBy.map(String)).toEqual([other.id]);
});

test('only the author deletes a paragraph comment; missing IDs fail', async () => {
  const comment = await add();
  await expect(comments.deleteParagraphComment(comment.id, other.id)).rejects.toThrow();
  expect(await ParagraphComment.countDocuments()).toBe(1);
  expect((await comments.deleteParagraphComment(comment.id, reader.id)).code).toBe(200);
  expect(await ParagraphComment.countDocuments()).toBe(0);
  await expect(comments.deleteParagraphComment(comment.id, reader.id)).rejects.toThrow();
  await expect(comments.toggleParagraphCommentLike(comment.id, reader.id)).rejects.toThrow();
});

test('comments cannot be attached to a different book or unknown chapter', async () => {
  const otherBook = await Book.create({ title: 'Other', authorId: author.id, status: 'WRITING' });
  for (const input of [
    { bookId: otherBook.id, chapterId: chapter.id },
    { bookId: book.id, chapterId: new mongoose.Types.ObjectId().toString() },
  ]) await expect(comments.addParagraphComment(reader.id, { ...input, paragraphIndex: 0, content: 'Wrong book' })).rejects.toThrow();
  expect(await ParagraphComment.countDocuments()).toBe(0);
});

test('hidden chapters suppress comments/counts and block reader writes while the owner retains access', async () => {
  const comment = await add();
  await Chapter.updateOne({ _id: chapter.id }, { isHidden: true });
  expect(await comments.getParagraphComments(chapter.id, 0, reader)).toEqual([]);
  expect(await comments.getParagraphCommentCounts(chapter.id, reader)).toEqual([]);
  await expect(add()).rejects.toThrow();
  await expect(comments.toggleParagraphCommentLike(comment.id, reader.id)).rejects.toThrow();
  expect(await comments.getParagraphComments(chapter.id, 0, author)).toHaveLength(1);
  expect((await add(author)).content).toBe('Comment');
});

test.each([
  'mutation($id:ID!){deleteParagraphComment(id:$id){code}}',
  'mutation($id:ID!){toggleParagraphCommentLike(id:$id){id}}',
  'mutation($id:ID!){addParagraphComment(bookId:$id,chapterId:$id,paragraphIndex:0,content:"x"){id}}',
])('anonymous paragraph writes are rejected: %s', async source => {
  expect((await run(source, { id: chapter.id })).errors).toBeDefined();
  expect(await ParagraphComment.countDocuments()).toBe(0);
});
