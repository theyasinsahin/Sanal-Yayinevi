import { jest } from '@jest/globals';
import { graphql, parse, subscribe } from 'graphql';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connect, clearDatabase, closeDatabase } from './db.js';

const sendMail = jest.fn().mockResolvedValue({ accepted: ['test@example.test'] });
jest.unstable_mockModule('../src/config/smtp.js', () => ({ default: { sendMail }, contactRecipient: () => 'test@example.test' }));
const { default: schema } = await import('../src/graphql/schema.js');
const { default: models } = await import('../src/models/index.js');
const { default: User } = await import('../src/models/user.js');
const { default: Book } = await import('../src/models/book.js');
const { default: Genre } = await import('../src/models/genre.js');
const { default: Quote } = await import('../src/models/quote.js');
const { default: Notification } = await import('../src/models/notification.js');
const { default: Comment } = await import('../src/models/comment.js');
const users = await import('../src/services/userService.js');
const follows = await import('../src/services/followService.js');
const messages = await import('../src/services/messageService.js');
const books = await import('../src/services/bookService.js');
const chapters = await import('../src/services/chapterService.js');
const quotes = await import('../src/services/quoteService.js');
const comments = await import('../src/services/commentService.js');
const sessions = await import('../src/services/sessionService.js');
const recommendations = await import('../src/services/recommendationService.js');
const { writingWeekStart, weeklyWords } = await import('../src/services/writingService.js');
const { authenticateUser } = await import('../src/utils/auth.js');

jest.setTimeout(30000);
beforeAll(connect);
afterEach(async () => { await clearDatabase(); sendMail.mockReset().mockResolvedValue({ accepted: ['test@example.test'] }); });
afterAll(closeDatabase);
const createUser = async (username, extra = {}) => User.create({ username, fullName: username, email: `${username}@example.test`, password: await bcrypt.hash('ValidPass1!', 4), ...extra });
const run = (source, variables, user) => graphql({ schema, source, variableValues: variables, contextValue: { ...models, user } });

test('settings persist, reload through the actual profile query and stay private', async () => {
  const owner = await createUser('owner');
  const saved = await run(`mutation { updatePrivacySettings(privacySettings: { isLibraryPublic: false, allowMessages: "none" }) { id privacySettings { isLibraryPublic allowMessages } } }`, {}, owner);
  expect(saved.errors).toBeUndefined();
  const query = `query($id: ID!) { getUserById(id: $id) { privacySettings { isLibraryPublic allowMessages } notificationSettings { bookLike } authorSettings { weeklyWordGoal } } }`;
  const response = await run(query, { id: String(owner._id) }, owner);
  expect(response.errors).toBeUndefined();
  expect(response.data.getUserById.privacySettings).toMatchObject({ isLibraryPublic: false, allowMessages: 'none' });
  expect((await run(query, { id: String(owner._id) })).data.getUserById.privacySettings).toBeNull();
});

test('profile, saved books and follow-list permissions cover direct and nested queries', async () => {
  const stranger = await createUser('stranger');
  const owner = await createUser('private', { bio: 'Özel açıklama', followers: [stranger._id], privacySettings: { isProfilePublic: false, isLibraryPublic: false, isFollowListPublic: false, showInSearchEngines: false } });
  const book = await Book.create({ authorId: owner._id, title: 'Yayımlanan', status: 'WRITING' });
  await Book.create({ authorId: owner._id, title: 'Taslak', status: 'DRAFT' });
  owner.savedBooks = [book._id]; await owner.save();
  const query = `query($id: ID!) { getUserById(id: $id) { bio email canViewProfile canViewLibrary canViewFollowList isSearchIndexable usersBooks { title } savedBooks { id } followers { id } } getSavedBooksByUserId(id: $id) { id } getFollowersByUserId(id: $id) { id } }`;
  const guest = await run(query, { id: String(owner._id) });
  expect(guest.errors).toBeUndefined();
  expect(guest.data.getUserById).toMatchObject({ bio: '', email: '', canViewProfile: false, canViewLibrary: false, usersBooks: [], savedBooks: [], followers: [], isSearchIndexable: false });
  expect(guest.data.getSavedBooksByUserId).toEqual([]);
  const follower = await run(query, { id: String(owner._id) }, stranger);
  expect(follower.data.getUserById).toMatchObject({ bio: 'Özel açıklama', canViewProfile: true, savedBooks: [], followers: [], usersBooks: [{ title: 'Yayımlanan' }] });
  const self = await run(query, { id: String(owner._id) }, owner);
  expect(self.data.getUserById.savedBooks).toHaveLength(1);
  expect(self.data.getUserById.usersBooks).toHaveLength(2);
  await users.updatePrivacySettings(owner._id, { isProfilePublic: true, isLibraryPublic: true, isFollowListPublic: true });
  const publicProfile = await run(query, { id: String(owner._id) });
  expect(publicProfile.data.getUserById.savedBooks).toHaveLength(1);
  expect(publicProfile.data.getFollowersByUserId).toHaveLength(1);
});

