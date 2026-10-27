import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { ApolloServer } from '@apollo/server';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import User from '../src/models/user.js';
import Session from '../src/models/session.js';
import AdminAudit from '../src/models/adminAudit.js';
import * as access from '../src/services/sessionAccessService.js';
import { createSession } from '../src/services/sessionService.js';
import { saveAdminRecord, getAdminRecord, getAdminOverview } from '../src/services/adminService.js';

const source = readFileSync(new URL('../../Client/src/graphql/sessionAccess.js', import.meta.url), 'utf8');
const body = name => source.split(`const ${name} = gql\``)[1].split('`;')[0];
const document = name => body(name).replace('${ACCESS_FIELDS}', body('ACCESS_FIELDS'));
let api, admin, user;
const context = () => ({ user });
const adminContext = () => ({ user: admin });
const reason = 'Kitaplar üzerine haftalık yazı oturumları düzenlemek istiyorum.';
const request = () => access.requestSessionAccess(context(), reason);
const review = (revision, approve = true, note = '') => access.reviewSessionAccess(adminContext(), { userId: user.id, revision, approve, note });
async function run(name, variables = {}, actor = user) {
  const response = await api.executeOperation({ query: document(name), variables }, { contextValue: { user: actor } });
  return response.body.singleResult;
}
beforeAll(async () => { await connect(); await Promise.all([User.init(), Session.init(), AdminAudit.init()]); api = new ApolloServer({ schema }); await api.start(); }, 60000);
afterAll(async () => { await api.stop(); await closeDatabase(); });
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [admin, user] = await User.create([
    { username: 'admin', fullName: 'Yönetici', email: 'admin@test.example', password: 'hash', role: 'ADMIN' },
    { username: 'member', fullName: 'Üye', email: 'member@test.example', password: 'hash' },
  ]);
});

test('legacy premium flag does not confer permission and no migration is required', async () => {
  await User.collection.updateOne({ _id: user._id }, { $unset: { sessionCreationAccess: 1 }, $set: { isPremium: true } });
  const result = await run('MY_SESSION_ACCESS');
  expect(result.errors).toBeUndefined(); expect(result.data.mySessionCreationAccess.status).toBe('NONE');
  await expect(createSession(user.id, { title: 'Ücretli ama izinsiz', type: 'OPEN' })).rejects.toThrow('yönetici onaylı');
  expect((await request()).status).toBe('PENDING');
});

