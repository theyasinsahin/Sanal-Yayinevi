import { validateServerEnvironment, startupFailure } from '../src/config/startup.js';

const valid = { MONGO_URI: 'mongodb://127.0.0.1:27017/betik_test', JWT_SECRET: 'synthetic-startup-secret-at-least-32-bytes', CLIENT_URL: 'http://localhost:3000' };

test('startup rejects missing database and signing key together without disclosing values', () => {
  try {
    validateServerEnvironment({ MONGO_URI: 'https://private:password@db.example.test', JWT_SECRET: 'short-private-key' });
    throw new Error('Invalid configuration was accepted');
  } catch (error) {
    expect(error.code).toBe('STARTUP_CONFIG_INVALID');
    expect(error.message).toMatch(/MONGO_URI/);
    expect(error.message).toMatch(/JWT_SECRET/);
    expect(JSON.stringify(startupFailure(error))).not.toMatch(/password|private|db\.example/);
  }
  expect(() => validateServerEnvironment({})).toThrow(/MONGO_URI/);
});

test.each(['-1', '0', '65536', '5000pipe', 'NaN', '3.14'])('startup rejects invalid TCP port %s', PORT => {
  expect(() => validateServerEnvironment({ ...valid, PORT })).toThrow(/PORT/);
});

test('startup returns a numeric port and enforces production origins before connecting', () => {
  expect(validateServerEnvironment(valid)).toEqual({ port: 5000 });
  expect(validateServerEnvironment({ ...valid, PORT: '5125' })).toEqual({ port: 5125 });
  expect(() => validateServerEnvironment({ ...valid, NODE_ENV: 'production', CLIENT_URL: '' })).toThrow(/CLIENT_URL/);
  expect(() => validateServerEnvironment({ ...valid, CLIENT_URL: 'http://localhost:3000/login' })).toThrow(/origin/);
  expect(() => validateServerEnvironment({ ...valid, CORS_ALLOWED_ORIGINS: 'not-a-url' })).toThrow(/origin/);
  expect(() => validateServerEnvironment({ ...valid, NODE_ENV: 'production' })).toThrow(/HTTPS/);
});

test('nested MongoDB authentication failures retain their category without leaking the driver message', () => {
  const error = Object.assign(new Error('mongodb://secret:password@private-host'), {
    name: 'MongooseServerSelectionError',
    reason: { servers: new Map([['private-host', { error: Object.assign(new Error('secret'), { cause: { code: 18 } }) }]]) },
  });
  expect(startupFailure(error).code).toBe('MONGO_AUTH_FAILED');
  expect(JSON.stringify(startupFailure(error))).not.toMatch(/secret|password|private-host/);
});

test('Atlas code 8000 reports bad authentication without exposing credentials', () => {
  const error = Object.assign(new Error('bad auth : authentication failed mongodb://private-user:private-password@private-host'), { name: 'MongoServerError', code: 8000, codeName: 'AtlasError' });
  expect(startupFailure(error).code).toBe('MONGO_AUTH_FAILED');
  expect(JSON.stringify(startupFailure(error))).not.toMatch(/private-user|private-password|private-host/);
  const wrapped = { name: 'MongooseServerSelectionError', reason: { servers: new Map([['private-host', { error }]]) } };
  expect(startupFailure(wrapped).code).toBe('MONGO_AUTH_FAILED');
  expect(startupFailure(Object.assign(new Error('unrelated Atlas failure'), { code: 8000 })).code).toBe('STARTUP_FAILED');
});

test.each([
  [{ code: 'EADDRINUSE' }, 'PORT_IN_USE'],
  [{ code: 'ECONNREFUSED' }, 'MONGO_UNREACHABLE'],
  [{ code: 'ENOTFOUND' }, 'MONGO_UNREACHABLE'],
  [{ name: 'MongoParseError' }, 'MONGO_URI_INVALID'],
  [{ name: 'MongooseServerSelectionError', cause: { code: 'CERT_HAS_EXPIRED' } }, 'MONGO_TLS_FAILED'],
  [{ extensions: { code: 'PRINT_STORAGE_UNAVAILABLE' } }, 'MONGO_REPLICA_SET_REQUIRED'],
  [{ code: 11000 }, 'MONGO_INDEX_CONFLICT'],
  [new Error('private-value'), 'STARTUP_FAILED'],
])('startup failures have an actionable safe category', (error, code) => {
  expect(startupFailure(error).code).toBe(code);
  expect(JSON.stringify(startupFailure(error))).not.toContain('private-value');
});
