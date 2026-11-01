import { ApolloServer } from '@apollo/server';
import express from 'express';
import { readFileSync } from 'node:fs';
import schema from '../src/graphql/schema.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Session from '../src/models/session.js';
import User from '../src/models/user.js';
import * as sessions from '../src/services/sessionService.js';
import { DEFAULT_SESSION_COVER, normalizeSessionCover } from '../src/utils/sessionCover.js';
import { getSocialShare } from '../src/services/socialShareService.js';
import socialShareRoutes from '../src/routes/socialShareRoutes.js';

const cover = 'https://res.cloudinary.com/dw1sepw7z/image/upload/v123/event-cover.jpg';
let owner, other, admin, api, server, origin;
beforeAll(async () => {
  await connect();
  api = new ApolloServer({ schema, plugins: [{ async requestDidStart() { return { async executionDidStart() { return { willResolveField() { return () => {}; } }; } }; } }] });
  await api.start();
  const app = express(); app.use('/share', socialShareRoutes);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await api.stop(); await closeDatabase(); });
afterEach(clearDatabase);
beforeEach(async () => {
  [owner, other, admin] = await User.create([
    { username: 'organizer', fullName: 'Organizatör', email: 'owner@example.test', password: 'test', sessionCreationAccess: { status: 'APPROVED' } },
    { username: 'other', fullName: 'Katılımcı', email: 'other@example.test', password: 'test' },
    { username: 'admin', fullName: 'Admin', email: 'admin@example.test', password: 'test', role: 'ADMIN' },
  ]);
});
async function run(query, variables, user) {
  const response = await api.executeOperation({ query, variables }, { contextValue: { user } });
  return response.body.singleResult;
}
const source = readFileSync(new URL('../../Client/src/graphql/queries/session.js', import.meta.url), 'utf8');
const body = name => source.split(`const ${name} = gql\``)[1].split('`;')[0];
const document = name => body(name).replace('${SESSION_FIELDS}', body('SESSION_FIELDS'));

test('legacy sessions remain without a cover through the actual client list/detail queries without a migration', async () => {
  const legacy = await Session.create({ title: 'Eski Etkinlik', createdBy: owner.id, type: 'OPEN' });
  await Session.collection.updateOne({ _id: legacy._id }, { $unset: { coverImageUrl: 1 } });
  const list = await run(document('GET_SESSIONS'), { limit: 20, offset: 0 });
  expect(list.errors).toBeUndefined();
  expect(list.data.getSessions[0]).toMatchObject({ id: legacy.id, coverImageUrl: '' });
  const detail = await run(document('GET_SESSION'), { sessionId: legacy.id });
  expect(detail.errors).toBeUndefined(); expect(detail.data.getSession.coverImageUrl).toBe('');
});

test.each([undefined, ''])('organizers can create a session without a cover (%s)', async coverImageUrl => {
  const created = await run(document('CREATE_SESSION'), { input: { title: 'Coverless session', type: 'OPEN', ...(coverImageUrl !== undefined && { coverImageUrl }) } }, owner);
  expect(created.errors).toBeUndefined();
  expect(created.data.createSession.coverImageUrl).toBe('');
  expect((await Session.findById(created.data.createSession.id)).coverImageUrl).toBe('');
});

test('approved organizers can create sessions with an uploaded cover and unauthorized members cannot', async () => {
  const created = await run(document('CREATE_SESSION'), { input: { title: 'Kitap Fuarı', description: 'Etkinlik hakkındaki düşünceler.', type: 'OPEN', coverImageUrl: cover } }, owner);
  expect(created.errors).toBeUndefined(); expect(created.data.createSession.coverImageUrl).toBe(cover);
  expect((await Session.findById(created.data.createSession.id)).coverImageUrl).toBe(cover);
  await expect(sessions.createSession(other.id, { title: 'Yetkisiz', type: 'OPEN', coverImageUrl: cover })).rejects.toThrow('yönetici onaylı');
});

