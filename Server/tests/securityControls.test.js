import { jest } from '@jest/globals';
import express from 'express';
import http from 'node:http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { parse, print, validate, GraphQLError } from 'graphql';
import { OAuth2Client } from 'google-auth-library';
import { once } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { createClient } from 'graphql-ws';
import jwt from 'jsonwebtoken';
import { connect, clearDatabase, closeDatabase } from './db.js';
import schema from '../src/graphql/schema.js';
import models from '../src/models/index.js';
import { checkDocument, checkInputs, queryBudgetRule, graphqlSecurityPlugin } from '../src/security/graphqlSecurity.js';
import { configureHttpSecurity, requestShield, httpError, allowedOrigins, websocketAddress } from '../src/security/httpSecurity.js';
import { websocketOptions } from '../src/security/websocketSecurity.js';
import { consumeRate } from '../src/security/rateLimit.js';
import SecurityRateBucket from '../src/models/securityRateBucket.js';
import { cleanRichText } from '../src/security/richText.js';
import { literalSearch } from '../src/security/search.js';
import formatError from '../src/utils/formatError.js';
import { authenticateUser } from '../src/utils/auth.js';
import { authenticateWithGoogleCredential } from '../src/services/userService.js';
import { clientOperation } from './clientOperations.js';

