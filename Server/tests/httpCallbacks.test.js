import { jest } from '@jest/globals';
import express from 'express';
import { once } from 'node:events';

const authenticate = jest.fn();
jest.unstable_mockModule('../src/services/userService.js', () => ({ authenticateWithGoogleCredential: authenticate }));
const { default: googleRoutes } = await import('../src/routes/googleAuthRoutes.js');
const { default: paymentRoutes } = await import('../src/routes/paymentRoutes.js');
let server, baseUrl;
const previousClientUrl = process.env.CLIENT_URL;
beforeAll(async () => {
  process.env.CLIENT_URL = 'https://client.example.test';
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use('/auth/google', googleRoutes);
  app.use('/payment', paymentRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (previousClientUrl === undefined) delete process.env.CLIENT_URL;
  else process.env.CLIENT_URL = previousClientUrl;
});
beforeEach(() => authenticate.mockReset());
afterEach(() => jest.restoreAllMocks());
const post = (path, values = {}) => fetch(`${baseUrl}${path}`, { method: 'POST', redirect: 'manual', body: new URLSearchParams(values) });

test('a missing Google credential returns to login without invoking authentication', async () => {
  const result = await post('/auth/google/callback');
  expect(result.status).toBe(302);
  expect(result.headers.get('location')).toBe('https://client.example.test/login?error=google_no_credential');
  expect(authenticate).not.toHaveBeenCalled();
});
test('a verified callback forwards only the allowed public session fields', async () => {
  authenticate.mockResolvedValue({ token: 'test-jwt', user: { _id: 'user', username: 'reader', fullName: 'Türkçe + İsim', email: 'reader@test.com', role: 'USER', isPremium: false, profilePicture: '', password: 'secret-hash', passwordResetToken: 'private-reset-token' } });
  const result = await post('/auth/google/callback', { credential: 'verified-credential' });
  expect(result.status).toBe(302);
  expect(authenticate).toHaveBeenCalledWith('verified-credential');
  const location = new URL(result.headers.get('location'));
  expect(location.pathname).toBe('/auth/callback');
  expect(location.searchParams.get('token')).toBe('test-jwt');
  const user = JSON.parse(location.searchParams.get('user'));
  expect(user).toMatchObject({ id: 'user', fullName: 'Türkçe + İsim', role: 'USER' });
  expect(user.password).toBeUndefined();
  expect(user.passwordResetToken).toBeUndefined();
});
test.each(['Google rejected', 'ACCOUNT_DELETED'])('Google authentication failure %s redirects safely', async message => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  authenticate.mockRejectedValue(new Error(message));
  const result = await post('/auth/google/callback', { credential: 'invalid' });
  expect(result.status).toBe(302);
  expect(result.headers.get('location')).toBe('https://client.example.test/login?error=google_auth_failed');
});
test('legacy payment callbacks explicitly return gone and never process a posted payment', async () => {
  const result = await post('/payment/callback', { token: 'legacy-provider-token', status: 'SUCCESS' });
  expect(result.status).toBe(410);
  expect(await result.json()).toMatchObject({ error: 'LEGACY_PAYMENT_DISABLED' });
});
