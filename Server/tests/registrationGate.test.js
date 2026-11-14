import { jest } from '@jest/globals';
import { graphql } from 'graphql';
import jwt from 'jsonwebtoken';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import Verification from '../src/models/verification.js';
import { limitOperation } from '../src/security/rateLimit.js';
import { readableChapter } from '../src/utils/chapterAccess.js';

jest.setTimeout(60000);
const originalGate = process.env.REGISTRATION_GATE_ENABLED;
const originalSecret = process.env.JWT_SECRET;
let owner, reader, admin, book, first, second, hidden;
beforeAll(connect);
afterAll(async () => {
  if (originalGate === undefined) delete process.env.REGISTRATION_GATE_ENABLED; else process.env.REGISTRATION_GATE_ENABLED = originalGate;
  if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  await closeDatabase();
});
afterEach(() => { jest.restoreAllMocks(); return clearDatabase(); });
beforeEach(async () => {
  process.env.REGISTRATION_GATE_ENABLED = 'true';
  process.env.JWT_SECRET = 'registration-tests-only-secret';
  [owner, reader, admin] = await User.create(['owner', 'reader', 'admin'].map(username => ({ username, fullName: username, email: `${username}@test.example`, password: 'hash', role: username === 'admin' ? 'ADMIN' : 'USER' })));
  book = await Book.create({ title: 'Public book', authorId: owner.id, status: 'WRITING' });
  [hidden, first, second] = await Chapter.create([
    { title: 'Hidden', isHidden: true, content: '<p>HIDDEN WORDS</p>' },
    { title: 'First', content: '<p>PUBLIC PREVIEW</p>' },
    { title: 'Second', content: '<p>MEMBER FULL TEXT</p>' },
  ].map(chapter => ({ ...chapter, bookId: book.id, authorId: owner.id })));
  // Deliberately tie timestamps: the ObjectId must break the tie consistently.
  await Chapter.updateMany({ bookId: book.id }, { $set: { createdAt: new Date('2026-01-01') } }, { timestamps: false });
});
const run = (source, variableValues = {}, user = null) => graphql({ schema, source, variableValues, contextValue: { user, User, Book, Chapter } });
const fields = 'id content accessStatus canReadContent isHidden';
const query = `query($b:ID!,$s:ID!,$a:ID!){
  book:getBookById(id:$b){chapters{${fields}}}
  one:getChapterById(id:$s){${fields}}
  reader:getReadingChapter(bookId:$b,chapterId:$s){${fields}}
  list:getChaptersByBookId(bookId:$b){${fields}}
  author:getChaptersByAuthorId(authorId:$a){${fields}}
  all:getAllChapters{${fields}}
}`;
const vars = () => ({ b: book.id, s: second.id, a: owner.id });

test('all GraphQL paths hide subsequent full text while preserving first-open metadata', async () => {
  const aggregate = jest.spyOn(Chapter, 'aggregate');
  const result = await run(query, vars());
  expect(result.errors).toBeUndefined();
  expect(JSON.stringify(result.data)).not.toContain('MEMBER FULL TEXT');
  expect(JSON.stringify(result.data)).not.toContain('HIDDEN WORDS');
  expect(result.data.one).toMatchObject({ content: '', canReadContent: false, accessStatus: 'REGISTRATION_REQUIRED' });
  expect(result.data.book.chapters.find(chapter => chapter.id === first.id)).toMatchObject({ canReadContent: true, accessStatus: 'READABLE' });
  expect(result.data.book.chapters.find(chapter => chapter.id === hidden.id).accessStatus).toBe('HIDDEN');
  expect(aggregate).toHaveBeenCalledTimes(1);
  expect(await readableChapter(second.id, null)).toBeNull();
});

test.each(['reader', 'owner', 'admin'])('%s can read member chapters and hidden permissions remain separate', async role => {
  const result = await run(query, vars(), { reader, owner, admin }[role]);
  expect(result.errors).toBeUndefined();
  expect(result.data.one).toMatchObject({ accessStatus: 'READABLE', canReadContent: true });
  expect(result.data.one.content).toContain('MEMBER FULL TEXT');
  expect(result.data.book.chapters.find(chapter => chapter.id === hidden.id).accessStatus).toBe(role === 'reader' ? 'HIDDEN' : 'READABLE');
});

test('hiding or deleting the first open chapter promotes the next preview', async () => {
  await Chapter.updateOne({ _id: first.id }, { isHidden: true });
  let result = await run(query, vars());
  expect(result.data.one.accessStatus).toBe('READABLE');
  await Chapter.updateOne({ _id: first.id }, { isHidden: false, isDeleted: true });
  result = await run(query, vars());
  expect(result.data.one.accessStatus).toBe('READABLE');
});

