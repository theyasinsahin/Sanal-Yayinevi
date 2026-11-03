import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { graphql, parse, subscribe } from 'graphql';
import { connect, clearDatabase, closeDatabase } from './db.js';

const sendMail = jest.fn().mockResolvedValue({ accepted: ['synthetic@example.test'] });
jest.unstable_mockModule('../src/config/smtp.js', () => ({ default: { sendMail }, contactRecipient: () => 'synthetic@example.test' }));
const { default: schema } = await import('../src/graphql/schema.js');
const { default: models } = await import('../src/models/index.js');
const { default: Verification } = await import('../src/models/verification.js');
const users = await import('../src/services/userService.js');
const sessions = await import('../src/services/sessionService.js');
const chapters = await import('../src/services/chapterService.js');
const adminService = await import('../src/services/adminService.js');
const { authenticateUser } = await import('../src/utils/auth.js');
const { User, Book, Chapter } = models;
const password = 'SyntheticPass1!';
let owner, reader;
const run = (source, variables = {}, user = null) => graphql({ schema, source, variableValues: variables, contextValue: { ...models, user } });
beforeAll(connect, 60000);
beforeEach(async () => {
  process.env.JWT_SECRET = 'security-regression-synthetic-secret-only';
  process.env.CLIENT_URL = 'https://synthetic.example.test';
  [owner, reader] = await User.create(['owner', 'reader'].map(username => ({ username, fullName: username, email: `${username}@example.test`, password: bcrypt.hashSync(password, 4), sessionCreationAccess: { status: 'APPROVED' } })));
  sendMail.mockClear();
});
afterEach(clearDatabase);
afterAll(closeDatabase);

test('changing a password revokes previously issued bearer credentials', async () => {
  const token = jwt.sign({ userId: owner.id, version: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await users.changePassword(owner.id, { currentPassword: password, newPassword: 'ChangedSynthetic2!' });
  expect(await authenticateUser({ headers: { authorization: `Bearer ${token}` } }, User)).toBeNull();
});

test('reset tokens are hashed at rest, single use under concurrency, and revoke sessions', async () => {
  await users.forgotPassword(owner.email);
  const token = sendMail.mock.calls[0][0].text.match(/reset-password\/([a-f0-9]{64})/)[1];
  const stored = await User.findById(owner.id);
  expect(stored.resetPasswordToken).not.toBe(token);
  const outcomes = await Promise.allSettled([users.resetPassword(token, 'ChangedSynthetic2!'), users.resetPassword(token, 'OtherSynthetic3!')]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await User.findById(owner.id)).authVersion).toBe(1);
});

test('invalid and expired reset links retain a safe actionable error in production formatting', async () => {
  const { default: formatError } = await import('../src/utils/formatError.js');
  const previousMode = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    for (const token of ['invalid', 'a'.repeat(64)]) {
      const result = await run('mutation($token: String!, $password: String!) { resetPassword(token: $token, newPassword: $password) { code message } }', { token, password: 'ChangedSynthetic2!' });
      const error = result.errors[0];
      expect(formatError(error.toJSON(), error)).toMatchObject({ message: 'Geçersiz veya süresi dolmuş bağlantı.', extensions: { code: 'BAD_USER_INPUT' } });
    }
  } finally { process.env.NODE_ENV = previousMode; }
});

test('registration explicitly rejects expired codes before Mongo TTL deletion', async () => {
  await Verification.create({ email: 'new@example.test', code: '123456', createdAt: new Date(Date.now() - 601000) });
  await expect(users.registerUser({ username: 'new', fullName: 'New', email: 'new@example.test', password, code: '123456' })).rejects.toThrow();
  expect(await User.exists({ email: 'new@example.test' })).toBeNull();
});

test('new registration codes use a salted slow hash and can be consumed only once', async () => {
  await users.sendRegistrationCode('new@example.test', 'new');
  const code = sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0];
  const stored = await Verification.findOne({ email: 'new@example.test' });
  expect(stored.code).toMatch(/^\$2/); expect(stored.code).not.toContain(code);
  expect(await bcrypt.compare(code, stored.code)).toBe(true);
  const args = { email: 'new@example.test', username: 'new', fullName: 'New User', password, code };
  const outcomes = await Promise.allSettled([users.registerUser(args), users.registerUser(args)]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
});

test('an already delivered registration code still works after a failed resend', async () => {
  await users.sendRegistrationCode('new@example.test', 'new');
  const code = sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0];
  sendMail.mockRejectedValueOnce(new Error('synthetic SMTP outage'));
  await expect(users.sendRegistrationCode('new@example.test', 'new')).rejects.toThrow();
  await expect(users.registerUser({ email: 'new@example.test', username: 'new', fullName: 'New User', password, code })).resolves.toHaveProperty('code', 200);
});

