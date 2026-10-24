import { jest } from '@jest/globals';

const sendMail = jest.fn().mockResolvedValue({ accepted: ['reader@example.test'] });
const findOne = jest.fn();
const findOneAndUpdate = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('../src/config/smtp.js', () => ({ default: { sendMail } }));
jest.unstable_mockModule('../src/models/user.js', () => ({ default: { findOne } }));
jest.unstable_mockModule('../src/models/verification.js', () => ({ default: { findOneAndUpdate } }));
jest.unstable_mockModule('../src/services/bookService.js', () => ({}));
jest.unstable_mockModule('../src/services/sessionService.js', () => ({}));
jest.unstable_mockModule('bcryptjs', () => ({ default: { compare: jest.fn().mockResolvedValue(true) } }));
const { sendRegistrationCode, forgotPassword, changeEmail } = await import('../src/services/userService.js');

beforeEach(() => {
  sendMail.mockClear(); findOne.mockReset(); findOneAndUpdate.mockClear();
  process.env.CLIENT_URL = 'https://example.test';
  process.env.EMAIL_USER = 'sender@example.test';
});
test('registration flow sends the persisted code using the branded template', async () => {
  findOne.mockResolvedValue(null);
  await sendRegistrationCode('reader@example.test', 'Deniz');
  const code = findOneAndUpdate.mock.calls[0][1].code;
  expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'reader@example.test', from: { name: 'Betik', address: 'sender@example.test' } });
  expect(sendMail.mock.calls[0][0].html).toContain(code);
  expect(sendMail.mock.calls[0][0].text).toContain(code);
});
test('password reset sends the saved token with HTML and text', async () => {
  const user = { save: jest.fn() }; findOne.mockResolvedValue(user);
  await forgotPassword('reader@example.test');
  const url = `https://example.test/reset-password/${user.resetPasswordToken}`;
  expect(sendMail.mock.calls[0][0].html).toContain(url);
  expect(sendMail.mock.calls[0][0].text).toContain(url);
  expect(user.save).toHaveBeenCalledTimes(1);
});
test('address change sends the branded account notification to the new address', async () => {
  findOne.mockResolvedValueOnce({ save: jest.fn(), password: 'hash' }).mockResolvedValueOnce(null);
  await changeEmail('user-id', { newEmail: 'new@example.test', currentPassword: 'test-only' });
  expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'new@example.test', subject: 'Betik · E-posta adresin güncellendi' });
  expect(sendMail.mock.calls[0][0].html).toContain('Yeni adresinle yolculuğa devam.');
  expect(sendMail.mock.calls[0][0].text).toContain('e-posta adresi başarıyla güncellendi');
});
