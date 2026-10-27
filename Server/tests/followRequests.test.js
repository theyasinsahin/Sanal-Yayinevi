import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import { connect, clearDatabase, closeDatabase } from './db.js';
import schema from '../src/graphql/schema.js';
import models from '../src/models/index.js';
import User from '../src/models/user.js';
import FollowRequest from '../src/models/followRequest.js';
import Notification from '../src/models/notification.js';
import * as follows from '../src/services/followService.js';
import * as scores from '../src/services/scoreService.js';
import * as sessions from '../src/services/sessionService.js';
import * as messages from '../src/services/messageService.js';

jest.setTimeout(30000);
beforeAll(async () => { await connect(); await Promise.all([FollowRequest.init(), Notification.init(), User.init()]); });
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
afterAll(closeDatabase);
const user = (username, extra = {}) => User.create({ username, fullName: username, email: `${username}@example.test`, password: 'hash', ...extra });
const run = (source, variables, viewer) => graphql({ schema, source, variableValues: variables, contextValue: { ...models, user: viewer } });
const relationships = async (sender, recipient) => ({
  outgoing: (await User.findById(sender._id)).following.map(String),
  incoming: (await User.findById(recipient._id)).followers.map(String),
});

test('an approval request notifies the recipient without establishing a follow, even with optional notifications disabled', async () => {
  const sender = await user('sender');
  const recipient = await user('recipient', { notificationSettings: { newFollower: false } });
  const response = await run('mutation($id: ID!) { requestFollowUser(targetId: $id) { followStatus request { id status requester { id username } } } }', { id: String(recipient._id) }, sender);
  expect(response.errors).toBeUndefined();
  expect(response.data.requestFollowUser).toMatchObject({ followStatus: 'PENDING', request: { status: 'PENDING', requester: { username: 'sender' } } });
  expect(await relationships(sender, recipient)).toEqual({ incoming: [], outgoing: [] });
  expect(await Notification.countDocuments({ userId: recipient._id, type: 'FOLLOW_REQUEST' })).toBe(1);
  expect(await scores.getUnreadCount(recipient._id)).toBe(1);
  await scores.markNotificationsRead(recipient._id);
  expect(await scores.getUnreadCount(recipient._id)).toBe(1); // unresolved approvals must remain discoverable
  const inbox = await run('{ getIncomingFollowRequests { total items { id status requester { username } } } }', {}, recipient);
  expect(inbox.errors).toBeUndefined();
  expect(inbox.data.getIncomingFollowRequests).toMatchObject({ total: 1, items: [{ requester: { username: 'sender' } }] });
  expect((await run('{ getIncomingFollowRequests { total } }', {}, sender)).data.getIncomingFollowRequests.total).toBe(0);
});

test('only the recipient can approve; pending requests grant neither private-profile nor follower-only access', async () => {
  const sender = await user('sender');
  const outsider = await user('outsider');
  const recipient = await user('recipient', { sessionCreationAccess: { status: 'APPROVED' }, privacySettings: { isProfilePublic: false, isFollowListPublic: false, allowMessages: 'followers' } });
  const session = await sessions.createSession(recipient._id, { title: 'Takipçilere özel', type: 'FOLLOWERS_ONLY' });
  const request = await follows.requestFollow(sender._id, recipient._id);
  const query = 'query($id: ID!) { getUserById(id: $id) { followStatus canViewProfile canMessage followers { id } } }';
  expect((await run(query, { id: String(recipient._id) }, sender)).data.getUserById).toMatchObject({ followStatus: 'PENDING', canViewProfile: false, canMessage: false });
  await expect(sessions.getSessionById(session._id, sender._id)).rejects.toThrow('takipçiler');
  await expect(messages.getOrCreateConversation(sender._id, recipient._id)).rejects.toThrow('sınırlandırmış');
  await expect(follows.respondToFollowRequest(outsider._id, request.request._id, true)).rejects.toThrow('yetkiniz');
  await expect(follows.respondToFollowRequest(sender._id, request.request._id, true)).rejects.toThrow('yetkiniz');
  const accepted = await run('mutation($id: ID!) { respondToFollowRequest(requestId: $id, accept: true) { followStatus request { status } } }', { id: String(request.request._id) }, recipient);
  expect(accepted.errors).toBeUndefined();
  expect(accepted.data.respondToFollowRequest).toMatchObject({ followStatus: 'FOLLOWING', request: { status: 'ACCEPTED' } });
  expect(await relationships(sender, recipient)).toEqual({ outgoing: [String(recipient._id)], incoming: [String(sender._id)] });
  expect((await run(query, { id: String(recipient._id) }, sender)).data.getUserById).toMatchObject({ followStatus: 'FOLLOWING', canViewProfile: true, canMessage: true, followers: [] });
  expect(await sessions.getSessionById(session._id, sender._id)).not.toBeNull();
  expect(await messages.getOrCreateConversation(sender._id, recipient._id)).not.toBeNull();
});