test('an already delivered password-reset link still works after a failed resend', async () => {
  await users.forgotPassword(owner.email);
  const token = sendMail.mock.calls[0][0].text.match(/reset-password\/([a-f0-9]{64})/)[1];
  sendMail.mockRejectedValueOnce(new Error('synthetic SMTP outage'));
  await expect(users.forgotPassword(owner.email)).resolves.toHaveProperty('code', 200);
  await expect(users.resetPassword(token, 'ChangedSynthetic2!')).resolves.toHaveProperty('code', 200);
});

test('registration status payloads cannot bypass error masking and expose SMTP internals', async () => {
  sendMail.mockRejectedValueOnce(new Error('synthetic-SMTP-secret-and-internal-host'));
  const result = await run('mutation { sendRegistrationCode(email:"new@example.test", username:"new") { code message } }');
  expect(result.errors).toBeUndefined();
  expect(result.data.sendRegistrationCode.code).toBe(400);
  expect(result.data.sendRegistrationCode.message).not.toContain('synthetic-SMTP');
});

test('wrong verification attempts cannot be followed by a successful guess after the attempt budget', async () => {
  await Verification.create({ email: 'new@example.test', code: '123456' });
  for (let i = 0; i < 5; i++) await expect(users.registerUser({ username: 'new', fullName: 'New', email: 'new@example.test', password, code: '654321' })).rejects.toThrow();
  await expect(users.registerUser({ username: 'new', fullName: 'New', email: 'new@example.test', password, code: '123456' })).rejects.toThrow();
});

test('legacy hostile chapter HTML is cleaned on output and newly written HTML is cleaned in storage', async () => {
  const book = await Book.create({ title: 'Published', authorId: owner.id, status: 'WRITING' });
  const hostile = '<p>Safe <strong>text</strong></p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="jav&#x61;script:alert(3)">link</a>';
  const legacy = await Chapter.create({ bookId: book.id, authorId: owner.id, content: hostile });
  const result = await run('query($id: ID!) { getChapterById(id: $id) { content } }', { id: legacy.id });
  expect(result.errors).toBeUndefined();
  expect(result.data.getChapterById.content).not.toMatch(/onerror|<script|javascript:/i);
  const created = await chapters.createChapter({ bookId: book.id, authorId: owner.id, content: hostile });
  expect((await Chapter.findById(created.id)).content).not.toMatch(/onerror|<script|javascript:/i);
  expect(created.content).toContain('<strong>text</strong>');
});

test('private session messages require a valid code on reads and likes', async () => {
  const room = await sessions.createSession(owner.id, { title: 'Private', type: 'PRIVATE', accessCode: 'private-code' });
  const entry = await sessions.addSessionEntry(owner.id, room.id, 'Secret entry', 'private-code');
  await expect(sessions.getSessionEntries(room.id, 30, 0)).rejects.toThrow();
  await expect(sessions.getSessionEntries(room.id, 30, 0, reader.id)).rejects.toThrow();
  expect(await sessions.getSessionEntries(room.id, 30, 0, reader.id, 'private-code')).toHaveLength(1);
  await expect(sessions.toggleSessionEntryLike(entry.id, reader.id)).rejects.toThrow();
});

test('private code failures share their budget across reads, verification and WebSocket subscriptions', async () => {
  const room = await sessions.createSession(owner.id, { title: 'Private budget', type: 'PRIVATE', accessCode: 'private-code' });
  const context = { user: reader, req: { ip: '198.51.100.20' } };
  for (let i = 0; i < 10; i++) await expect(sessions.getSessionEntries(room.id, 30, 0, reader.id, 'wrong', context)).rejects.toThrow();
  await expect(sessions.verifySessionAccessCode(room.id, 'private-code', context)).rejects.toMatchObject({ extensions: { code: 'RATE_LIMITED' } });
  await expect(sessions.requireSessionRead(room.id, reader.id, 'private-code', { user: reader, socketRequest: { ip: '198.51.100.20' } })).rejects.toMatchObject({ extensions: { code: 'RATE_LIMITED' } });
}, 15000);

test('correct private code reads do not consume the failed-guess budget', async () => {
  const room = await sessions.createSession(owner.id, { title: 'Normal private reads', type: 'PRIVATE', accessCode: 'private-code' });
  const context = { user: reader, req: { ip: '198.51.100.30' } };
  for (let i = 0; i < 15; i++) expect(await sessions.getSessionEntries(room.id, 30, 0, reader.id, 'private-code', context)).toEqual([]);
}, 15000);

test('non-followers cannot subscribe to a followers-only session', async () => {
  const room = await sessions.createSession(owner.id, { title: 'Followers', type: 'FOLLOWERS_ONLY' });
  const result = await subscribe({ schema, document: parse('subscription($id: ID!) { onNewSessionEntry(sessionId: $id) { content } }'), variableValues: { id: room.id }, contextValue: { ...models, user: reader } });
  if (result.return) await result.return();
  expect(result.errors?.length).toBeGreaterThan(0);
});

