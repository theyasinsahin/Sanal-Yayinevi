import { jest } from '@jest/globals';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect, clearDatabase, closeDatabase } from './db.js';
import { createMailer, contactRecipient } from '../src/config/smtp.js';
import Verification from '../src/models/verification.js';

const local = {
  NODE_ENV: 'development', BETIK_DOCKER_DEV: 'true', DEV_EXTERNAL_INTEGRATIONS: 'false',
  MONGO_URI: 'mongodb://mongo:27017/betik_dev?replicaSet=rs0',
  PRINT_PAYMENTS_MODE: 'SANDBOX', PRINT_SYSTEM_ENABLED: 'true',
  JWT_SECRET: 'synthetic-development-registration-signing-secret', CLIENT_URL: 'http://localhost:3000',
};
let directory, previous;
jest.setTimeout(60000);
// Inject the real local mailer without changing NODE_ENV for MongoDB/Jest.
jest.unstable_mockModule('../src/config/smtp.js', () => ({
  default: { sendMail: message => createMailer({ env: { ...local, DEV_MAIL_DIRECTORY: directory } }).sendMail(message) },
}));
const { sendRegistrationCode, registerUser, loginUser } = await import('../src/services/userService.js');
beforeAll(connect);
afterAll(closeDatabase);
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'betik-registration-'));
  previous = Object.fromEntries(['JWT_SECRET', 'CLIENT_URL'].map(key => [key, process.env[key]]));
  process.env.JWT_SECRET = local.JWT_SECRET;
  process.env.CLIENT_URL = local.CLIENT_URL;
});
afterEach(async () => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await clearDatabase();
  await rm(directory, { recursive: true, force: true });
});

test('fresh local registration delivers to a private archive and still requires the real single-use code', async () => {
  const email = 'newreader@example.test', username = 'newreader';
  expect((await sendRegistrationCode(email, username)).code).toBe(200);
  const files = await readdir(directory);
  expect(files).toHaveLength(1);
  const message = await readFile(join(directory, files[0]), 'utf8');
  const code = message.match(/\b\d{6}\b/)?.[0];
  expect(code).toMatch(/^\d{6}$/);
  const stored = await Verification.findOne({ email });
  expect(stored.code).not.toBe(code);
  const input = { email, username, fullName: 'Local Reader', password: 'Synthetic!1234', code };
  const registered = await registerUser(input, { startSession: true });
  expect(registered.code).toBe(200);
  expect(registered.user.isVerified).toBe(true);
  expect(registered.token).toBeTruthy();
  expect((await loginUser(email, input.password)).token).toBeTruthy();
  await expect(registerUser(input)).rejects.toThrow('doğrulama kodu');
  expect(await Verification.countDocuments()).toBe(0);
  expect(contactRecipient({ ...local, DEV_MAIL_DIRECTORY: directory })).toBe('contact@betik-dev.invalid');
});
