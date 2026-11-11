import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Comment from '../src/models/comment.js';
import Quote from '../src/models/quote.js';
import SessionEntry from '../src/models/sessionEntry.js';
import Notification from '../src/models/notification.js';
import { mentionedUsernames, searchMentionUsers, MAX_MENTIONS } from '../src/services/mentionService.js';
import { createComment, createReply } from '../src/services/commentService.js';
import { addParagraphComment } from '../src/services/paragraphCommentService.js';
import { createQuote, addQuoteComment, repostQuote } from '../src/services/quoteService.js';
import { createSession, addSessionEntry } from '../src/services/sessionService.js';

jest.setTimeout(30000);
beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);
let actor, author, publicUser, follower, outsider, book, chapter;
beforeEach(async () => {
  [actor, author, publicUser, follower, outsider] = await User.create(['actor', 'author', 'public.user', 'follower', 'outsider'].map(username => ({
    username, fullName: username, email: `${username}@test.example`, password: 'hash', sessionCreationAccess: { status: 'APPROVED' },
  })));
  await User.updateMany({ _id: { $in: [follower.id, outsider.id] } }, { 'privacySettings.isProfilePublic': false });
  await User.updateOne({ _id: actor.id }, { followers: [follower.id] });
  book = await Book.create({ title: 'A book', authorId: author.id, status: 'WRITING', digitalStatus: 'PUBLISHED' });
  chapter = await Chapter.create({ title: 'Chapter', bookId: book.id, authorId: author.id, content: '<p>First</p><p>Second</p>' });
});
const run = (source, variables, user = actor) => graphql({ schema, source, variableValues: variables, contextValue: { user } });
const notices = () => Notification.find({ type: /MENTION$/ }).lean();

test('mention parsing handles unicode, case, repeats, punctuation, emails, URLs and bounded fanout', () => {
  expect(mentionedUsernames('(@Çağrı-yazar), @public.user @PUBLIC.USER @reader-test! a@author.com https://x/@outsider @@actor'))
    .toEqual(['Çağrı-yazar', 'public.user', 'PUBLIC.USER', 'reader-test']);
  expect(mentionedUsernames(null)).toEqual([]);
  expect(mentionedUsernames(`@${'x'.repeat(51)}`)).toEqual([]);
  expect(mentionedUsernames(Array.from({ length: 50 }, (_, i) => `@user${i}`).join(' '))).toHaveLength(MAX_MENTIONS);
});

test('authenticated suggestions include public accounts and the actors private followers, never private strangers or self', async () => {
  const result = await run('query{searchMentionUsers(query:""){id username fullName profilePicture}}');
  expect(result.errors).toBeUndefined();
  expect(result.data.searchMentionUsers.map(user => user.username).sort()).toEqual(['author', 'follower', 'public.user']);
  expect((await searchMentionUsers(actor.id, 'PUBLIC.')).map(user => user.username)).toEqual(['public.user']);
  expect(await searchMentionUsers(actor.id, '.*')).toEqual([]);
  expect((await run('query{searchMentionUsers(query:""){id}}', {}, null)).errors).toBeDefined();
});

test('suggestions exclude inactive/deleted users and return at most eight minimal identities', async () => {
  await User.updateOne({ _id: publicUser.id }, { isActive: false });
  await User.updateOne({ _id: author.id }, { isDeleted: true });
  expect((await searchMentionUsers(actor.id)).map(user => user.id)).toEqual([follower.id]);
  await User.create(Array.from({ length: 12 }, (_, i) => ({ username: `new${i}`, fullName: 'New reader', email: `new${i}@test.example`, password: 'hash' })));
  const results = await searchMentionUsers(actor.id, 'new');
  expect(results).toHaveLength(8);
  expect(Object.keys(results[0]).sort()).toEqual(['fullName', 'id', 'profilePicture', 'username']);
});

test('manual mentions enforce the same account policy, deduplicate and carry the exact book comment target', async () => {
  const comment = await createComment({ userId: actor.id, bookId: book.id, content: '@PUBLIC.USER @public.user @follower @outsider @actor' });
  const result = await notices();
  expect(result.map(item => String(item.userId)).sort()).toEqual([publicUser.id, follower.id].sort());
  expect(result.every(item => item.type === 'COMMENT_MENTION' && item.meta.commentId === comment.id && item.meta.bookId === book.id)).toBe(true);
});

test('selected Turkish usernames keep their exact spelling when resolving a notification', async () => {
  const recipient = await User.create({ username: 'İpek.yazar', fullName: 'İpek', email: 'ipek@test.example', password: 'hash' });
  await createComment({ userId: actor.id, bookId: book.id, content: 'Merhaba @İpek.yazar' });
  expect((await notices()).map(item => String(item.userId))).toEqual([recipient.id]);
});

