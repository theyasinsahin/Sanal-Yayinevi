import jwt from 'jsonwebtoken';
import User from '../src/models/user.js';
import { authenticateUser } from '../src/utils/auth.js';
import { connect, clearDatabase, closeDatabase } from './db.js';

let user;
const originalSecret = process.env.JWT_SECRET;
const testSecret = 'authentication-tests-only-signing-secret';
const credentials = (claims = {}, options = {}) => jwt.sign({ userId: user.id, ...claims }, testSecret, { expiresIn: '1h', ...options });
const authenticate = token => authenticateUser({ headers: token ? { authorization: `Bearer ${token}` } : {} }, User);

beforeAll(async () => { await connect(); }, 60000);
beforeEach(async () => {
  process.env.JWT_SECRET = testSecret;
  user = await User.create({ username: 'reader', fullName: 'Reader', email: 'reader@example.test', password: 'private-password-hash' });
});
afterEach(clearDatabase);
afterAll(async () => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  await closeDatabase();
});

test('a valid signed token resolves the active user without exposing the password', async () => {
  const result = await authenticate(credentials());
  expect(result.id).toBe(user.id);
  expect(result.password).toBeUndefined();
});

test.each(['absent', 'malformed', 'expired', 'wrong signature', 'future token', 'missing user ID'])('%s credentials cannot authenticate', async kind => {
  let token;
  if (kind === 'malformed') token = 'not-a-jwt';
  if (kind === 'expired') token = credentials({}, { expiresIn: -1 });
  if (kind === 'wrong signature') token = jwt.sign({ userId: user.id }, 'another-test-only-secret');
  if (kind === 'future token') token = credentials({}, { notBefore: '1h' });
  if (kind === 'missing user ID') token = jwt.sign({}, testSecret);
  expect(await authenticate(token)).toBeNull();
});

test.each([{ isDeleted: true }, { isActive: false }])('disabled or deleted users cannot reuse a valid token: %j', async changes => {
  const token = credentials();
  await User.updateOne({ _id: user._id }, changes);
  expect(await authenticate(token)).toBeNull();
});

test('tokens for a deleted database record are rejected', async () => {
  const token = credentials(); await User.deleteOne({ _id: user._id });
  expect(await authenticate(token)).toBeNull();
});

test('changing authVersion invalidates old credentials while newly issued credentials work', async () => {
  const stale = credentials({ version: 0 });
  await User.updateOne({ _id: user._id }, { authVersion: 1 });
  expect(await authenticate(stale)).toBeNull();
  expect((await authenticate(credentials({ version: 1 }))).id).toBe(user.id);
});

test('legacy tokens without a version work only while the account version is zero', async () => {
  const token = credentials();
  expect((await authenticate(token)).id).toBe(user.id);
  await User.updateOne({ _id: user._id }, { authVersion: 2 });
  expect(await authenticate(token)).toBeNull();
});

test('authorization uses the current database role rather than token role claims', async () => {
  const token = credentials({ role: 'ADMIN' });
  expect((await authenticate(token)).role).toBe('USER');
  await User.updateOne({ _id: user._id }, { role: 'ADMIN' });
  expect((await authenticate(token)).role).toBe('ADMIN');
});