test('owners can update/reset existing covers and the actual client mutation returns the new image', async () => {
  const session = await sessions.createSession(owner.id, { title: 'Etkinlik', type: 'OPEN' });
  const updated = await run(document('UPDATE_SESSION_COVER'), { sessionId: session.id, coverImageUrl: cover }, owner);
  expect(updated.errors).toBeUndefined(); expect(updated.data.updateSessionCover.coverImageUrl).toBe(cover);
  const reset = await run(document('UPDATE_SESSION_COVER'), { sessionId: session.id, coverImageUrl: '' }, owner);
  expect(reset.errors).toBeUndefined(); expect(reset.data.updateSessionCover.coverImageUrl).toBe('');
});

test('anonymous visitors and other members cannot change covers, while admins can moderate them', async () => {
  const session = await sessions.createSession(owner.id, { title: 'Etkinlik', type: 'OPEN', coverImageUrl: cover });
  const anonymous = await run(document('UPDATE_SESSION_COVER'), { sessionId: session.id, coverImageUrl: '' });
  expect(anonymous.errors[0].message).toContain('Giriş');
  await expect(sessions.updateSessionCover(other, session.id, '')).rejects.toThrow('kendi oturumunuzun');
  expect((await Session.findById(session.id)).coverImageUrl).toBe(cover);
  await sessions.updateSessionCover(admin, session.id, '');
  expect((await Session.findById(session.id)).coverImageUrl).toBe('');
});

test.each(['javascript:alert(1)', 'data:image/svg+xml,test', 'http://res.cloudinary.com/c/image/upload/a.jpg', 'https://localhost/test.jpg', 'https://evil.example/cover.jpg', 'https://user:password@res.cloudinary.com/c/image/upload/a.jpg'])(
  'invalid uploaded cover URL is rejected: %s', value => expect(() => normalizeSessionCover(value)).toThrow()
);

test('open session shares and WhatsApp previews use the cover and readable permalink', async () => {
  const session = await sessions.createSession(owner.id, { title: 'Kitap Fuarı', type: 'OPEN', coverImageUrl: cover });
  const shared = await getSocialShare('SESSION', session.id);
  expect(shared.imagePath).toBe(cover); expect(shared.path).toBe('/oturum/kitap-fuari');
  const response = await fetch(`${origin}/share/session/kitap-fuari`);
  expect(response.status).toBe(200);
  const html = await response.text();
  expect(html).toContain(`property="og:image" content="${cover}"`);
  expect(html).toContain('name="twitter:image"');
  expect(html).toContain('/oturum/kitap-fuari');
});

test.each(['PRIVATE', 'FOLLOWERS_ONLY'])('%s sessions keep their existing sharing restrictions', async type => {
  const session = await sessions.createSession(owner.id, { title: 'Özel Etkinlik', type, accessCode: 'test-code', coverImageUrl: cover });
  await expect(getSocialShare('SESSION', session.id)).rejects.toThrow('herkese açık');
  expect((await fetch(`${origin}/share/session/${session.id}`)).status).toBe(404);
});

test('closing/deleting a session disables social previews and a missing cover uses the local fallback', async () => {
  const session = await sessions.createSession(owner.id, { title: 'Etkinlik', type: 'OPEN' });
  expect((await getSocialShare('SESSION', session.id)).imagePath).toBe(DEFAULT_SESSION_COVER);
  await Session.updateOne({ _id: session.id }, { isActive: false });
  await expect(getSocialShare('SESSION', session.id)).rejects.toThrow();
  await Session.updateOne({ _id: session.id }, { isDeleted: true });
  await expect(sessions.updateSessionCover(owner, session.id, cover)).rejects.toThrow('bulunamadı');
  const asset = readFileSync(new URL('../../Client/public/images/sessions/default-cover.jpg', import.meta.url));
  expect([...asset.subarray(0, 2)]).toEqual([255, 216]);
});
