const disabledIntegrationKeys = [
  'EMAIL_USER', 'EMAIL_PASS', 'CONTACT_EMAIL', 'GOOGLE_CLIENT_ID',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
];

export function assertDockerDevelopment(env = process.env) {
  const invalid = () => { throw Object.assign(new Error('Docker development requires its isolated local configuration.'), { code: 'DOCKER_DEV_CONFIG_INVALID' }); };
  if (env.NODE_ENV !== 'development') invalid();
  let uri;
  try { uri = new URL(env.MONGO_URI); } catch { invalid(); }
  if (uri.protocol !== 'mongodb:' || uri.hostname !== 'mongo' || uri.port !== '27017'
    || uri.pathname !== '/betik_dev' || uri.username || uri.password
    || uri.searchParams.get('replicaSet') !== 'rs0') invalid();
  if (env.PRINT_PAYMENTS_MODE !== 'SANDBOX' || env.PRINT_SYSTEM_ENABLED !== 'true') invalid();
  if (env.IYZICO_API_KEY || env.IYZICO_SECRET_KEY || env.IYZICO_BASE_URL) invalid();
  return true;
}

export function configureDockerDevelopment(env = process.env) {
  assertDockerDevelopment(env);
  if (env.DEV_EXTERNAL_INTEGRATIONS !== 'true') {
    for (const key of disabledIntegrationKeys) delete env[key];
  }
  if (env.GOOGLE_CLIENT_ID === '620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com') delete env.GOOGLE_CLIENT_ID;
}
