import { jest } from '@jest/globals';
import { graphql, parse, subscribe } from 'graphql';
import mongoose from 'mongoose';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Message from '../src/models/message.js';
import Conversation from '../src/models/conversation.js';
import { pubsub } from '../src/config/pubsub.js';
import * as service from '../src/services/messageService.js';

jest.setTimeout(30000);
let sender, recipient, outsider, conversation;
beforeAll(connect);
afterAll(closeDatabase);
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [sender, recipient, outsider] = await User.create(['sender', 'recipient', 'outsider'].map(username => ({ username, fullName: username, email: `${username}@test.com`, password: 'hash' })));
  conversation = await service.getOrCreateConversation(sender.id, recipient.id);
});
const run = (source, variableValues = {}, user = sender) => graphql({ schema, source, variableValues, contextValue: { user, User, Book } });
const send = (content = 'Hello') => service.sendMessage(sender.id, { conversationId: conversation.id, content });

test('a direct conversation is reused in both directions and scoped to its participants', async () => {
  expect((await service.getOrCreateConversation(recipient.id, sender.id)).id).toBe(conversation.id);
  expect(await Conversation.countDocuments()).toBe(1);
  expect(await service.getUserConversations(outsider.id)).toEqual([]);
  const result = await run('{getConversations{id participants{id username} unreadCount updatedAt}}');
  expect(result.errors).toBeUndefined();
  expect(result.data.getConversations[0]).toMatchObject({ id: conversation.id, unreadCount: 0 });
  expect(result.data.getConversations[0].participants.map(p => p.username).sort()).toEqual(['recipient', 'sender']);
  await expect(service.getOrCreateConversation(sender.id, sender.id)).rejects.toThrow();
});

test.each(['none', 'followers'])('recipient message permission %s is enforced before writing', async permission => {
  await User.updateOne({ _id: recipient.id }, { 'privacySettings.allowMessages': permission });
  await expect(service.getOrCreateConversation(sender.id, recipient.id)).rejects.toThrow();
  await expect(send()).rejects.toThrow();
  expect(await Message.countDocuments()).toBe(0);
  if (permission === 'followers') {
    await User.updateOne({ _id: recipient.id }, { $addToSet: { followers: sender.id } });
    expect((await send()).content).toBe('Hello');
  }
});

test.each([{ isActive: false }, { isDeleted: true }])('inactive recipients cannot receive messages: %j', async flags => {
  await User.updateOne({ _id: recipient.id }, flags);
  await expect(send()).rejects.toThrow();
  expect(await Message.countDocuments()).toBe(0);
});

test('sending updates last message and only recipient unread count and publishes the message', async () => {
  const publish = jest.spyOn(pubsub, 'publish');
  const sent = await send('First');
  await send('Second');
  const saved = await Conversation.findById(conversation.id);
  expect(saved.lastMessage.toString()).not.toBe(sent.id);
  expect(await service.getUnreadMessageCount(sender.id)).toBe(0);
  expect(await service.getUnreadMessageCount(recipient.id)).toBe(2);
  expect(publish).toHaveBeenCalledWith('NEW_MESSAGE', expect.objectContaining({ conversationId: conversation.id }));
  const result = await run('query($id:ID!){getConversation(conversationId:$id){lastMessage{content sender{id username}} unreadCount}}', { id: conversation.id }, recipient);
  expect(result.errors).toBeUndefined();
  expect(result.data.getConversation).toMatchObject({ unreadCount: 2, lastMessage: { content: 'Second', sender: { id: sender.id } } });
  expect((await run('mutation($id:ID!){markMessagesAsRead(conversationId:$id)}', { id: conversation.id }, recipient)).data.markMessagesAsRead).toBe(true);
  expect(await service.getUnreadMessageCount(recipient.id)).toBe(0);
});

test('outsiders cannot read, send, or clear another conversation', async () => {
  await send();
  for (const query of [
    'query($id:ID!){getConversation(conversationId:$id){id}}',
    'query($id:ID!){getMessages(conversationId:$id){id content}}',
    'mutation($id:ID!){markMessagesAsRead(conversationId:$id)}',
  ]) expect((await run(query, { id: conversation.id }, outsider)).errors).toBeDefined();
  await expect(service.sendMessage(outsider.id, { conversationId: conversation.id, content: 'Intrusion' })).rejects.toThrow();
  expect(await Message.countDocuments()).toBe(1);
  expect(await service.getUnreadMessageCount(recipient.id)).toBe(1);
});