test('a valid username ending in punctuation resolves before the sentence punctuation fallback', async () => {
  const recipient = await User.create({ username: 'public.user.', fullName: 'Another reader', email: 'another@test.example', password: 'hash' });
  await createComment({ userId: actor.id, bookId: book.id, content: '@public.user. ' });
  expect((await notices()).map(item => String(item.userId))).toEqual([recipient.id]);
});

test('case-sensitive usernames resolve to the selected account instead of another account with similar spelling', async () => {
  const recipient = await User.create({ username: 'Public.User', fullName: 'Other reader', email: 'case@test.example', password: 'hash' });
  await createComment({ userId: actor.id, bookId: book.id, content: '@Public.User @public.user' });
  expect((await notices()).map(item => String(item.userId)).sort()).toEqual([recipient.id, publicUser.id].sort());
});

test('book author receives a single mention instead of two notifications and comment mention preferences are respected', async () => {
  await createComment({ userId: actor.id, bookId: book.id, content: '@author' });
  expect(await Notification.countDocuments({ userId: author.id })).toBe(1);
  await User.updateOne({ _id: publicUser.id }, { 'notificationSettings.mentionInComment': false });
  await createComment({ userId: actor.id, bookId: book.id, content: '@public.user' });
  expect(await Notification.countDocuments({ userId: publicUser.id })).toBe(0);
});

test('both root and nested book replies notify eligible tagged users with the reply id', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  const reply = await createReply(actor, book.id, '@public.user', root.id);
  const nested = await createReply(actor, book.id, '@follower', reply.id);
  const result = await notices();
  expect(result.find(item => String(item.userId) === publicUser.id).meta.commentId).toBe(reply.id);
  expect(result.find(item => String(item.userId) === follower.id).meta.commentId).toBe(nested.id);
});

test('root and nested replies automatically mention the actual target and notify it once', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  await Notification.deleteMany();
  const reply = await createReply(actor, book.id, 'Ana yoruma yanıt', root.id);
  expect(reply.content).toBe('@author Ana yoruma yanıt');
  expect(reply.parentId.toString()).toBe(root.id);
  expect(await Notification.countDocuments({ userId: author.id, type: 'COMMENT_MENTION', 'meta.commentId': reply.id })).toBe(1);
  const nested = await createReply(publicUser, book.id, 'Alt yoruma yanıt', reply.id);
  expect(nested.content).toBe('@actor Alt yoruma yanıt');
  expect(nested.parentId.toString()).toBe(root.id);
  expect(await Notification.countDocuments({ userId: actor.id, type: 'COMMENT_MENTION', 'meta.commentId': nested.id })).toBe(1);
  expect(await Notification.countDocuments({ userId: author.id, 'meta.commentId': nested.id })).toBe(0);
});

test('existing target mentions are not duplicated in root or nested replies and other tags are preserved', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  const reply = await createReply(actor, book.id, '@author Merhaba @public.user', root.id);
  expect(reply.content).toBe('@author Merhaba @public.user');
  const nested = await createReply(publicUser, book.id, 'Katılıyorum @actor', reply.id);
  expect(nested.content).toBe('Katılıyorum @actor');
  const otherTag = await createReply(actor, book.id, '@follower Merhaba', root.id);
  expect(otherTag.content).toBe('@author @follower Merhaba');
});

test('automatic reply mentions respect notification preferences and do not notify the sender', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  await Notification.deleteMany();
  await User.updateOne({ _id: author.id }, { 'notificationSettings.mentionInComment': false });
  const reply = await createReply(actor, book.id, 'Tercihler korunur', root.id);
  expect(reply.content).toBe('@author Tercihler korunur');
  expect(await notices()).toEqual([]);
  await createReply(actor, book.id, 'Kendi yanıtıma devam', reply.id);
  expect(await notices()).toEqual([]);
});

test('blank replies and mention-only replies are rejected before saving', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  await expect(createReply(actor, book.id, '   ', root.id)).rejects.toThrow('Yanıt metni boş olamaz.');
  await expect(createReply(actor, book.id, ' @author ', root.id)).rejects.toThrow('Yanıt metni boş olamaz.');
  expect(await Comment.countDocuments({ parentId: root.id })).toBe(0);
});

test('replying to an unavailable author never stores an undefined or stale mention', async () => {
  const root = await createComment({ userId: author.id, bookId: book.id, content: 'Root' });
  await User.updateOne({ _id: author.id }, { isActive: false });
  expect((await createReply(actor, book.id, 'Yanıt', root.id)).content).toBe('Yanıt');
  await User.deleteOne({ _id: author.id });
  expect((await createReply(actor, book.id, 'Başka yanıt', root.id)).content).toBe('Başka yanıt');
});