test('message permissions apply to both new and existing conversations; outsiders cannot read or mark them', async () => {
  const sender = await createUser('sender');
  const recipient = await createUser('recipient');
  const outsider = await createUser('outsider');
  const conversation = await messages.getOrCreateConversation(sender._id, recipient._id);
  await users.updatePrivacySettings(recipient._id, { allowMessages: 'none' });
  await expect(messages.getOrCreateConversation(sender._id, recipient._id)).rejects.toThrow('sınırlandırmış');
  await expect(messages.sendMessage(sender._id, { conversationId: conversation._id, content: 'test' })).rejects.toThrow('sınırlandırmış');
  await expect(messages.getConversationMessages(conversation._id, 20, 0, outsider._id)).rejects.toThrow('yetkiniz');
  await expect(messages.markMessagesAsRead(conversation._id, outsider._id)).rejects.toThrow('yetkiniz');
  await users.updatePrivacySettings(recipient._id, { allowMessages: 'followers' });
  await expect(messages.sendMessage(sender._id, { conversationId: conversation._id, content: 'test' })).rejects.toThrow('sınırlandırmış');
  const request = await users.toggleFollow(sender._id, recipient._id);
  await expect(messages.sendMessage(sender._id, { conversationId: conversation._id, content: 'onay beklerken' })).rejects.toThrow('sınırlandırmış');
  await follows.respondToFollowRequest(recipient._id, request.request._id, true);
  expect((await messages.sendMessage(sender._id, { conversationId: conversation._id, content: 'izinli' })).content).toBe('izinli');
});

test.each(['bookLike', 'bookComment', 'quoteLike'])('%s suppresses real event notifications when disabled', async preference => {
  const owner = await createUser('owner');
  const actor = await createUser('actor');
  const book = await Book.create({ title: 'Kitap', authorId: owner._id, status: 'WRITING' });
  const quote = await Quote.create({ text: 'Alıntı', normalizedText: 'alinti', userId: owner._id, bookId: book._id, chapterId: book._id });
  const events = {
    bookLike: () => books.toggleLike(book._id, actor._id),
    bookComment: () => comments.createComment({ userId: actor._id, bookId: book._id, content: 'Yorum' }),
    quoteLike: () => quotes.toggleQuoteLike(quote._id, actor._id),
  };
  await users.updateNotificationSettings(owner._id, { [preference]: false });
  await events[preference]();
  expect(await Notification.countDocuments({ userId: owner._id })).toBe(0);
  if (preference !== 'bookComment') await events[preference](); // undo the first follow/like
  await users.updateNotificationSettings(owner._id, { [preference]: true });
  await events[preference]();
  expect(await Notification.countDocuments({ userId: owner._id })).toBe(1);
});

