import { jest } from '@jest/globals';
import { mkdtemp, readdir, readFile, stat, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMailer } from '../src/config/smtp.js';

let directory;
const base = {
  NODE_ENV: 'development', BETIK_DOCKER_DEV: 'true', DEV_EXTERNAL_INTEGRATIONS: 'false',
  MONGO_URI: 'mongodb://mongo:27017/betik_dev?replicaSet=rs0',
  PRINT_PAYMENTS_MODE: 'SANDBOX', PRINT_SYSTEM_ENABLED: 'true',
};
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'betik-mail-test-')); });
afterEach(async () => { jest.restoreAllMocks(); await rm(directory, { recursive: true, force: true }); });

test('isolated mail archives verification and reset messages privately without SMTP or logs', async () => {
  const createTransport = jest.fn(), createSocket = jest.fn();
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const mailer = createMailer({ env: { ...base, DEV_MAIL_DIRECTORY: directory }, createTransport, createSocket });
  await expect(mailer.verify()).resolves.toBe(true);
  await Promise.all(['Verification code: 123456', 'http://localhost:3000/reset-password/synthetic-token'].map(text =>
    expect(mailer.sendMail({ from: { name: 'Betik' }, to: 'reader@example.test', subject: 'Development test', text })).resolves.toMatchObject({ accepted: ['reader@example.test'] })));
  const files = await readdir(directory);
  expect(files).toHaveLength(2);
  expect(files.every(file => file.endsWith('.eml'))).toBe(true);
  const contents = await Promise.all(files.map(file => readFile(join(directory, file), 'utf8')));
  expect(contents.join('\n')).toContain('123456');
  expect(contents.join('\n')).toContain('/reset-password/synthetic-token');
  for (const file of files) expect((await stat(join(directory, file))).mode & 0o777).toBe(0o600);
  expect(createTransport).not.toHaveBeenCalled(); expect(createSocket).not.toHaveBeenCalled();
  expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
});

test.each([{ NODE_ENV: 'production' }, { MONGO_URI: 'mongodb://elsewhere:27017/betik_dev?replicaSet=rs0' }, { DEV_MAIL_DIRECTORY: '' }, { DEV_MAIL_DIRECTORY: 'relative' }])('invalid isolation/archive configuration fails closed: %j', async override => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const createTransport = jest.fn();
  await expect(createMailer({ env: { ...base, DEV_MAIL_DIRECTORY: directory, ...override }, createTransport }).sendMail({ to: 'reader@example.test', text: '123456' })).rejects.toHaveProperty('extensions.code', 'EMAIL_DELIVERY_FAILED');
  expect(createTransport).not.toHaveBeenCalled();
  expect(await readdir(directory)).toEqual([]);
});

test('archive write failure is a delivery failure, never a successful verification-code send', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const file = join(directory, 'regular-file'); await writeFile(file, 'fixture');
  await expect(createMailer({ env: { ...base, DEV_MAIL_DIRECTORY: file } }).sendMail({ to: 'reader@example.test', text: '123456' })).rejects.toHaveProperty('extensions.code', 'EMAIL_DELIVERY_FAILED');
});

test.each([{ ...base, DEV_EXTERNAL_INTEGRATIONS: 'true' }, { NODE_ENV: 'production' }, { NODE_ENV: 'development' }])('external and non-Docker mail retain standard SMTP: %j', async config => {
  const createTransport = jest.fn(() => ({ verify: async () => true, close() {} }));
  const createSocket = () => ({ on() {}, destroy() {} });
  await expect(createMailer({ env: { ...config, DEV_MAIL_DIRECTORY: directory, EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'synthetic' }, createTransport, createSocket }).verify()).resolves.toBe(true);
  expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ service: 'gmail', auth: { user: 'sender@example.test', pass: 'synthetic' } }));
  expect(await readdir(directory)).toEqual([]);
});
