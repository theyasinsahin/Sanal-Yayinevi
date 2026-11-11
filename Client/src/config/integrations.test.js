const original = { ...process.env };
afterEach(() => { process.env = { ...original }; jest.resetModules(); });

test('Docker does not fall back to production integrations', () => {
  jest.resetModules();
  process.env.REACT_APP_DOCKER_DEV = 'true';
  delete process.env.REACT_APP_DEV_INTEGRATIONS;
  delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const integrations = require('./integrations');
  expect(integrations.GOOGLE_LOGIN_ENABLED).toBe(false);
  expect(integrations.IMAGE_UPLOAD_ENABLED).toBe(false);
});

test('manual Docker integrations use only explicitly supplied development identifiers', () => {
  jest.resetModules();
  Object.assign(process.env, { REACT_APP_DOCKER_DEV: 'true', REACT_APP_DEV_INTEGRATIONS: 'true',
    REACT_APP_GOOGLE_CLIENT_ID: 'synthetic-development-client', REACT_APP_CLOUDINARY_CLOUD_NAME: 'synthetic-development-cloud',
    REACT_APP_CLOUDINARY_UPLOAD_PRESET: 'synthetic-development-preset' });
  const integrations = require('./integrations');
  expect(integrations.GOOGLE_CLIENT_ID).toBe('synthetic-development-client');
  expect(integrations.IMAGE_UPLOAD_ENABLED).toBe(true);
});
