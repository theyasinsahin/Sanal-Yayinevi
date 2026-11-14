import { jest } from '@jest/globals';
import express from 'express';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import routes from '../src/routes/chapterMusicRoutes.js';
import User from '../src/models/user.js';
import Book from '../src/models/book.js';
import Chapter from '../src/models/chapter.js';
import { connect, clearDatabase, closeDatabase } from './db.js';
import { MAX_MUSIC_BYTES } from '../src/services/chapterMusic.js';

jest.setTimeout(60000);
const realFetch = globalThis.fetch;
const testEnvironment = {
  JWT_SECRET: 'synthetic-chapter-music-test-secret', CHAPTER_MUSIC_ENABLED: 'true',
  CLOUDINARY_CLOUD_NAME: 'music-test', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret',
  DEV_EXTERNAL_INTEGRATIONS: 'true',
};
const previousEnvironment = Object.fromEntries(Object.keys(testEnvironment).map(key => [key, process.env[key]]));
let server, base, owner, outsider, book, chapter, provider;
const token = user => jwt.sign({ userId: user.id, version: user.authVersion ?? 0 }, process.env.JWT_SECRET, { algorithm: 'HS256' });
const endpoint = () => `${base}/api/chapters/${chapter.id}/music`;
const post = (user = owner, options = {}) => realFetch(endpoint(), {
  method: 'POST', headers: { authorization: `Bearer ${token(user)}`, 'content-type': 'audio/mpeg', 'x-music-rights': 'confirmed', ...options.headers },
  body: options.body || Buffer.from('synthetic-mp3'),
});

beforeAll(async () => {
  Object.assign(process.env, testEnvironment);
  await connect();
  const app = express();
  app.use('/api/chapters', routes);
  app.use(express.json({ limit: '2mb' }));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await closeDatabase();
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
beforeEach(async () => {
  [owner, outsider] = await User.create([
    { username: 'musicowner', fullName: 'Music Owner', email: 'musicowner@test.example', password: 'test' },
    { username: 'musicother', fullName: 'Music Other', email: 'musicother@test.example', password: 'test' },
  ]);
  book = await Book.create({ title: 'Music book', authorId: owner.id, status: 'WRITING' });
  chapter = await Chapter.create({ bookId: book.id, authorId: owner.id, title: 'Music chapter', content: 'Chapter text' });
  provider = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    expect(String(url)).toMatch(/^https:\/\/api\.cloudinary\.com\/v1_1\/music-test\/video\/(upload|destroy)$/);
    if (url.endsWith('/destroy')) return { ok: true, json: async () => ({ result: 'ok' }) };
    return { ok: true, json: async () => ({ public_id: options.body.get('public_id'),
      resource_type: 'video', format: 'mp3', bytes: options.body.get('file').size,
      duration: 30, audio: { codec: 'mp3' }, secure_url: `https://res.cloudinary.com/music-test/video/upload/${options.body.get('public_id')}.mp3`,
    }) };
  });
});

test('real authenticated upload persists verified music and delete removes it', async () => {
  const response = await post(owner, { headers: { 'x-music-title': encodeURIComponent('Şarkı') } });
  expect(response.status).toBe(200);
  const { music } = await response.json();
  expect(music.title).toBe('Şarkı');
  expect((await Chapter.findById(chapter.id).lean()).music).toEqual(music);
  const removed = await realFetch(endpoint(), { method: 'DELETE', headers: { authorization: `Bearer ${token(owner)}` } });
  expect(removed.status).toBe(200);
  expect(await removed.json()).toEqual({ music: null });
  expect((await Chapter.findById(chapter.id).lean()).music).toBeUndefined();
  expect(provider.mock.calls.some(([url, options]) => url.endsWith('/destroy') && options.body.get('public_id') === music.publicId)).toBe(true);
});

test('non-owner and deleted chapter reject before any provider request', async () => {
  expect((await post(outsider)).status).toBe(403);
  await Chapter.updateOne({ _id: chapter.id }, { $set: { isDeleted: true } });
  expect((await post()).status).toBe(404);
  expect(provider).not.toHaveBeenCalled();
});

test('legacy chapter without musicVersion can receive its first music association', async () => {
  await Chapter.collection.updateOne({ _id: chapter._id }, { $unset: { musicVersion: 1 } });
  expect((await post()).status).toBe(200);
  expect((await Chapter.findById(chapter.id).lean()).musicVersion).toBe(1);
});

test('concurrent uploads yield one winner and destroy the losing asset', async () => {
  const normalProvider = provider.getMockImplementation();
  let arrivals = 0, release;
  const bothUploaded = new Promise(resolve => { release = resolve; });
  provider.mockImplementation(async (url, options) => {
    if (url.endsWith('/upload')) { if (++arrivals === 2) release(); await bothUploaded; }
    return normalProvider(url, options);
  });
  const responses = await Promise.all([post(), post()]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
  const winner = await responses.find(response => response.status === 200).json();
  expect((await Chapter.findById(chapter.id).lean()).music).toEqual(winner.music);
  const destroys = provider.mock.calls.filter(([url]) => url.endsWith('/destroy'));
  expect(destroys).toHaveLength(1);
  expect(destroys[0][1].body.get('public_id')).not.toBe(winner.music.publicId);
});

test('raw parser rejects compression and oversized chunked bodies without provider calls', async () => {
  const compressed = await post(owner, { headers: { 'content-encoding': 'gzip' } });
  expect(compressed.status).toBe(415);
  expect((await compressed.json()).error).toBe('UNSUPPORTED_ENCODING');
  // Streaming avoids Content-Length so this exercises express.raw's own limit.
  async function* largeBody() {
    for (let offset = 0; offset < MAX_MUSIC_BYTES + 1; offset += 65536) {
      yield Buffer.alloc(Math.min(65536, MAX_MUSIC_BYTES + 1 - offset));
    }
  }
  const oversized = await realFetch(endpoint(), { method: 'POST', duplex: 'half',
    headers: { authorization: `Bearer ${token(owner)}`, 'content-type': 'audio/mpeg', 'x-music-rights': 'confirmed' }, body: largeBody() });
  expect(oversized.status).toBe(413);
  expect((await oversized.json()).error).toBe('MUSIC_TOO_LARGE');
  expect(provider).not.toHaveBeenCalled();
  // Parser failures release their upload slots.
  expect((await post()).status).toBe(200);
});