test('actual client documents cover request, admin queue, approval and free session creation', async () => {
  const requested = await run('REQUEST_SESSION_ACCESS', { reason });
  expect(requested.errors).toBeUndefined(); const item = requested.data.requestSessionCreationAccess;
  expect(item).toMatchObject({ status: 'PENDING', reason, revision: 1, user: { id: user.id } });
  const queue = await run('SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 1 }, admin);
  expect(queue.errors).toBeUndefined(); expect(queue.data.sessionAccessRequests).toMatchObject({ total: 1, totalPages: 1 });
  expect((await getAdminOverview(adminContext())).pendingSessionAccess).toBe(1);
  await expect(createSession(user.id, { title: 'Bekliyor', type: 'OPEN' })).rejects.toThrow('yönetici onaylı');
  const approved = await run('REVIEW_SESSION_ACCESS', { userId: user.id, revision: item.revision, approve: true, note: 'Uygun bulundu.' }, admin);
  expect(approved.errors).toBeUndefined(); expect(approved.data.reviewSessionCreationAccess.status).toBe('APPROVED');
  expect((await run('MY_SESSION_ACCESS')).data.mySessionCreationAccess.status).toBe('APPROVED');
  expect((await createSession(user.id, { title: 'Ücretsiz oturum', type: 'OPEN' })).title).toBe('Ücretsiz oturum');
  expect((await User.findById(user.id)).isPremium).toBe(false);
  expect((await AdminAudit.findOne({ recordId: user.id })).action).toBe('SESSION_ACCESS_APPROVE');
});

test('duplicate and concurrent requests preserve one request and its original reason', async () => {
  await Promise.all([request(), request()]);
  const first = await access.getMySessionAccess(context());
  expect(first.revision).toBe(1);
  const duplicate = await access.requestSessionAccess(context(), 'Başka bir açıklamayla yinelenen başvuru.');
  expect(duplicate).toMatchObject({ revision: 1, reason });
  await review(1);
  expect((await request()).status).toBe('APPROVED');
});

test('rejection requires a reason, permits a new request and stale decisions cannot overwrite it', async () => {
  await request();
  await expect(review(1, false)).rejects.toThrow('gerekçesi');
  expect((await review(1, false, 'Açıklamanızı detaylandırın.')).status).toBe('REJECTED');
  expect((await request()).revision).toBe(3);
  await expect(review(1)).rejects.toThrow('Başvuru değişmiş');
  expect((await access.getMySessionAccess(context())).status).toBe('PENDING');
});

test('revoking permission blocks new sessions immediately without closing existing ones', async () => {
  await request(); await review(1);
  const existing = await createSession(user.id, { title: 'Mevcut oturum', type: 'OPEN' });
  await review(2, false, 'Oturum oluşturma izni kaldırıldı.');
  await expect(createSession(user.id, { title: 'Yetki kaldırıldı', type: 'OPEN' })).rejects.toThrow('yönetici onaylı');
  expect((await Session.findById(existing.id)).isActive).toBe(true);
  expect(await AdminAudit.countDocuments({ action: 'SESSION_ACCESS_REVOKE' })).toBe(1);
});

test('two reviewers cannot apply conflicting decisions to the same revision', async () => {
  await request();
  const results = await Promise.allSettled([review(1), review(1, false, 'Uygun bulunmadı.')]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(await AdminAudit.countDocuments({ recordId: user.id })).toBe(1);
});

test('audit failure rolls back the permission change', async () => {
  await request();
  jest.spyOn(AdminAudit, 'create').mockRejectedValue(new Error('audit unavailable'));
  await expect(review(1)).rejects.toThrow('audit unavailable');
  expect((await access.getMySessionAccess(context())).status).toBe('PENDING');
});

test.each([null, 'member', 'forged', 'demoted', 'inactive'])('queue and review require a current active admin: %s', async kind => {
  await request();
  let actor = kind === null ? null : kind === 'member' ? user : kind === 'forged' ? { _id: user._id, role: 'ADMIN' } : admin;
  if (kind === 'demoted') await User.updateOne({ _id: admin._id }, { role: 'USER' });
  if (kind === 'inactive') await User.updateOne({ _id: admin._id }, { isActive: false });
  for (const [name, variables] of [['SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 1 }], ['REVIEW_SESSION_ACCESS', { userId: user.id, revision: 1, approve: true }]]) {
    expect((await run(name, variables, actor)).errors?.[0].extensions.code).toBe('FORBIDDEN');
  }
});

test('anonymous or disabled accounts cannot read or submit a request', async () => {
  expect((await run('MY_SESSION_ACCESS', {}, null)).errors[0].extensions.code).toBe('UNAUTHENTICATED');
  expect((await run('REQUEST_SESSION_ACCESS', { reason }, null)).errors[0].extensions.code).toBe('UNAUTHENTICATED');
  await User.updateOne({ _id: user._id }, { isActive: false });
  await expect(request()).rejects.toThrow('Giriş yapmalısınız');
});

test('inactive/deleted accounts cannot be approved or create sessions', async () => {
  await request(); await review(1);
  await User.updateOne({ _id: user._id }, { isDeleted: true });
  await expect(createSession(user.id, { title: 'Silinen hesap', type: 'OPEN' })).rejects.toThrow('yönetici onaylı');
  await expect(review(2, false, 'Kapalı hesap.')).rejects.toThrow('hesap kapatılmış');
});

test('permissions and legacy premium flag cannot be changed through generic user editing', async () => {
  const record = await getAdminRecord(adminContext(), { resource: 'User', id: user.id });
  for (const changes of [{ 'sessionCreationAccess.status': 'APPROVED' }, { sessionCreationAccess: { status: 'APPROVED' } }, { isPremium: true }]) {
    await expect(saveAdminRecord(adminContext(), { resource: 'User', id: user.id, revision: record.revision, changes, reason: 'İzni doğrudan değiştirme.' })).rejects.toThrow();
  }
});

test('invalid reasons, states, paging and revisions are rejected', async () => {
  for (const value of ['', 'short', 'x'.repeat(1001)]) await expect(access.requestSessionAccess(context(), value)).rejects.toThrow();
  for (const args of [{ status: 'NONE' }, { page: 0 }, { page: 1.5 }]) await expect(access.getSessionAccessRequests(adminContext(), args)).rejects.toThrow();
  await expect(review(0)).rejects.toThrow('Geçerli bir başvuru');
});

test('members can only read their own request and cannot supply another user ID', async () => {
  await request();
  const other = await User.create({ username: 'another', fullName: 'Another Member', email: 'another@test.example', password: 'hash' });
  const result = await run('MY_SESSION_ACCESS', {}, other);
  expect(result.errors).toBeUndefined();
  expect(result.data.mySessionCreationAccess).toMatchObject({ status: 'NONE', reason: '', user: { id: other.id } });
  const forbidden = await api.executeOperation({ query: `query { mySessionCreationAccess(userId: "${user.id}") { reason } }` }, { contextValue: { user: other } });
  expect(forbidden.body.singleResult.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
  expect((await run('SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 1 }, other)).errors[0].extensions.code).toBe('FORBIDDEN');
});

test('queue pagination is stable and filters out approved, deleted and inactive accounts', async () => {
  const requestedAt = new Date('2026-01-01T10:00:00Z');
  const members = await User.insertMany(Array.from({ length: 24 }, (_, index) => ({
    username: `applicant${index}`, fullName: `Applicant ${index}`, email: `applicant${index}@test.example`, password: 'hash',
    isDeleted: index === 22, isActive: index !== 23,
    sessionCreationAccess: { status: index === 21 ? 'APPROVED' : 'PENDING', reason, requestedAt, revision: 1 },
  })));
  const page1 = await run('SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 1 }, admin);
  const page2 = await run('SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 2 }, admin);
  const first = page1.data.sessionAccessRequests, second = page2.data.sessionAccessRequests;
  expect(first).toMatchObject({ total: 21, totalPages: 2, page: 1 });
  expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(1);
  const ids = [...first.items, ...second.items].map(item => item.user.id);
  expect(new Set(ids).size).toBe(21);
  expect(ids).toEqual(members.slice(0, 21).map(member => member.id).sort().reverse());
  expect((await run('SESSION_ACCESS_REQUESTS', { status: 'PENDING', page: 3 }, admin)).data.sessionAccessRequests.items).toEqual([]);
  const approved = await run('SESSION_ACCESS_REQUESTS', { status: 'APPROVED', page: 1 }, admin);
  expect(approved.data.sessionAccessRequests.items.map(item => item.user.id)).toEqual([members[21].id]);
});

test('invalid review payloads cannot change permission or produce an audit entry', async () => {
  await request();
  const base = { userId: user.id, revision: 1, approve: true };
  for (const changes of [{ userId: 'bad-id' }, { revision: 1.5 }, { approve: 'true' }, { note: null }, { note: 'x'.repeat(501) }]) {
    await expect(access.reviewSessionAccess(adminContext(), { ...base, ...changes })).rejects.toThrow();
  }
  expect((await access.getMySessionAccess(context())).status).toBe('PENDING');
  expect(await AdminAudit.countDocuments({ recordId: user.id })).toBe(0);
});
