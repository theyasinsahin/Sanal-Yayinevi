const original = { ...process.env };
afterEach(() => { process.env = { ...original }; jest.resetModules(); });

test('Docker does not fall back to production integrations', () => {
  jest.resetModules();
  process.env.REACT_APP_DOCKER_DEV = 'true';
  delete process.env.REACT_APP_DEV_INTEGRATIONS;
  delete process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const integrations = require('./integrations');
  expect(integrations.DOCKER_DEV).toBe(true);
  expect(integrations.GOOGLE_LOGIN_ENABLED).toBe(false);
  expect(integrations.IMAGE_UPLOAD_ENABLED).toBe(false);
});

test.each([
  ['synthetic-development-client', 'synthetic-development-cloud'],
  ['620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com', 'dw1sepw7z'],
])('manually enabled Docker integrations preserve configured identifiers: %s', (client, cloud) => {
  jest.resetModules();
  Object.assign(process.env, { REACT_APP_DOCKER_DEV: 'true', REACT_APP_DEV_INTEGRATIONS: 'true',
    REACT_APP_GOOGLE_CLIENT_ID: client, REACT_APP_CLOUDINARY_CLOUD_NAME: cloud,
    REACT_APP_CLOUDINARY_UPLOAD_PRESET: 'synthetic-development-preset' });
  const integrations = require('./integrations');
  expect(integrations.GOOGLE_CLIENT_ID).toBe(client);
  expect(integrations.CLOUDINARY.cloudName).toBe(cloud);
  expect(integrations.IMAGE_UPLOAD_ENABLED).toBe(true);
});

test('production retains the existing integration defaults without Docker flags', () => {
  jest.resetModules();
  for (const key of ['REACT_APP_DOCKER_DEV', 'REACT_APP_DEV_INTEGRATIONS', 'REACT_APP_GOOGLE_CLIENT_ID',
    'REACT_APP_CLOUDINARY_CLOUD_NAME', 'REACT_APP_CLOUDINARY_UPLOAD_PRESET']) delete process.env[key];
  const integrations = require('./integrations');
  expect(integrations.DOCKER_DEV).toBe(false);
  expect(integrations.GOOGLE_CLIENT_ID).toBe('620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com');
  expect(integrations.CLOUDINARY).toEqual({ cloudName: 'dw1sepw7z', uploadPreset: 'quill_preset' });
  expect(integrations.IMAGE_UPLOAD_ENABLED).toBe(true);
});