test('paragraph mentions point to the chapter, paragraph and comment, and hidden chapters do not leak notices', async () => {
  const comment = await addParagraphComment(actor.id, { bookId: book.id, chapterId: chapter.id, paragraphIndex: 1, content: '@public.user' });
  expect((await notices())[0].meta).toMatchObject({ bookId: book.id, chapterId: chapter.id, paragraphIndex: 1, commentId: comment.id });
  await Notification.deleteMany();
  await Chapter.updateOne({ _id: chapter.id }, { isHidden: true });
  await addParagraphComment(author.id, { bookId: book.id, chapterId: chapter.id, paragraphIndex: 0, content: '@public.user' });
  expect(await notices()).toEqual([]);
});

test('quote notes, comments and repost notes produce exact targets; private notes produce no mention notifications', async () => {
  const quote = await createQuote(actor.id, { bookId: book.id, chapterId: chapter.id, text: 'A passage worth remembering', note: '@public.user', visibility: 'PUBLIC' });
  expect((await notices())[0].meta.quoteId).toBe(quote.id);
  await Notification.deleteMany();
  const comment = await addQuoteComment(actor.id, quote.id, '@follower');
  expect((await notices())[0].meta).toMatchObject({ quoteId: quote.id, commentId: comment.id });
  await Notification.deleteMany();
  const repost = await repostQuote(author.id, quote.id, '@public.user');
  expect((await notices())[0].meta.quoteId).toBe(repost.id);
  await Notification.deleteMany();
  await createQuote(actor.id, { bookId: book.id, chapterId: chapter.id, text: 'Private passage to keep', note: '@public.user', visibility: 'PRIVATE' });
  expect(await notices()).toEqual([]);
});

test('session descriptions and entries notify with precise targets without duplicate reply notices', async () => {
  const room = await createSession(actor.id, { title: 'Room', type: 'OPEN', description: '@follower' });
  expect((await notices())[0].meta).toMatchObject({ sessionId: room.id });
  await Notification.deleteMany();
  const entry = await addSessionEntry(author.id, room.id, '@actor @public.user @outsider');
  const result = await notices();
  expect(result.map(item => String(item.userId)).sort()).toEqual([actor.id, publicUser.id].sort());
  expect(result.every(item => item.meta.entryId === entry.id)).toBe(true);
  expect(await Notification.countDocuments({ userId: actor.id, type: 'SESSION_REPLY' })).toBe(0);
});

test('followers-only and private sessions do not notify outsiders even if their accounts are public', async () => {
  const followersRoom = await createSession(actor.id, { title: 'Followers', type: 'FOLLOWERS_ONLY' });
  await addSessionEntry(actor.id, followersRoom.id, '@follower @public.user');
  expect((await notices()).map(item => String(item.userId))).toEqual([follower.id]);
  await Notification.deleteMany();
  const privateRoom = await createSession(actor.id, { title: 'Private', type: 'PRIVATE', accessCode: 'secret' });
  await addSessionEntry(actor.id, privateRoom.id, '@public.user', 'secret');
  expect(await notices()).toEqual([]);
  await addSessionEntry(publicUser.id, privateRoom.id, 'Joining', 'secret');
  await addSessionEntry(actor.id, privateRoom.id, '@public.user', 'secret');
  expect((await notices()).map(item => String(item.userId))).toEqual([publicUser.id]);
});

test('a notification target outside the first entry page can be fetched with the same read access checks', async () => {
  const room = await createSession(actor.id, { title: 'Room', type: 'OPEN' });
  const entries = await SessionEntry.create(Array.from({ length: 35 }, (_, i) => ({ sessionId: room.id, userId: actor.id, content: `Entry ${i}` })));
  const source = 'query($room:ID!,$entry:ID!,$code:String){getSessionEntry(sessionId:$room,entryId:$entry,accessCode:$code){id content}}';
  const variables = { room: room.id, entry: entries[34].id };
  expect((await run(source, variables)).data.getSessionEntry.id).toBe(entries[34].id);
  const privateRoom = await createSession(actor.id, { title: 'Private', type: 'PRIVATE', accessCode: 'secret' });
  const entry = await addSessionEntry(actor.id, privateRoom.id, 'Private content', 'secret');
  expect((await run(source, { room: privateRoom.id, entry: entry.id }, publicUser)).errors).toBeDefined();
  expect((await run(source, { room: privateRoom.id, entry: entry.id, code: 'secret' }, publicUser)).data.getSessionEntry.content).toBe('Private content');
  expect((await run(source, { room: room.id, entry: entry.id })).data.getSessionEntry).toBeNull();
  await SessionEntry.updateOne({ _id: entries[34].id }, { isDeleted: true });
  expect((await run(source, variables)).data.getSessionEntry).toBeNull();
});