test('acceptance is idempotent and creates one relationship and one acceptance notification', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  await Promise.all(Array.from({ length: 3 }, () => follows.respondToFollowRequest(recipient._id, request._id, true)));
  expect(await relationships(sender, recipient)).toEqual({ outgoing: [String(recipient._id)], incoming: [String(sender._id)] });
  expect(await Notification.countDocuments({ userId: sender._id, type: 'FOLLOW_REQUEST_ACCEPTED' })).toBe(1);
  expect(await Notification.countDocuments({ userId: recipient._id, type: 'NEW_FOLLOWER' })).toBe(1);
  expect(await follows.pendingFollowRequestCount(recipient._id)).toBe(0);
});

test('duplicate concurrent requests produce only one pending request and one approval notification', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const results = await Promise.all(Array.from({ length: 5 }, () => follows.requestFollow(sender._id, recipient._id)));
  expect(new Set(results.map(item => String(item.request._id))).size).toBe(1);
  expect(await FollowRequest.countDocuments({ status: 'PENDING' })).toBe(1);
  expect(await Notification.countDocuments({ type: 'FOLLOW_REQUEST' })).toBe(1);
});

test.each(['reject', 'cancel'])('%s leaves the follow lists unchanged and permits a fresh request', async action => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const first = await follows.requestFollow(sender._id, recipient._id);
  if (action === 'reject') await follows.respondToFollowRequest(recipient._id, first.request._id, false);
  else await follows.cancelFollowRequest(sender._id, recipient._id);
  expect(await relationships(sender, recipient)).toEqual({ incoming: [], outgoing: [] });
  expect(await follows.getFollowStatus(sender._id, recipient._id)).toBe('NOT_FOLLOWING');
  expect(await scores.getUnreadCount(recipient._id)).toBe(0);
  const second = await follows.requestFollow(sender._id, recipient._id);
  expect(String(second.request._id)).not.toBe(String(first.request._id));
  await expect(follows.respondToFollowRequest(recipient._id, first.request._id, true)).rejects.toThrow('artık');
  expect(await follows.pendingFollowRequestCount(recipient._id)).toBe(1);
});

test('racing acceptance and cancellation cannot leave a half-follow or approve a cancelled request', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  await Promise.allSettled([
    follows.respondToFollowRequest(recipient._id, request._id, true),
    follows.cancelFollowRequest(sender._id, recipient._id),
  ]);
  const current = await FollowRequest.findById(request._id);
  expect(['ACCEPTED', 'CANCELLED']).toContain(current.status);
  expect(await relationships(sender, recipient)).toEqual(current.status === 'ACCEPTED'
    ? { outgoing: [String(recipient._id)], incoming: [String(sender._id)] } : { incoming: [], outgoing: [] });
});

test('unfollowing is idempotent; replaying an earlier acceptance does not restore a removed follow', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  await follows.respondToFollowRequest(recipient._id, request._id, true);
  await follows.unfollowUser(sender._id, recipient._id);
  await follows.unfollowUser(sender._id, recipient._id);
  expect((await follows.respondToFollowRequest(recipient._id, request._id, true)).followStatus).toBe('NOT_FOLLOWING');
  expect(await relationships(sender, recipient)).toEqual({ incoming: [], outgoing: [] });
  expect((await follows.requestFollow(sender._id, recipient._id)).followStatus).toBe('PENDING');
});

test('notification failure rolls back request creation and acceptance rather than leaving partial writes', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  const failure = jest.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('notification unavailable'));
  await expect(follows.requestFollow(sender._id, recipient._id)).rejects.toThrow('unavailable');
  expect(await FollowRequest.countDocuments({})).toBe(0);
  failure.mockRestore();
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  const acceptanceFailure = jest.spyOn(Notification, 'create').mockRejectedValueOnce(new Error('notification unavailable'));
  await expect(follows.respondToFollowRequest(recipient._id, request._id, true)).rejects.toThrow('unavailable');
  expect((await FollowRequest.findById(request._id)).status).toBe('PENDING');
  expect(await relationships(sender, recipient)).toEqual({ incoming: [], outgoing: [] });
  acceptanceFailure.mockRestore();
  await follows.respondToFollowRequest(recipient._id, request._id, true);
  expect(await follows.getFollowStatus(sender._id, recipient._id)).toBe('FOLLOWING');
});

