import { jest } from '@jest/globals';

const sendMail = jest.fn().mockResolvedValue({ accepted: ['recipient@example.test'] });
const verify = jest.fn().mockResolvedValue(true);
const createTransport = jest.fn(() => ({ sendMail, verify }));
jest.unstable_mockModule('nodemailer', () => ({ default: { createTransport } }));
const { default: mailer, mailSettings, contactRecipient } = await import('../src/config/smtp.js');

test('mail transport is lazy and preserves existing EMAIL credentials', async () => {
  expect(createTransport).not.toHaveBeenCalled();
  const previousUser = process.env.EMAIL_USER;
  const previousPass = process.env.EMAIL_PASS;
  process.env.EMAIL_USER = 'sender@example.test'; process.env.EMAIL_PASS = 'test-only';
  try {
    await mailer.verify();
    await mailer.sendMail({ to: 'recipient@example.test', text: 'Test' });
    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport.mock.calls[0][0]).toMatchObject({ service: 'gmail', auth: { user: 'sender@example.test', pass: 'test-only' }, socketTimeout: 30000 });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith({ to: 'recipient@example.test', text: 'Test' });
  } finally {
    if (previousUser === undefined) delete process.env.EMAIL_USER; else process.env.EMAIL_USER = previousUser;
    if (previousPass === undefined) delete process.env.EMAIL_PASS; else process.env.EMAIL_PASS = previousPass;
  }
});
test('missing or malformed credentials fail before opening a connection', () => {
  expect(() => mailSettings({})).toThrow();
  expect(() => mailSettings({ EMAIL_USER: 'invalid', EMAIL_PASS: 'test' })).toThrow();
});
test('contact uses configured recipient or existing sender mailbox', () => {
  expect(contactRecipient({ EMAIL_USER: 'sender@example.test' })).toBe('sender@example.test');
  expect(contactRecipient({ EMAIL_USER: 'sender@example.test', CONTACT_EMAIL: 'contact@example.test' })).toBe('contact@example.test');
  expect(() => contactRecipient({ EMAIL_USER: 'sender@example.test', CONTACT_EMAIL: 'invalid' })).toThrow();
});