test('the public book lookup and message attachment cannot disclose draft metadata', async () => {
  const draft = await Book.create({ title: 'Private draft title', description: 'Private draft description', authorId: owner.id });
  const result = await run('query($id: ID!) { getBookById(id: $id) { title description } }', { id: draft.id }, reader);
  expect(result.data?.getBookById).toBeNull();
  expect((await run('query($id: ID!) { getBookById(id: $id) { title } }', { id: draft.id }, owner)).data.getBookById.title).toBe(draft.title);
  const conversation = await models.Conversation.create({ participants: [owner.id, reader.id] });
  await models.Message.create({ conversationId: conversation.id, senderId: owner.id, type: 'BOOK', attachedBookId: draft.id });
  const attachment = await run('query($id:ID!) { getMessages(conversationId:$id) { attachedBook { title description } } }', { id: conversation.id }, reader);
  expect(attachment.errors).toBeUndefined();
  expect(attachment.data.getMessages[0].attachedBook).toBeNull();
});

test('unpublishing a book prevents historical quotes from exposing its text', async () => {
  const book = await Book.create({ title: 'Published then draft', authorId: owner.id, status: 'WRITING' });
  const chapter = await Chapter.create({ bookId: book.id, authorId: owner.id, content: 'Classified manuscript text' });
  await models.Quote.create({ bookId: book.id, chapterId: chapter.id, userId: owner.id, text: 'Classified manuscript text', normalizedText: 'classified', visibility: 'PUBLIC' });
  await Book.updateOne({ _id: book.id }, { status: 'DRAFT', digitalStatus: 'DRAFT' });
  const response = await run('{ getQuotesFeed { text } }', {}, reader);
  expect(JSON.stringify(response.data)).not.toContain('Classified manuscript text');
});

test('server logout revokes the bearer token instead of only clearing browser state', async () => {
  const token = jwt.sign({ userId: owner.id, version: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const result = await run('mutation { logout { code } }', {}, owner);
  expect(result.errors).toBeUndefined();
  expect(await authenticateUser({ headers: { authorization: `Bearer ${token}` } }, User)).toBeNull();
});

test('administratively blocked accounts cannot reactivate through a password login', async () => {
  const admin = await User.create({ username: 'admin', fullName: 'Administrator', email: 'admin@example.test', password: 'hash', role: 'ADMIN' });
  const context = { user: admin };
  const record = await adminService.getAdminRecord(context, { resource: 'User', id: owner.id });
  await adminService.saveAdminRecord(context, { resource: 'User', id: owner.id, revision: record.revision, changes: { isActive: false }, reason: 'Synthetic administrative block' });
  await expect(users.loginUser(owner.email, password)).rejects.toThrow('Giriş bilgileri geçersiz');
  expect((await User.findById(owner.id)).isActive).toBe(false);
});

test('an email change clears old reset links, verification claims and active sessions', async () => {
  await User.updateOne({ _id: owner.id }, { isVerified: true, resetPasswordToken: 'synthetic-reset-hash' });
  await users.changeEmail(owner.id, { newEmail: 'changed@example.test', currentPassword: password });
  const changed = await User.findById(owner.id);
  expect(changed.authVersion).toBe(1); expect(changed.isVerified).toBe(false); expect(changed.resetPasswordToken).toBeNull();
  expect(sendMail.mock.calls[0][0].bcc).toBe(owner.email);
});

test('unknown and incorrect-password logins expose the same error', async () => {
  await expect(users.loginUser('absent@example.test', password)).rejects.toThrow('Giriş bilgileri geçersiz');
  await expect(users.loginUser(owner.email, 'wrong')).rejects.toThrow('Giriş bilgileri geçersiz');
});

test.each([false, undefined])('unverified Google email claims cannot authenticate (%s)', async email_verified => {
  process.env.GOOGLE_CLIENT_ID = 'synthetic-google-client';
  const mock = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-subject', email: owner.email, name: owner.fullName, email_verified }) });
  try { await expect(users.authenticateWithGoogleCredential('synthetic')).rejects.toThrow('doğrulanamadı'); } finally { mock.mockRestore(); }
});

test('third-party email ownership cannot silently link a different Google identity to an existing account', async () => {
  process.env.GOOGLE_CLIENT_ID = 'synthetic-google-client';
  const mock = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-subject', email: owner.email, name: owner.fullName, email_verified: true }) });
  try { await expect(users.authenticateWithGoogleCredential('synthetic')).rejects.toThrow('ayrıca doğrulanmalıdır'); } finally { mock.mockRestore(); }
});