test('optional new-follower preference does not suppress required approval or acceptance notices', async () => {
  const sender = await user('sender', { notificationSettings: { newFollower: false } });
  const recipient = await user('recipient', { notificationSettings: { newFollower: false } });
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  await follows.respondToFollowRequest(recipient._id, request._id, true);
  expect(await Notification.countDocuments({ userId: recipient._id, type: 'FOLLOW_REQUEST' })).toBe(1);
  expect(await Notification.countDocuments({ userId: recipient._id, type: 'NEW_FOLLOWER' })).toBe(0);
  expect(await Notification.countDocuments({ userId: sender._id, type: 'FOLLOW_REQUEST_ACCEPTED' })).toBe(1);
});

test('all pending requests are paginated independently from the 20-item informational notification history', async () => {
  const recipient = await user('recipient');
  const senders = await User.create(Array.from({ length: 23 }, (_, index) => ({ username: `user${index}`, fullName: 'User', email: `u${index}@example.test`, password: 'hash' })));
  await FollowRequest.insertMany(senders.map(sender => ({ requesterId: sender._id, recipientId: recipient._id })));
  const first = await follows.getIncomingFollowRequests(recipient._id);
  const second = await follows.getIncomingFollowRequests(recipient._id, 20, 20);
  expect(first).toMatchObject({ total: 23 }); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(3);
  expect(new Set([...first.items, ...second.items].map(item => String(item._id))).size).toBe(23);
  expect(await scores.getUnreadCount(recipient._id)).toBe(23);
});

test('inactive/deleted users and self-requests are blocked; existing accepted follows are retained', async () => {
  const sender = await user('sender'); const recipient = await user('recipient');
  await expect(follows.requestFollow(sender._id, sender._id)).rejects.toThrow('Kendinize');
  const { request } = await follows.requestFollow(sender._id, recipient._id);
  sender.isActive = false; await sender.save();
  expect(await follows.pendingFollowRequestCount(recipient._id)).toBe(0);
  await expect(follows.respondToFollowRequest(recipient._id, request._id, true)).rejects.toThrow('bulunamadı');
  sender.isActive = true; await sender.save();
  await follows.cancelFollowRequest(sender._id, recipient._id);
  await User.updateOne({ _id: sender._id }, { $addToSet: { following: recipient._id } });
  await User.updateOne({ _id: recipient._id }, { $addToSet: { followers: sender._id } });
  expect(await follows.requestFollow(sender._id, recipient._id)).toMatchObject({ followStatus: 'FOLLOWING', request: null });
});

test('anonymous callers cannot send, cancel, answer or list follow requests', async () => {
  const recipient = await user('recipient');
  for (const source of [
    '{ getIncomingFollowRequests { total } }',
    `mutation { requestFollowUser(targetId: "${recipient._id}") { code } }`,
    `mutation { cancelFollowRequest(targetId: "${recipient._id}") { code } }`,
    `mutation { unfollowUser(targetId: "${recipient._id}") { code } }`,
    `mutation { removeFollower(followerId: "${recipient._id}") { code } }`,
    `mutation { respondToFollowRequest(requestId: "${recipient._id}", accept: true) { code } }`,
  ]) expect((await run(source, {})).errors[0].message).toContain('Giriş');
});

