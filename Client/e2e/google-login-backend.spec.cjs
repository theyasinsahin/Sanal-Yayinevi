const { test, expect } = require('@playwright/test');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const serverDirectory = path.resolve(__dirname, '../../Server');
const serverRequire = createRequire(path.join(serverDirectory, 'package.json'));
const serverImport = relative => import(pathToFileURL(path.join(serverDirectory, relative)).href);

let database, mongoose, server, apollo, cleanupWs, restoreGoogle;
const operations = [], failures = [];
test.beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'synthetic-google-browser-signing-secret-only';
  process.env.GOOGLE_CLIENT_ID = 'synthetic-browser-client';
  process.env.CLIENT_URL = 'http://127.0.0.1:3100';
  const { MongoMemoryReplSet } = serverRequire('mongodb-memory-server');
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGO_URI = database.getUri();
  mongoose = serverRequire('mongoose');
  await mongoose.connect(process.env.MONGO_URI);
  const { OAuth2Client } = serverRequire('google-auth-library');
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => ({ getPayload: () => ({
    sub: 'synthetic-browser-google-subject', email: 'google-browser@gmail.com', email_verified: true,
    name: 'Google Tarayıcı Okuru', nonce: idToken.slice('synthetic-google:'.length),
  }) });
  restoreGoogle = () => { OAuth2Client.prototype.verifyIdToken = originalVerify; };
  const previousDirectory = process.cwd();
  let schema;
  try {
    process.chdir(serverDirectory);
    schema = (await serverImport('src/graphql/schema.js')).default;
  } finally { process.chdir(previousDirectory); }
  const models = (await serverImport('src/models/index.js')).default;
  const { authenticateUser } = await serverImport('src/utils/auth.js');
  const { createLoaders } = await serverImport('src/graphql/loaders.js');
  const { default: googleRoutes } = await serverImport('src/routes/googleAuthRoutes.js');
  const { default: formatError } = await serverImport('src/utils/formatError.js');
  const { graphqlSecurityPlugin, queryBudgetRule } = await serverImport('src/security/graphqlSecurity.js');
  const { websocketOptions } = await serverImport('src/security/websocketSecurity.js');
  const express = serverRequire('express'), cors = serverRequire('cors');
  const { ApolloServer } = serverRequire('@apollo/server');
  const { expressMiddleware } = serverRequire('@as-integrations/express4');
  const { WebSocketServer } = serverRequire('ws');
  const { useServer } = serverRequire('graphql-ws/use/ws');
  const app = express();
  app.use(cors({ origin: 'http://127.0.0.1:3100' }));
  app.use(express.urlencoded({ extended: false })); app.use(express.json());
  app.use('/auth/google', googleRoutes);
  server = serverRequire('node:http').createServer(app);
  cleanupWs = useServer(websocketOptions(schema, models), new WebSocketServer({ server, path: '/graphql' }));
  apollo = new ApolloServer({ schema, validationRules: [queryBudgetRule], plugins: [graphqlSecurityPlugin],
    formatError(formatted, error) { failures.push({ message: formatted.message, code: formatted.extensions?.code }); return formatError(formatted, error); } });
  await apollo.start();
  app.use('/', (req, res, next) => { operations.push(req.body?.operationName); next(); }, expressMiddleware(apollo, {
    context: async ({ req }) => ({ ...models, req, user: await authenticateUser(req, models.User), loaders: createLoaders() }),
  }));
  await new Promise(resolve => server.listen(5001, '127.0.0.1', resolve));
});
test.afterAll(async () => {
  restoreGoogle?.();
  await cleanupWs?.dispose(); await apollo?.stop();
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose?.connection.readyState) { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); }
  await database?.stop();
});

test('Google form callback stays logged in with real HTTP, WebSocket and ephemeral MongoDB', async ({ page, context }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' && ['3100', '5001'].includes(url.port) ? route.continue() : route.abort();
  });
  await page.goto('/login');
  const nonce = await page.evaluate(() => JSON.parse(sessionStorage.getItem('betik:google-login-nonce')).nonce);
  const csrf = 'synthetic-browser-google-csrf-token';
  await context.addCookies([{ name: 'g_csrf_token', value: csrf, url: 'http://127.0.0.1:5001' }]);
  await page.evaluate(({ nonce, csrf }) => {
    const form = document.createElement('form'); form.method = 'POST'; form.action = 'http://127.0.0.1:5001/auth/google/callback';
    for (const [name, value] of Object.entries({ credential: `synthetic-google:${nonce}`, g_csrf_token: csrf })) {
      const input = document.createElement('input'); input.name = name; input.value = value; form.append(input);
    }
    document.body.append(form); form.submit();
  }, { nonce, csrf });
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Google Tarayıcı Okuru', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Google Tarayıcı Okuru', exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.getByRole('button', { name: 'Dijital Kitaplık' }).click();
  await expect.poll(() => operations.includes('GetProfileSavedBooks')).toBe(true);
  expect(operations).not.toContain('Logout');
  expect(failures).toEqual([]);
  expect(await page.evaluate(() => Boolean(localStorage.getItem('token')))).toBe(true);
});