test('session mentions and replies respect their separate preferences', async () => {
  const owner = await createUser('owner', { sessionCreationAccess: { status: 'APPROVED' }, notificationSettings: { mentionInSession: false, sessionReply: false } });
  const actor = await createUser('actor');
  const session = await sessions.createSession(owner._id, { title: 'Oturum', type: 'OPEN' });
  await sessions.addSessionEntry(actor._id, session._id, '@owner merhaba');
  expect(await Notification.countDocuments({ userId: owner._id })).toBe(0);
  await users.updateNotificationSettings(owner._id, { mentionInSession: true });
  await sessions.addSessionEntry(actor._id, session._id, '@owner tekrar');
  expect(await Notification.countDocuments({ userId: owner._id, type: 'SESSION_MENTION' })).toBe(1);
  await users.updateNotificationSettings(owner._id, { sessionReply: true });
  await sessions.addSessionEntry(actor._id, session._id, 'Yeni ileti');
  expect(await Notification.countDocuments({ userId: owner._id, type: 'SESSION_REPLY' })).toBe(1);
});

test('author genre settings and discovery onboarding update the same recommendation preferences', async () => {
  const user = await createUser('reader');
  const author = await createUser('writer');
  const genre = await Genre.create({ name: 'Bilim Kurgu', slug: 'bilim-kurgu', isActive: true, group: 'FICTION', classificationVersion: 1 });
  await users.updateAuthorSettings(user._id, { preferredGenres: [genre.name], weeklyWordGoal: 100 });
  expect((await recommendations.getUserPreference(user._id)).preferredGenres[0].name).toBe(genre.name);
  const book = await Book.create({ title: 'Önerilen', authorId: author._id, genreIds: [genre._id], status: 'WRITING' });
  expect((await recommendations.getRecommendations(user._id))[0]).toMatchObject({ reason: 'ONBOARDING_GENRE', book: { id: String(book._id) } });
  await recommendations.saveUserPreference(user._id, []);
  expect((await User.findById(user._id)).authorSettings.preferredGenres).toHaveLength(0);
  await expect(users.updateAuthorSettings(user._id, { weeklyWordGoal: -1 })).rejects.toThrow('tam sayı');
});

test('weekly writing goal measures saved chapter additions without counting identical saves', async () => {
  const author = await createUser('writer');
  const book = await Book.create({ title: 'Kitap', authorId: author._id });
  const chapter = await chapters.createChapter({ authorId: author._id, bookId: book._id, title: 'Bir', content: '<p>İlk iki kelime</p>' });
  expect(await weeklyWords(author._id)).toBe(3);
  await chapters.updateChapter(chapter._id, { content: '<p>İlk iki kelime</p>' });
  expect(await weeklyWords(author._id)).toBe(3);
  await chapters.updateChapter(chapter._id, { content: '<p>İlk iki kelime ve devamı</p>' });
  expect(await weeklyWords(author._id)).toBe(5);
  expect(writingWeekStart(new Date('2026-10-25T21:30:00Z')).toISOString()).toBe('2026-10-25T21:00:00.000Z');
});