test('messages paginate newest first and soft deleted messages disappear from reads and search', async () => {
  const records = await Message.create(['First', 'Second', 'Third'].map((content, i) => ({ conversationId: conversation.id, senderId: sender.id, content, createdAt: new Date(2026, 0, i + 1) })));
  const page = await service.getConversationMessages(conversation.id, 1, 1, recipient.id);
  expect(page.map(m => m.content)).toEqual(['Second']);
  await service.deleteMessage(records[1].id, sender.id);
  expect((await Message.findById(records[1].id)).deletedAt).toBeInstanceOf(Date);
  expect((await service.getConversationMessages(conversation.id, 20, 0, sender.id)).map(m => m.content)).toEqual(['Third', 'First']);
  expect(await service.searchMessages(conversation.id, 'second')).toEqual([]);
  expect((await service.searchMessages(conversation.id, 'FIRST'))[0].id).toBe(records[0].id);
});

test('only the sender edits or deletes a message and non-text messages cannot be edited', async () => {
  const message = await send();
  for (const user of [recipient, outsider]) {
    await expect(service.editMessage(message.id, user.id, 'Tampered')).rejects.toThrow();
    await expect(service.deleteMessage(message.id, user.id)).rejects.toThrow();
  }
  const result = await run('mutation($id:ID!){editMessage(messageId:$id,content:"Edited"){id content}}', { id: message.id });
  expect(result.errors).toBeUndefined();
  expect(result.data.editMessage.content).toBe('Edited');
  const attachment = await Message.create({ conversationId: conversation.id, senderId: sender.id, type: 'BOOK' });
  await expect(service.editMessage(attachment.id, sender.id, 'Edited')).rejects.toThrow();
  expect((await run('mutation($id:ID!){deleteMessage(messageId:$id)}', { id: message.id })).data.deleteMessage).toBe(true);
});

test('unknown conversations and messages fail without creating data', async () => {
  const missing = new mongoose.Types.ObjectId().toString();
  await expect(service.sendMessage(sender.id, { conversationId: missing, content: 'Hello' })).rejects.toThrow();
  await expect(service.editMessage(missing, sender.id, 'Hello')).rejects.toThrow();
  await expect(service.deleteMessage(missing, sender.id)).rejects.toThrow();
  await expect(service.sendMessage(sender.id, { conversationId: conversation.id, type: 'QUOTE' })).rejects.toThrow();
  expect(await Message.countDocuments()).toBe(0);
});

test('live message subscriptions reject guests and outsiders before creating an iterator', async () => {
  const document = parse('subscription($id:ID!){onNewMessage(conversationId:$id){id content}}');
  for (const user of [null, outsider]) {
    const result = await subscribe({ schema, document, variableValues: { id: conversation.id }, contextValue: { user, User, Book } });
    expect(result.errors).toBeDefined();
  }
});

test('authorized live delivery preserves the message sender and content', async () => {
  const book = await Book.create({ title: 'Shared book', authorId: sender.id, status: 'WRITING' });
  const iterator = await subscribe({ schema, document: parse('subscription($id:ID!){onNewMessage(conversationId:$id){id content sender{id username} attachedBook{id title}}}'), variableValues: { id: conversation.id }, contextValue: { user: recipient, User, Book } });
  expect(iterator.errors).toBeUndefined();
  try {
    const pending = iterator.next();
    const sent = await service.sendMessage(sender.id, { conversationId: conversation.id, type: 'BOOK', attachedBookId: book.id, content: 'Live message' });
    const { value } = await pending;
    expect(value.errors).toBeUndefined();
    expect(value.data.onNewMessage).toMatchObject({ id: sent.id, content: 'Live message', sender: { id: sender.id, username: 'sender' }, attachedBook: { id: book.id, title: 'Shared book' } });
  } finally { await iterator.return(); }
});

test.each([
  '{getConversations{id}}', '{getUnreadMessageCount}',
  'query($id:ID!){getMessages(conversationId:$id){id}}',
  'query($id:ID!){getConversation(conversationId:$id){id}}',
  'query($id:ID!){getOrCreateConversation(recipientId:$id){id}}',
  'mutation($id:ID!){markMessagesAsRead(conversationId:$id)}',
  'mutation($id:ID!){deleteMessage(messageId:$id)}',
  'mutation($id:ID!){editMessage(messageId:$id,content:"x"){id}}',
  'mutation($id:ID!){sendMessage(input:{conversationId:$id,type:TEXT,content:"x"}){id}}',
])('anonymous message operation is rejected: %s', async source => {
  expect((await run(source, { id: conversation.id }, null)).errors).toBeDefined();
  expect(await Message.countDocuments()).toBe(0);
});
