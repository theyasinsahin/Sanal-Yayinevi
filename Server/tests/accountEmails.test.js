import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';

const sendMail = jest.fn().mockResolvedValue({ accepted: ['reader@example.test'] });
const findOne = jest.fn();
const findOneAndUpdate = jest.fn().mockResolvedValue(null);
const updateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
const updateVerification = jest.fn().mockResolvedValue({ modifiedCount: 1 });
const deleteVerification = jest.fn().mockResolvedValue({ deletedCount: 1 });
jest.unstable_mockModule('../src/config/smtp.js', () => ({ default: { sendMail } }));
jest.unstable_mockModule('../src/models/user.js', () => ({ default: { findOne, updateOne } }));
jest.unstable_mockModule('../src/models/verification.js', () => ({ default: { findOneAndUpdate, updateOne: updateVerification, deleteOne: deleteVerification } }));
jest.unstable_mockModule('../src/services/bookService.js', () => ({}));
jest.unstable_mockModule('../src/services/sessionService.js', () => ({}));
jest.unstable_mockModule('../src/services/recommendationService.js', () => ({ saveUserPreference: jest.fn() }));
jest.unstable_mockModule('bcryptjs', () => ({ default: { compare: jest.fn().mockResolvedValue(true), hash: jest.fn(code => Promise.resolve(`synthetic-bcrypt-hash:${code}`)) } }));
const { sendRegistrationCode, forgotPassword, changeEmail } = await import('../src/services/userService.js');

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ accepted: ['reader@example.test'] }); findOne.mockReset(); findOneAndUpdate.mockReset().mockResolvedValue(null);
  updateOne.mockClear(); updateVerification.mockClear(); deleteVerification.mockClear();
  process.env.CLIENT_URL = 'https://example.test';
  process.env.EMAIL_USER = 'sender@example.test';
});
test('a failed reset resend restores the prior link using a compare-and-set filter', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const previousReset = { resetPasswordToken: 'old-hash', resetPasswordExpires: new Date('2099-01-01') };
  findOne.mockResolvedValue({ _id: 'reader', save: jest.fn(), ...previousReset });
  sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
  await expect(forgotPassword('reader@example.test')).resolves.toHaveProperty('code', 200);
  expect(updateOne).toHaveBeenCalledWith({ _id: 'reader', resetPasswordToken: expect.stringMatching(/^[a-f0-9]{64}$/) }, { $set: previousReset });
  jest.restoreAllMocks();
});
test('a failed code resend preserves the previous code and never overwrites a newer concurrent request', async () => {
  findOne.mockResolvedValue(null);
  const previous = { code: 'previous-hash', attempts: 2, createdAt: new Date() };
  findOneAndUpdate.mockResolvedValueOnce(previous);
  sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
  await expect(sendRegistrationCode('reader@example.test', 'Deniz')).rejects.toThrow('SMTP unavailable');
  expect(updateVerification).toHaveBeenCalledWith({ email: 'reader@example.test', code: expect.stringMatching(/^synthetic-bcrypt-hash:/) }, { $set: previous });
});
test('a failed initial code delivery removes only that undelivered code', async () => {
  findOne.mockResolvedValue(null); sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
  await expect(sendRegistrationCode('reader@example.test', 'Deniz')).rejects.toThrow();
  expect(deleteVerification).toHaveBeenCalledWith({ email: 'reader@example.test', code: expect.stringMatching(/^synthetic-bcrypt-hash:/) });
});
test('registration flow sends the persisted code using the branded template', async () => {
  findOne.mockResolvedValue(null);
  await sendRegistrationCode('reader@example.test', 'Deniz');
  const code = sendMail.mock.calls[0][0].text.match(/\b\d{6}\b/)[0];
  expect(findOneAndUpdate.mock.calls[0][1].code).toBe(`synthetic-bcrypt-hash:${code}`);
  expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'reader@example.test', from: { name: 'Betik', address: 'sender@example.test' } });
  expect(sendMail.mock.calls[0][0].html).toContain(code);
  expect(sendMail.mock.calls[0][0].text).toContain(code);
});
test('password reset sends the saved token with HTML and text', async () => {
  const user = { save: jest.fn() }; findOne.mockResolvedValue(user);
  await forgotPassword('reader@example.test');
  const token = sendMail.mock.calls[0][0].text.match(/reset-password\/([a-f0-9]{64})/)[1];
  const url = `https://example.test/reset-password/${token}`;
  expect(user.resetPasswordToken).toBe(createHash('sha256').update(token).digest('hex'));
  expect(sendMail.mock.calls[0][0].html).toContain(url);
  expect(sendMail.mock.calls[0][0].text).toContain(url);
  expect(user.save).toHaveBeenCalledTimes(1);
});
test('address change sends the branded account notification to the new address', async () => {
  findOne.mockResolvedValueOnce({ save: jest.fn(), password: 'hash', email: 'old@example.test' }).mockResolvedValueOnce(null);
  await changeEmail('user-id', { newEmail: 'new@example.test', currentPassword: 'test-only' });
  expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'new@example.test', subject: 'Betik · E-posta adresin güncellendi' });
  expect(sendMail.mock.calls[0][0].html).toContain('Yeni adresinle yolculuğa devam.');
  expect(sendMail.mock.calls[0][0].text).toContain('e-posta adresi başarıyla güncellendi');
});