test('a profile owner can remove a follower and revoke private-profile, messaging and session access', async () => {
  const follower = await user('follower');
  const owner = await user('owner', { sessionCreationAccess: { status: 'APPROVED' }, privacySettings: { isProfilePublic: false, allowMessages: 'followers' } });
  const { request } = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, request._id, true);
  const conversation = await messages.getOrCreateConversation(follower._id, owner._id);
  const session = await sessions.createSession(owner._id, { title: 'Özel oturum', type: 'FOLLOWERS_ONLY' });
  expect(await sessions.getSessionById(session._id, follower._id)).not.toBeNull();
  const response = await run('mutation($id: ID!) { removeFollower(followerId: $id) { code followStatus } }', { id: String(follower._id) }, owner);
  expect(response.errors).toBeUndefined();
  expect(response.data.removeFollower).toMatchObject({ code: 200, followStatus: 'NOT_FOLLOWING' });
  expect(await relationships(follower, owner)).toEqual({ outgoing: [], incoming: [] });
  const profile = await run('query($id: ID!) { getUserById(id: $id) { followStatus canViewProfile canMessage } }', { id: String(owner._id) }, follower);
  expect(profile.data.getUserById).toMatchObject({ followStatus: 'NOT_FOLLOWING', canViewProfile: false, canMessage: false });
  await expect(sessions.getSessionById(session._id, follower._id)).rejects.toThrow('takipçiler');
  await expect(messages.sendMessage(follower._id, { conversationId: conversation._id, content: 'Yeni mesaj' })).rejects.toThrow('sınırlandırmış');
  expect((await follows.requestFollow(follower._id, owner._id)).followStatus).toBe('PENDING');
});

test('removing a follower preserves the independent reverse follow relationship', async () => {
  const follower = await user('follower'); const owner = await user('owner');
  const incoming = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, incoming.request._id, true);
  const outgoing = await follows.requestFollow(owner._id, follower._id);
  await follows.respondToFollowRequest(follower._id, outgoing.request._id, true);
  await follows.removeFollower(owner._id, follower._id);
  expect(await relationships(follower, owner)).toEqual({ outgoing: [], incoming: [] });
  expect(await relationships(owner, follower)).toEqual({ outgoing: [String(follower._id)], incoming: [String(owner._id)] });
});

test('callers cannot specify another profile owner or remove a third party relationship', async () => {
  const follower = await user('follower'); const owner = await user('owner'); const outsider = await user('outsider');
  const { request } = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, request._id, true);
  const mutation = 'mutation($id: ID!) { removeFollower(followerId: $id) { code } }';
  expect((await run(mutation, { id: String(follower._id) }, outsider)).errors).toBeUndefined();
  const forged = await run(`mutation { removeFollower(followerId: "${follower._id}", ownerId: "${owner._id}") { code } }`, {}, outsider);
  expect(forged.errors).toBeDefined();
  expect(await relationships(follower, owner)).toEqual({ outgoing: [String(owner._id)], incoming: [String(follower._id)] });
});

test('concurrent removals are idempotent and stale approvals cannot restore the follower', async () => {
  const follower = await user('follower'); const owner = await user('owner');
  const { request } = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, request._id, true);
  // Simulate a pending request left by an old client alongside an existing follow.
  const stale = await FollowRequest.create({ requesterId: follower._id, recipientId: owner._id });
  await Promise.all([follows.removeFollower(owner._id, follower._id), follows.removeFollower(owner._id, follower._id)]);
  expect(await relationships(follower, owner)).toEqual({ outgoing: [], incoming: [] });
  expect((await FollowRequest.findById(stale._id)).status).toBe('CANCELLED');
  expect((await follows.respondToFollowRequest(owner._id, request._id, true)).followStatus).toBe('NOT_FOLLOWING');
  await expect(follows.respondToFollowRequest(owner._id, stale._id, true)).rejects.toThrow('artık');
});

test.each([{ isActive: false }, { isDeleted: true }])('inactive or deleted follower references can also be removed (%j)', async state => {
  const follower = await user('follower'); const owner = await user('owner');
  const { request } = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, request._id, true);
  await User.updateOne({ _id: follower._id }, state);
  await follows.removeFollower(owner._id, follower._id);
  expect(await relationships(follower, owner)).toEqual({ outgoing: [], incoming: [] });
});

test('a failed removal rolls back both relationship lists', async () => {
  const follower = await user('follower'); const owner = await user('owner');
  const { request } = await follows.requestFollow(follower._id, owner._id);
  await follows.respondToFollowRequest(owner._id, request._id, true);
  const originalUpdate = User.updateOne.bind(User);
  jest.spyOn(User, 'updateOne').mockImplementationOnce((...args) => originalUpdate(...args)).mockRejectedValueOnce(new Error('update unavailable'));
  await expect(follows.removeFollower(owner._id, follower._id)).rejects.toThrow('unavailable');
  expect(await relationships(follower, owner)).toEqual({ outgoing: [String(owner._id)], incoming: [String(follower._id)] });
});

test('self-removal is rejected', async () => {
  const owner = await user('owner');
  await expect(follows.removeFollower(owner._id, owner._id)).rejects.toThrow('Kendinizi');
});
