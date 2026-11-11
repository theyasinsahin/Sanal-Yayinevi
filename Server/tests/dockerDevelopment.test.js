import { assertDockerDevelopment, configureDockerDevelopment } from '../src/config/dockerDevelopment.js';

const valid = () => ({
  NODE_ENV: 'development', MONGO_URI: 'mongodb://mongo:27017/betik_dev?replicaSet=rs0',
  PRINT_SYSTEM_ENABLED: 'true', PRINT_PAYMENTS_MODE: 'SANDBOX',
});

test('Docker development accepts only its isolated database and payment simulation', () => {
  expect(assertDockerDevelopment(valid())).toBe(true);
});

test.each([
  'mongodb+srv://private:secret@private.example/betik_dev',
  'mongodb://localhost:27017/betik_dev?replicaSet=rs0',
  'mongodb://mongo:27017/production?replicaSet=rs0',
  'mongodb://mongo:27017/betik_dev',
  'mongodb://private:secret@mongo:27017/betik_dev?replicaSet=rs0',
])('unsafe Docker database configuration is rejected without leaking the URI', MONGO_URI => {
  try {
    assertDockerDevelopment({ ...valid(), MONGO_URI });
    throw new Error('Unsafe configuration accepted');
  } catch (error) {
    expect(error.code).toBe('DOCKER_DEV_CONFIG_INVALID');
    expect(error.message).not.toContain(MONGO_URI);
    expect(error.message).not.toMatch(/private|secret/);
  }
});

test('production mode and external payment keys are rejected', () => {
  expect(() => assertDockerDevelopment({ ...valid(), NODE_ENV: 'production' })).toThrow();
  expect(() => assertDockerDevelopment({ ...valid(), IYZICO_API_KEY: 'synthetic' })).toThrow();
});

test('a legacy production Google client is disabled without blocking local reading', () => {
  const env = { ...valid(), DEV_EXTERNAL_INTEGRATIONS: 'true',
    GOOGLE_CLIENT_ID: '620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com' };
  expect(() => configureDockerDevelopment(env)).not.toThrow();
  expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
});

test('external credentials are removed unless manually enabled', () => {
  const disabled = { ...valid(), EMAIL_USER: 'test@example.test', EMAIL_PASS: 'synthetic', GOOGLE_CLIENT_ID: 'synthetic' };
  configureDockerDevelopment(disabled);
  expect(disabled.EMAIL_PASS).toBeUndefined();
  expect(disabled.GOOGLE_CLIENT_ID).toBeUndefined();
  const enabled = { ...valid(), DEV_EXTERNAL_INTEGRATIONS: 'true', EMAIL_PASS: 'synthetic' };
  configureDockerDevelopment(enabled);
  expect(enabled.EMAIL_PASS).toBe('synthetic');
});