let server, apollo, wsCleanup, base, wsUrl;
beforeAll(async () => {
  await connect(); await SecurityRateBucket.createIndexes();
  process.env.JWT_SECRET = 'synthetic-http-websocket-signing-secret';
  const app = express(); configureHttpSecurity(app, { NODE_ENV: 'production' });
  app.use(requestShield()); app.use(express.json({ limit: '2mb', inflate: false }));
  server = http.createServer(app);
  wsCleanup = useServer(websocketOptions(schema, models), new WebSocketServer({ server, path: '/graphql', maxPayload: 65536 }));
  apollo = new ApolloServer({ schema, introspection: false, allowBatchedHttpRequests: false, csrfPrevention: true, validationRules: [queryBudgetRule], parseOptions: { maxTokens: 10000 }, plugins: [graphqlSecurityPlugin], includeStacktraceInErrorResponses: false, formatError });
  await apollo.start();
  app.use('/', expressMiddleware(apollo, { context: async ({ req }) => ({ ...models, req, user: await authenticateUser(req, models.User) }) }));
  app.use(httpError);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`; wsUrl = base.replace('http:', 'ws:') + '/graphql';
}, 60000);
afterEach(clearDatabase);
afterAll(async () => { await wsCleanup?.dispose(); await apollo?.stop(); server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
const post = (body, token) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

test('a verified Google login loads the real profile and saved-library documents through the protected HTTP server', async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'synthetic-google-client-id';
  const verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({
    sub: 'synthetic-google-subject', email: 'google-profile@gmail.com', email_verified: true, name: 'Google Profile', nonce: 'a'.repeat(64),
  }) });
  try {
    const { user, token } = await authenticateWithGoogleCredential('synthetic-google-credential', { requireNonce: true });
    const book = await models.Book.create({ authorId: user.id, title: 'Saved digital work', description: 'Synthetic profile fixture.', imageUrl: 'https://example.test/cover.jpg', status: 'WRITING' });
    await models.User.updateOne({ _id: user.id }, { $set: { savedBooks: [book.id] } });
    const request = name => post({ operationName: name, query: print(clientOperation(name)), variables: { id: user.id } }, token).then(response => response.json());
    const profile = await request('GetUserById');
    expect(profile.errors).toBeUndefined();
    expect(profile.data.getUserById).toMatchObject({ id: user.id, fullName: 'Google Profile', usersBooks: [{ id: book.id }] });
    expect(profile.data.getUserById).not.toHaveProperty('savedBooks');
    const library = await request('GetProfileSavedBooks');
    expect(library.errors).toBeUndefined();
    expect(library.data.getUserById).toMatchObject({ id: user.id, savedBooks: [{ id: book.id, title: 'Saved digital work' }] });
  } finally {
    verify.mockRestore();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previousClientId;
  }
});

test('shared rate windows accept only the allowed number of concurrent attempts and hide identities', async () => {
  const results = await Promise.allSettled(Array.from({ length: 30 }, () => consumeRate('synthetic', 'private@example.test', 5, 60000)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(5);
  expect(results.filter(result => result.reason?.extensions?.code === 'RATE_LIMITED')).toHaveLength(25);
  expect(JSON.stringify(await SecurityRateBucket.find().lean())).not.toContain('private@example.test');
  await consumeRate('synthetic', 'private@example.test', 5, 60000, Date.now() + 120000);
});

test('legacy public list queries are bounded and provide stable pagination', async () => {
  await models.User.create(Array.from({ length: 110 }, (_, i) => ({ username: `reader${i}`, fullName: 'Reader', email: `reader${i}@example.test`, password: 'hash' })));
  const first = await (await post({ query: '{ getAllUsers { id } }' })).json();
  expect(first.data.getAllUsers).toHaveLength(100);
  const second = await (await post({ query: '{ getAllUsers(limit:10, offset:100) { id } }' })).json();
  expect(second.data.getAllUsers).toHaveLength(10);
  expect(new Set([...first.data.getAllUsers, ...second.data.getAllUsers].map(user => user.id)).size).toBe(110);
});

test('login alias batching is charged per attempt and a changed alias does not bypass the IP limit', async () => {
  for (let i = 0; i < 10; i++) await post({ query: 'mutation { login(email: "synthetic@example.test", password: "wrong") { token } }' });
  const response = await post({ query: 'mutation { renamed: login(email: "synthetic@example.test", password: "wrong") { token } }' });
  const body = await response.json();
  expect(body.errors.some(error => error.extensions.code === 'RATE_LIMITED')).toBe(true);
});

test('HTTP GraphQL returns security headers, denies batches, introspection and simple GET requests', async () => {
  const response = await post({ query: '{ healthCheck }' });
  expect((await response.json()).data.healthCheck).toContain('running');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-powered-by')).toBeNull();
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('strict-transport-security')).toBe('max-age=31536000');
  expect((await post([{ query: '{ healthCheck }' }, { query: '{ healthCheck }' }])).status).toBeGreaterThanOrEqual(400);
  expect((await (await post({ query: '{ __schema { types { name } } }' })).json()).errors).toBeDefined();
  expect((await fetch(base + '/?query=%7BhealthCheck%7D')).status).toBeGreaterThanOrEqual(400);
});

test('HTTP prevents oversized documents, malformed JSON and compressed body ambiguity', async () => {
  const body = await (await post({ query: '#'.repeat(70000) + '\n{ healthCheck }' })).json();
  expect(body.errors).toBeDefined();
  const malformed = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' });
  expect(malformed.status).toBe(400); expect(await malformed.text()).not.toMatch(/SyntaxError|stack|node_modules/);
  const compressed = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' }, body: '{}' });
  expect(compressed.status).toBe(415);
});

test('depth, aliases, repeated fragments and nested list costs are bounded', () => {
  const aliases = '{' + Array.from({ length: 41 }, (_, i) => `a${i}: healthCheck`).join(' ') + '}';
  expect(validate(schema, parse(aliases), [queryBudgetRule])).not.toHaveLength(0);
  const fragment = 'query { getAllUsers { ...F ...F ...F ...F } } fragment F on User { following { following { following { following { id } } } } }';
  expect(() => checkDocument(schema, parse(fragment))).toThrow();
  const recursive = '{ getAllUsers {' + 'following {'.repeat(13) + 'id' + '}'.repeat(14) + '}';
  expect(() => checkDocument(schema, parse(recursive))).toThrow();
  expect(() => checkDocument(schema, parse('query($n:Int){ getSessions(limit:$n){id} }'), { n: 101 })).toThrow();
  expect(() => checkInputs({ limit: 0 })).toThrow();
  expect(() => checkInputs({ limit: -1 })).toThrow();
  expect(() => checkInputs({ offset: 10001 })).toThrow();
  expect(() => checkInputs(JSON.parse('{"__proto__":{"admin":true}}'))).toThrow();
  expect(() => checkInputs({ ids: Array(501).fill('x') })).toThrow();
});

test('forged forwarded headers cannot bypass the pre-parser request shield', () => {
  const middleware = requestShield({ limit: 1 });
  const response = { set: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() }, next = jest.fn();
  middleware({ ip: '127.0.0.1', headers: { 'x-forwarded-for': '1.1.1.1' } }, response, next);
  middleware({ ip: '127.0.0.1', headers: { 'x-forwarded-for': '2.2.2.2' } }, response, next);
  expect(next).toHaveBeenCalledTimes(1); expect(response.status).toHaveBeenCalledWith(429);
  expect(allowedOrigins({ NODE_ENV: 'production', CLIENT_URL: 'https://client.example.test' }).has('http://localhost:3000')).toBe(false);
  expect(() => allowedOrigins({ NODE_ENV: 'production', CLIENT_URL: 'http://client.example.test' })).toThrow();
});

test('WebSocket upgrades use the HTTP proxy trust policy and preserve distinct clients behind trusted proxies', () => {
  const app = express(); configureHttpSecurity(app, {});
  const request = () => ({ socket: { remoteAddress: '127.0.0.1' }, connection: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '198.51.100.10' } });
  expect(websocketAddress(app, request())).toBe('127.0.0.1');
  configureHttpSecurity(app, { TRUSTED_PROXY_CIDRS: '127.0.0.1/32' });
  expect(websocketAddress(app, request())).toBe('198.51.100.10');
});

test.each([
  '<svg><textarea><img src=x onerror=alert(1)>', '<p onclick=alert(1)>ok</p>',
  '<a href="jav&#x61;script:alert(1)">x</a>', '<img src="data:image/svg+xml;base64,PHN2Zy8+">',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
])('rich text sanitizer rejects executable markup %s', input => {
  expect(cleanRichText(input)).not.toMatch(/onerror|onclick|javascript:|<svg|<math|<script|data:image\/svg/i);
});

test('rich text preserves editor formatting and valid raster embeds; searches treat regex as literal text', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  expect(cleanRichText(`<h2>Title</h2><p class="ql-align-center"><strong>Safe</strong><img src="${png}"></p>`)).toContain(png);
  expect(literalSearch('(a+)+$')).toBe('\\(a\\+\\)\\+\\$');
  expect(() => literalSearch('a'.repeat(121))).toThrow();
});

test('production errors cannot disclose raw exception values or stack traces', () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try {
    const result = formatError({ message: 'mongodb://synthetic-secret', extensions: { code: 'INTERNAL_SERVER_ERROR', stacktrace: ['sensitive stack'] } }, new Error('synthetic-secret'));
    expect(JSON.stringify(result)).not.toMatch(/mongodb|synthetic-secret|sensitive stack/);
    const publicError = new GraphQLError('Safe field error', { extensions: { code: 'BAD_USER_INPUT', stacktrace: ['private'] } });
    expect(formatError(publicError.toJSON(), publicError).extensions.stacktrace).toBeUndefined();
  } finally { process.env.NODE_ENV = old; }
});

test.each(['query { healthCheck }', '{' + Array.from({ length: 41 }, (_, i) => `a${i}: healthCheck`).join(' ') + '}'])('WebSocket rejects alternate-transport query and budget bypass', async query => {
  const client = createClient({ url: wsUrl, webSocketImpl: WebSocket, retryAttempts: 0 });
  try { await expect(client.iterate({ query }).next()).rejects.toBeDefined(); } finally { await client.dispose(); }
});

test('WebSocket rejects invalid credentials and private subscriptions without a code', async () => {
  const user = await models.User.create({ username: 'privateowner', fullName: 'Owner', email: 'private@example.test', password: 'hash' });
  const room = await models.Session.create({ title: 'Private', type: 'PRIVATE', createdBy: user._id, accessCode: 'hash' });
  const reader = await models.User.create({ username: 'privatereader', fullName: 'Reader', email: 'reader@example.test', password: 'hash' });
  const token = jwt.sign({ userId: reader.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  for (const authorization of ['Bearer invalid', `Bearer ${token}`]) {
    const client = createClient({ url: wsUrl, webSocketImpl: WebSocket, retryAttempts: 0, connectionParams: { authorization } });
    try {
      const result = await client.iterate({ query: `subscription { onNewSessionEntry(sessionId:"${room.id}") { content } }` }).next().catch(errors => ({ value: { errors } }));
      expect(result.value.errors).toBeDefined();
      expect(result.value.data).toBeUndefined();
    } finally { await client.dispose(); }
  }
});

test.each(['revoked', 'expired'])('already open subscription streams stop before publishing %s session data', async kind => {
  const user = await models.User.create({ username: 'stream', fullName: 'Stream', email: 'stream@example.test', password: 'hash' });
  const context = { user, authExpiresAt: Date.now() + 60000 };
  const options = websocketOptions(schema, models);
  const result = (async function* () { yield { data: { sensitive: 'first' } }; yield { data: { sensitive: 'must-not-leak' } }; })();
  const guarded = await options.onOperation({}, 'id', {}, { contextValue: context }, result);
  expect((await guarded.next()).value.data.sensitive).toBe('first');
  if (kind === 'revoked') await models.User.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
  else context.authExpiresAt = Date.now() - 1;
  expect((await guarded.next()).done).toBe(true);
});
