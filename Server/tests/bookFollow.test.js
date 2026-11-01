import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import mongoose from 'mongoose';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Notification from '../src/models/notification.js';
import * as service from '../src/services/bookFollowService.js';

jest.setTimeout(30000);
let author, reader, other, book;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [author, reader, other] = await User.create(['author', 'reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash' })));
  book = await Book.create({ title: 'Followed Book', authorId: author.id, status: 'WRITING' });
});
const run = (source, user) => graphql({ schema, source, variableValues: { id: book.id }, contextValue: { user } });

test('follow toggles membership and returns the actual total number of followers', async () => {
  expect(await service.isFollowingBook(reader.id, book.id)).toBe(false);
  expect(await service.toggleBookFollow(reader.id, book.id)).toEqual({ isFollowing: true, followCount: 1 });
  expect(await service.toggleBookFollow(other.id, book.id)).toEqual({ isFollowing: true, followCount: 2 });
  expect(await service.isFollowingBook(reader.id, book.id)).toBe(true);
  expect(await service.toggleBookFollow(reader.id, book.id)).toEqual({ isFollowing: false, followCount: 1 });
  expect(await service.getFollowedBooks(reader.id)).toEqual([]);
});

test('followed books populate their author and are isolated per user', async () => {
  await service.toggleBookFollow(reader.id, book.id);
  const result = await run('{getFollowedBooks{id title author{id username}}}', reader);
  expect(result.errors).toBeUndefined();
  expect(result.data.getFollowedBooks).toEqual([{ id: book.id, title: 'Followed Book', author: { id: author.id, username: 'author' } }]);
  expect(await service.getFollowedBooks(other.id)).toEqual([]);
});

test('new chapter notifications reach only current followers and contain book navigation metadata', async () => {
  await service.notifyBookFollowers(book.id, 'Chapter zero', book.title);
  expect(await Notification.countDocuments()).toBe(0);
  await service.toggleBookFollow(reader.id, book.id);
  await service.toggleBookFollow(other.id, book.id);
  await service.toggleBookFollow(other.id, book.id);
  await service.notifyBookFollowers(book.id, 'Chapter one', book.title);
  const notifications = await Notification.find().lean();
  expect(notifications).toHaveLength(1);
  expect(String(notifications[0].userId)).toBe(reader.id);
  expect(notifications[0]).toMatchObject({ type: 'NEW_CHAPTER', meta: { chapterTitle: 'Chapter one' } });
  expect(String(notifications[0].meta.bookId)).toBe(book.id);
});

test('unknown users have no followed books and cannot change follow state', async () => {
  const id = new mongoose.Types.ObjectId().toString();
  expect(await service.isFollowingBook(id, book.id)).toBe(false);
  expect(await service.getFollowedBooks(id)).toEqual([]);
  await expect(service.toggleBookFollow(id, book.id)).rejects.toThrow();
});

test('anonymous users cannot mutate or list follows and receive false for the membership query', async () => {
  expect((await run('query($id:ID!){isFollowingBook(bookId:$id)}')).data.isFollowingBook).toBe(false);
  expect((await run('{getFollowedBooks{id}}')).errors).toBeDefined();
  expect((await run('mutation($id:ID!){toggleBookFollow(bookId:$id){isFollowing followCount}}')).errors).toBeDefined();
  expect((await User.findById(reader.id)).followedBooks).toHaveLength(0);
});