test('deactivation hides content and invalidates old tokens even after reactivation', async () => {
  process.env.JWT_SECRET = 'profile-settings-test-secret';
  const user = await createUser('writer');
  await Book.create({ title: 'Kitap', authorId: user._id, status: 'WRITING' });
  const token = jwt.sign({ userId: user._id, version: 0 }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  expect(await authenticateUser(req, User)).not.toBeNull();
  await users.deactivateAccount(user._id);
  expect(await authenticateUser(req, User)).toBeNull();
  expect(await books.findAllBooks()).toHaveLength(0);
  const login = await users.loginUser(user.email, 'ValidPass1!');
  expect(login.user.isActive).toBe(true);
  expect(await authenticateUser(req, User)).toBeNull();
  expect(await books.findAllBooks()).toHaveLength(1);
});

test('account deletion closes the account and hides authored content without hard-deleting records', async () => {
  const user = await createUser('writer');
  const book = await Book.create({ title: 'Kitap', authorId: user._id, status: 'WRITING' });
  const comment = await Comment.create({ userId: user._id, bookId: book._id, content: 'Yorum' });
  await users.deleteAccountCompletely(user._id);
  expect((await User.findById(user._id)).isDeleted).toBe(true);
  expect((await Book.findById(book._id)).isDeleted).toBe(true);
  expect((await Comment.findById(comment._id)).isDeleted).toBe(true);
  await expect(users.loginUser(user.email, 'ValidPass1!')).rejects.toThrow('silinmiş');
});

test('email and password changes validate credentials and report SMTP failure honestly', async () => {
  const user = await createUser('account');
  await expect(users.changePassword(user._id, { currentPassword: 'wrong', newPassword: 'OtherPass1!' })).rejects.toThrow('hatalı');
  await expect(users.changePassword(user._id, { currentPassword: 'ValidPass1!', newPassword: 'weakpass' })).rejects.toThrow('büyük harf');
  await users.changePassword(user._id, { currentPassword: 'ValidPass1!', newPassword: 'OtherPass1!' });
  expect(await bcrypt.compare('OtherPass1!', (await User.findById(user._id)).password)).toBe(true);
  await expect(users.changeEmail(user._id, { currentPassword: 'OtherPass1!', newEmail: 'bad' })).rejects.toThrow('Geçerli');
  sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
  const response = await users.changeEmail(user._id, { currentPassword: 'OtherPass1!', newEmail: ' New@Example.test ' });
  expect(response.message).toContain('gönderilemedi');
  expect((await User.findById(user._id)).email).toBe('new@example.test');
  await User.create({ username: 'other', fullName: 'Other', email: 'Other@Example.test', password: 'hash' });
  await expect(users.changeEmail(user._id, { currentPassword: 'OtherPass1!', newEmail: 'other@example.test' })).rejects.toThrow('zaten kullanılıyor');
  expect((await users.loginUser('NEW@example.test', 'OtherPass1!')).user.email).toBe('new@example.test');
});

test('message subscriptions deliver real events and reject non-participants', async () => {
  const sender = await createUser('sender');
  const recipient = await createUser('recipient');
  const outsider = await createUser('outsider');
  const conversation = await messages.getOrCreateConversation(sender._id, recipient._id);
  const document = parse('subscription($id: ID!) { onNewMessage(conversationId: $id) { content } }');
  const variables = { id: String(conversation._id) };
  const rejected = await subscribe({ schema, document, variableValues: variables, contextValue: { ...models, user: outsider } });
  expect(rejected.errors[0].message).toContain('yetkiniz');
  const stream = await subscribe({ schema, document, variableValues: variables, contextValue: { ...models, user: recipient } });
  try {
    const next = stream.next();
    await messages.sendMessage(sender._id, { conversationId: conversation._id, content: 'Canlı mesaj' });
    const response = await next;
    expect(response.value.errors).toBeUndefined();
    expect(response.value.data.onNewMessage.content).toBe('Canlı mesaj');
  } finally { await stream.return(); }
});

test('session subscriptions use the installed PubSub API and deliver new entries', async () => {
  const owner = await createUser('owner', { sessionCreationAccess: { status: 'APPROVED' } });
  const actor = await createUser('actor');
  const session = await sessions.createSession(owner._id, { title: 'Canlı oturum', type: 'OPEN' });
  const stream = await subscribe({ schema,
    document: parse('subscription($id: ID!) { onNewSessionEntry(sessionId: $id) { content } }'),
    variableValues: { id: String(session._id) }, contextValue: { ...models, user: owner },
  });
  try {
    const next = stream.next();
    await sessions.addSessionEntry(actor._id, session._id, 'Canlı ileti');
    expect((await next).value.data.onNewSessionEntry.content).toBe('Canlı ileti');
  } finally { await stream.return(); }
});

test('Google sign-in reactivates a deactivated account', async () => {
  const owner = await createUser('google', { isActive: false });
  const verification = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => ({ email: owner.email, name: owner.fullName }),
  });
  try {
    const result = await users.authenticateWithGoogleCredential('mock-google-credential');
    expect(result.user.isActive).toBe(true);
    expect((await User.findById(owner._id)).isActive).toBe(true);
  } finally { verification.mockRestore(); }
});
