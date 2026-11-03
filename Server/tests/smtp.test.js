import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import nodemailer from 'nodemailer';
import { createMailer, mailSettings, contactRecipient } from '../src/config/smtp.js';

const env = { EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'synthetic-password' };
let logger;
beforeEach(() => { logger = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const socket = () => Object.assign(new EventEmitter(), { destroy: jest.fn() });

test('Gmail remains the default and transactional providers require TLS', () => {
  expect(mailSettings(env)).toMatchObject({ service: 'gmail', connectionTimeout: 6000, socketTimeout: 8000 });
  expect(mailSettings({ ...env, SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587' })).toMatchObject({ host: 'smtp.example.test', port: 587, secure: false, requireTLS: true });
  expect(mailSettings({ ...env, SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465' }).secure).toBe(true);
  expect(() => mailSettings({ ...env, SMTP_HOST: 'smtp.example.test', SMTP_PORT: 'invalid' })).toThrow();
});

test('transport creation is lazy and preserves EMAIL credentials', async () => {
  const createTransport = jest.fn(() => ({ verify: async () => true, close: jest.fn() }));
  const mailer = createMailer({ env, createTransport, createSocket: socket });
  expect(createTransport).not.toHaveBeenCalled();
  await expect(mailer.verify()).resolves.toBe(true);
  expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS } }));
});
test('missing or malformed credentials fail before opening a connection', async () => {
  const createTransport = jest.fn();
  expect(() => mailSettings({})).toThrow();
  expect(() => mailSettings({ EMAIL_USER: 'invalid', EMAIL_PASS: 'test' })).toThrow();
  await expect(createMailer({ env: {}, createTransport }).verify()).rejects.toHaveProperty('extensions.code', 'EMAIL_DELIVERY_FAILED');
  expect(createTransport).not.toHaveBeenCalled();
});
test('contact uses configured recipient or the existing sender mailbox', () => {
  expect(contactRecipient({ EMAIL_USER: 'sender@example.test' })).toBe('sender@example.test');
  expect(contactRecipient({ EMAIL_USER: 'sender@example.test', CONTACT_EMAIL: 'contact@example.test' })).toBe('contact@example.test');
  expect(() => contactRecipient({ EMAIL_USER: 'sender@example.test', CONTACT_EMAIL: 'invalid' })).toThrow();
});

test('a stalled send is cancelled after twelve seconds and another request is unaffected', async () => {
  jest.useFakeTimers();
  const first = socket(), second = socket();
  const closeFirst = jest.fn(), closeSecond = jest.fn();
  const createTransport = jest.fn()
    .mockReturnValueOnce({ sendMail: () => new Promise(() => {}), close: closeFirst })
    .mockReturnValueOnce({ sendMail: async () => ({ accepted: ['reader@example.test'] }), close: closeSecond });
  const createSocket = jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const mailer = createMailer({ env, createTransport, createSocket });
  const result = mailer.sendMail({ to: 'reader@example.test' }).catch(error => error);
  await expect(mailer.sendMail({ to: 'reader@example.test' })).resolves.toHaveProperty('accepted');
  await jest.advanceTimersByTimeAsync(12000);
  expect(await result).toMatchObject({ extensions: { code: 'EMAIL_DELIVERY_FAILED' }, code: 'ETIMEDOUT' });
  expect(first.destroy).toHaveBeenCalledWith(expect.objectContaining({ code: 'ETIMEDOUT' }));
  expect(second.destroy).not.toHaveBeenCalledWith(expect.any(Error));
  expect(closeFirst).toHaveBeenCalled(); expect(closeSecond).toHaveBeenCalled();
});

test.each([
  ['authentication failure', () => Promise.reject(Object.assign(new Error('private host and password'), { code: 'EAUTH' }))],
  ['rejected recipient', () => Promise.resolve({ accepted: [], rejected: ['reader@example.test'] })],
])('%s produces a safe error and diagnostic codes without secrets', async (_, sendMail) => {
  const mailer = createMailer({ env, createSocket: socket, createTransport: () => ({ sendMail, close: jest.fn() }) });
  await expect(mailer.sendMail({ to: 'reader@example.test' })).rejects.toMatchObject({ message: 'E-posta şu anda gönderilemiyor. Lütfen biraz sonra tekrar deneyin.', extensions: { code: 'EMAIL_DELIVERY_FAILED' } });
  expect(JSON.stringify(logger.mock.calls)).not.toMatch(/private host|password|reader@example/);
});

test('real Nodemailer can verify and deliver through the cancellable socket on loopback', async () => {
  const sockets = new Set();
  const server = createServer(connection => {
    connection.on('error', () => {});
    sockets.add(connection); connection.on('close', () => sockets.delete(connection));
    connection.write('220 test SMTP\r\n');
    let buffer = '', inMessage = false;
    connection.on('data', chunk => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (inMessage) { if (line === '.') { inMessage = false; connection.write('250 accepted\r\n'); } continue; }
        if (line.startsWith('EHLO')) connection.write('250-test\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH')) connection.write('235 authenticated\r\n');
        else if (line === 'DATA') { inMessage = true; connection.write('354 continue\r\n'); }
        else if (line === 'QUIT') connection.end('221 bye\r\n');
        else connection.write('250 ok\r\n');
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    // Plaintext is allowed ONLY inside this synthetic loopback fixture.
    const mailer = createMailer({ env: { ...env, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port) },
      createTransport: options => nodemailer.createTransport({ ...options, requireTLS: false }) });
    await expect(mailer.verify()).resolves.toBe(true);
    await expect(mailer.sendMail({ from: env.EMAIL_USER, to: 'reader@example.test', subject: 'Synthetic test', text: 'Test only' })).resolves.toMatchObject({ accepted: ['reader@example.test'] });
  } finally {
    for (const connection of sockets) connection.destroy();
    await new Promise(resolve => server.close(resolve));
  }
});
