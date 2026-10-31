import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import mongoose from 'mongoose';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Session from '../src/models/session.js';
import SessionEntry from '../src/models/sessionEntry.js';
import Notification from '../src/models/notification.js';
import * as sessions from '../src/services/sessionService.js';

jest.setTimeout(30000);
let owner, reader, other, session;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
beforeEach(async () => {
  [owner, reader, other] = await User.create(['owner', 'reader', 'other'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash', sessionCreationAccess: { status: 'APPROVED' } })));
  session = await sessions.createSession(owner.id, { title: 'Reading room', type: 'OPEN' });
});
const add = (user = reader, content = 'Entry', room = session, code) => sessions.addSessionEntry(user.id, room.id, content, code);
const count = async () => (await Session.findById(session.id)).participantCount;

test('entries are trimmed and participant count counts distinct active contributors', async () => {
  const first = await add(reader, '  First  ');
  const second = await add(reader, 'Second');
  await add(other, 'Third');
  expect(first.content).toBe('First');
  expect(await count()).toBe(2);
  await sessions.deleteSessionEntry(first.id, reader.id);
  expect(await count()).toBe(2);
  await sessions.deleteSessionEntry(second.id, reader.id);
  expect(await count()).toBe(1);
  const deleted = await SessionEntry.findById(first.id);
  expect(deleted.isDeleted).toBe(true);
  expect(deleted.deletedAt).toBeInstanceOf(Date);
  await expect(sessions.deleteSessionEntry(first.id, reader.id)).rejects.toThrow();
  expect(await count()).toBe(1);
});
test('one author cannot delete another author entry and likes toggle independently', async () => {
  const entry = await add();
  await expect(sessions.deleteSessionEntry(entry.id, other.id)).rejects.toThrow();
  await sessions.toggleSessionEntryLike(entry.id, reader.id);
  await sessions.toggleSessionEntryLike(entry.id, other.id);
  const result = await sessions.toggleSessionEntryLike(entry.id, reader.id);
  expect(result.likedBy.map(String)).toEqual([other.id]);
  await sessions.deleteSessionEntry(entry.id, reader.id);
  await expect(sessions.toggleSessionEntryLike(entry.id, other.id)).rejects.toThrow();
});
test('entry pagination is chronological and excludes removed entries and inactive users', async () => {
  await SessionEntry.create([
    { sessionId: session.id, userId: reader.id, content: 'First', createdAt: new Date('2026-01-01') },
    { sessionId: session.id, userId: reader.id, content: 'Second', createdAt: new Date('2026-01-02') },
    { sessionId: session.id, userId: reader.id, content: 'Removed', isDeleted: true },
    { sessionId: session.id, userId: other.id, content: 'Inactive' },
  ]);
  await User.updateOne({ _id: other.id }, { isActive: false });
  expect((await sessions.getSessionEntries(session.id, 1, 1)).map(entry => entry.content)).toEqual(['Second']);
});
test('only the creator closes a session and closed sessions cannot accept new entries', async () => {
  await expect(sessions.closeSession(session.id, reader.id)).rejects.toThrow();
  expect(await sessions.closeSession(session.id, owner.id)).toBe(true);
  await expect(add()).rejects.toThrow();
  expect(await sessions.getSessions()).toEqual([]);
});
test('private sessions store a hash, validate access codes and reject missing or wrong codes on writes', async () => {
  const privateRoom = await sessions.createSession(owner.id, { title: 'Private room', type: 'PRIVATE', accessCode: ' secret ' });
  expect(privateRoom.accessCode).not.toContain('secret');
  expect(await sessions.verifySessionAccessCode(privateRoom.id, ' secret ')).toBe(true);
  expect(await sessions.verifySessionAccessCode(privateRoom.id, 'wrong')).toBe(false);
  await expect(add(reader, 'Missing code', privateRoom)).rejects.toThrow();
  await expect(add(reader, 'Wrong code', privateRoom, 'wrong')).rejects.toThrow();
  expect((await add(reader, 'Correct code', privateRoom, 'secret')).content).toBe('Correct code');
  await sessions.closeSession(privateRoom.id, owner.id);
  await expect(add(reader, 'After closing', privateRoom, 'secret')).rejects.toThrow();
});
test.each(['', 'abc'])('private session creation rejects short code %j without persisting a room', async accessCode => {
  await expect(sessions.createSession(owner.id, { title: 'Invalid', type: 'PRIVATE', accessCode })).rejects.toThrow();
  expect(await Session.countDocuments()).toBe(1);
});
test('followers-only reading and writing require actual creator membership, including guests', async () => {
  await Session.updateOne({ _id: session.id }, { type: 'FOLLOWERS_ONLY' });
  for (const id of [undefined, other.id]) {
    await expect(sessions.getSessionById(session.id, id)).rejects.toThrow();
    await expect(sessions.getSessionEntries(session.id, 30, 0, id)).rejects.toThrow();
  }
  await expect(add()).rejects.toThrow();
  await User.updateOne({ _id: owner.id }, { $addToSet: { followers: reader.id } });
  expect((await add()).content).toBe('Entry');
  expect((await sessions.getSessionById(session.id, owner.id)).id).toBe(session.id);
});
test('mentions are deduplicated, respect recipient preferences and do not notify the sender', async () => {
  await add(reader, 'Hello @owner @owner @reader @other');
  const first = await Notification.find({ type: { $in: ['SESSION_MENTION', 'SESSION_REPLY'] } }).lean();
  expect(first.map(n => String(n.userId)).sort()).toEqual([owner.id, other.id].sort());
  expect(first.every(n => n.type === 'SESSION_MENTION')).toBe(true);
  await User.updateOne({ _id: other.id }, { 'notificationSettings.mentionInSession': false });
  await Notification.deleteMany();
  await add(reader, 'Again @other');
  expect((await Notification.find({ type: { $in: ['SESSION_MENTION', 'SESSION_REPLY'] } })).map(n => String(n.userId))).toEqual([owner.id]);
});
test('mentions never give outside users access to follower-only sessions', async () => {
  await Session.updateOne({ _id: session.id }, { type: 'FOLLOWERS_ONLY' });
  await add(owner, 'Mention @other');
  expect(await Notification.countDocuments({ userId: other.id })).toBe(0);
});
test('account cascade archives only matching sessions and entries', async () => {
  const ownEntry = await add(owner), readerEntry = await add(reader);
  await sessions.softDeleteSessionEntriesByUserId(reader.id);
  expect((await SessionEntry.findById(readerEntry.id)).isDeleted).toBe(true);
  expect((await SessionEntry.findById(ownEntry.id)).isDeleted).toBe(false);
  await sessions.softDeleteSessionsByUserId(owner.id);
  expect((await Session.findById(session.id)).isActive).toBe(false);
  expect(await sessions.getSessionById(session.id)).toBeNull();
  await expect(add()).rejects.toThrow();
});
test('unknown IDs and anonymous lifecycle mutations fail', async () => {
  const missing = new mongoose.Types.ObjectId().toString();
  await expect(sessions.closeSession(missing, owner.id)).rejects.toThrow();
  await expect(sessions.verifySessionAccessCode(missing, 'code')).rejects.toThrow();
  for (const source of [
    'mutation($id:ID!){closeSession(sessionId:$id)}',
    'mutation($id:ID!){deleteSessionEntry(entryId:$id)}',
    'mutation($id:ID!){toggleSessionEntryLike(entryId:$id){id}}',
    'mutation($id:ID!){addSessionEntry(sessionId:$id,content:"x"){id}}',
  ]) expect((await graphql({ schema, source, variableValues: { id: session.id }, contextValue: {} })).errors).toBeDefined();
});