test('preview is per book, not a counter of anonymous visits', async () => {
  const another = await Book.create({ title: 'Another', authorId: owner.id, status: 'WRITING' });
  const preview = await Chapter.create({ bookId: another.id, authorId: owner.id, title: 'Only chapter', content: 'Another preview' });
  const result = await run(`query($id:ID!){getChapterById(id:$id){${fields}}}`, { id: preview.id });
  expect(result.data.getChapterById).toMatchObject({ content: 'Another preview', accessStatus: 'READABLE' });
});

test('disabling the feature restores public open chapters without exposing hidden text', async () => {
  delete process.env.REGISTRATION_GATE_ENABLED;
  const result = await run(query, vars());
  expect(result.errors).toBeUndefined();
  expect(result.data.one.content).toContain('MEMBER FULL TEXT');
  expect(JSON.stringify(result.data)).not.toContain('HIDDEN WORDS');
});

test('draft books and inactive authors stay unavailable to guests', async () => {
  await Book.updateOne({ _id: book.id }, { status: 'DRAFT', digitalStatus: 'DRAFT' });
  expect((await run(query, vars())).data.one).toBeNull();
  await Book.updateOne({ _id: book.id }, { status: 'WRITING', digitalStatus: 'PUBLISHED' });
  await User.updateOne({ _id: owner.id }, { isActive: false });
  const result = await run(query, vars());
  expect(JSON.stringify(result.data)).not.toContain('PUBLIC PREVIEW');
});

const registration = { username: 'newreader', fullName: 'New Reader', email: 'new@test.example', password: 'Correct!123', code: '123456' };
const register = `mutation($username:String!,$fullName:String!,$email:String!,$password:String!,$code:String!){registerAndLogin(username:$username,fullName:$fullName,email:$email,password:$password,code:$code){code message token user{id isVerified}}}`;
test('verified registration creates an authenticated session and consumes the code once', async () => {
  await Verification.create({ email: registration.email, code: registration.code });
  const result = await run(register, registration);
  expect(result.errors).toBeUndefined();
  const payload = result.data.registerAndLogin;
  expect(payload.code).toBe(200);
  expect(payload.user.isVerified).toBe(true);
  expect(jwt.verify(payload.token, process.env.JWT_SECRET)).toMatchObject({ userId: payload.user.id, version: 0 });
  expect(await Verification.countDocuments({ email: registration.email })).toBe(0);
  expect((await run(register, registration)).data.registerAndLogin).toMatchObject({ code: 400, token: null, user: null });
});

test('invalid verification creates neither an account nor a token', async () => {
  const result = await run(register, registration);
  expect(result.data.registerAndLogin).toMatchObject({ code: 400, token: null, user: null });
  expect(await User.exists({ email: registration.email })).toBeNull();
});

test('token failure after account creation returns a usable login fallback', async () => {
  await Verification.create({ email: registration.email, code: registration.code });
  delete process.env.JWT_SECRET;
  const result = await run(register, registration);
  expect(result.data.registerAndLogin).toMatchObject({ code: 200, token: null, user: null });
  expect(await User.exists({ email: registration.email })).toBeTruthy();
});

test('legacy registration and automatic-login registration share the same rate budget', async () => {
  const context = { req: { ip: 'registration-test' } };
  for (let i = 0; i < 5; i++) await limitOperation(context, i % 2 ? 'register' : 'registerAndLogin', { email: registration.email }, true);
  await expect(limitOperation(context, 'registerAndLogin', { email: registration.email }, true)).rejects.toMatchObject({ extensions: { code: 'RATE_LIMITED' } });
});

test('chapter music is hidden by the guest registration gate and restored for members', async () => {
  const music = { url: 'https://res.cloudinary.com/test/video/upload/music.mp3', title: 'Member track', duration: 12, publicId: 'chapter_music/test' };
  await Chapter.updateOne({ _id: second._id }, { $set: { music } });
  const source = 'query($id:ID!){getChapterById(id:$id){music{url title duration publicId}}}';
  const guest = await run(source, { id: second.id });
  expect(guest.errors).toBeUndefined();
  expect(guest.data.getChapterById.music).toBeNull();
  const member = await run(source, { id: second.id }, reader);
  expect(member.errors).toBeUndefined();
  expect(member.data.getChapterById.music).toEqual(music);
});
