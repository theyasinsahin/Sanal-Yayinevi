import { jest } from '@jest/globals';
import express from 'express';
import { once } from 'node:events';
import { request } from 'node:http';

const authenticateUser = jest.fn();
const consumeRate = jest.fn();
const uploadMusic = jest.fn();
const cleanupMusic = jest.fn();
const musicConfiguration = jest.fn(() => ({}));
const chapterFind = jest.fn();
const bookFind = jest.fn();
const chapterUpdate = jest.fn();
jest.unstable_mockModule('../src/utils/auth.js', () => ({ authenticateUser }));
jest.unstable_mockModule('../src/security/rateLimit.js', () => ({ consumeRate }));
jest.unstable_mockModule('../src/models/chapter.js', () => ({ default: { findOne: chapterFind, findOneAndUpdate: chapterUpdate } }));
jest.unstable_mockModule('../src/models/book.js', () => ({ default: { findOne: bookFind } }));
const actualMusic = await import('../src/services/chapterMusic.js');
jest.unstable_mockModule('../src/services/chapterMusic.js', () => ({ ...actualMusic, musicConfiguration, uploadMusic, cleanupMusic }));
const { default: routes } = await import('../src/routes/chapterMusicRoutes.js');
const owner = { _id: '000000000000000000000001', role: 'USER' };
const chapter = { _id: '000000000000000000000002', bookId: '000000000000000000000003', musicVersion: 0, music: { publicId: 'old' } };
const music = { url: 'https://res.cloudinary.com/test/video/upload/music.mp3', title: 'Track', duration: 15, publicId: 'new' };
let server, base;
beforeAll(async () => {
  const app = express();
  app.use('/api/chapters', routes);
  app.use(express.json());
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/chapters/${chapter._id}/music`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  jest.clearAllMocks();
  authenticateUser.mockResolvedValue(owner);
  consumeRate.mockResolvedValue();
  musicConfiguration.mockImplementation(() => ({}));
  chapterFind.mockReturnValue({ lean: async () => chapter });
  bookFind.mockReturnValue({ lean: async () => ({ authorId: owner._id }) });
  chapterUpdate.mockReturnValue({ lean: async () => ({ ...chapter, music }) });
  uploadMusic.mockResolvedValue(music);
  cleanupMusic.mockResolvedValue();
});
const post = (headers = {}, body = Buffer.from('mp3')) => fetch(base, { method: 'POST', headers: { authorization: 'Bearer test', 'content-type': 'audio/mpeg', 'x-music-rights': 'confirmed', ...headers }, body });

test('auth and book ownership reject before invoking provider', async () => {
  authenticateUser.mockResolvedValueOnce(null);
  expect((await post()).status).toBe(401);
  bookFind.mockReturnValue({ lean: async () => ({ authorId: 'someone-else' }) });
  expect((await post()).status).toBe(403);
  expect(uploadMusic).not.toHaveBeenCalled();
});
test('admin can update and unapproved printed books still reject', async () => {
  authenticateUser.mockResolvedValue({ ...owner, role: 'ADMIN' });
  bookFind.mockReturnValue({ lean: async () => ({ authorId: 'other' }) });
  expect((await post()).status).toBe(200);
  bookFind.mockReturnValue({ lean: async () => ({ kind: 'PRINTED', publicationStatus: 'PENDING', authorId: owner._id }) });
  expect((await post()).status).toBe(403);
});
test('rights acknowledgement, raw content type and size are enforced', async () => {
  expect((await post({ 'x-music-rights': '' })).status).toBe(400);
  expect((await post({ 'content-type': 'application/json' }, '{"url":"https://attacker.example"}')).status).toBe(415);
  const oversizedStatus = await new Promise((resolve, reject) => {
    const req = request(base, { method: 'POST', headers: {
      authorization: 'Bearer test', 'content-type': 'audio/mpeg', 'x-music-rights': 'confirmed',
      'content-length': String(actualMusic.MAX_MUSIC_BYTES + 1),
    } }, response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.end();
  });
  expect(oversizedStatus).toBe(413);
  expect(uploadMusic).not.toHaveBeenCalled();
});
test('successful upload uses raw bytes, persists only server metadata and cleans replaced asset', async () => {
  const response = await post({ 'x-music-title': encodeURIComponent('Şarkı') });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ music });
  expect(uploadMusic).toHaveBeenCalledWith(Buffer.from('mp3'), 'Şarkı', {});
  expect(chapterUpdate).toHaveBeenCalledWith({ _id: chapter._id, isDeleted: false, musicVersion: 0 }, { $set: { music }, $inc: { musicVersion: 1 } }, { new: true, runValidators: true });
  expect(cleanupMusic).toHaveBeenCalledWith('old', {});
});
test('stale concurrent upload returns conflict and cleans only the unassociated new asset', async () => {
  chapterUpdate.mockReturnValue({ lean: async () => null });
  expect((await post()).status).toBe(409);
  expect(cleanupMusic).toHaveBeenCalledWith('new', {});
  expect(cleanupMusic).not.toHaveBeenCalledWith('old', {});
});
test('delete removes the association and cleans the previous asset', async () => {
  const response = await fetch(base, { method: 'DELETE', headers: { authorization: 'Bearer test' } });
  expect(await response.json()).toEqual({ music: null });
  expect(chapterUpdate.mock.calls[0][1]).toEqual({ $unset: { music: 1 }, $inc: { musicVersion: 1 } });
  expect(cleanupMusic).toHaveBeenCalledWith('old', {});
});

test('ownership revoked during provider upload prevents persistence and cleans the new asset', async () => {
  bookFind.mockReturnValueOnce({ lean: async () => ({ authorId: owner._id }) })
    .mockReturnValueOnce({ lean: async () => ({ authorId: 'new-owner' }) });
  expect((await post()).status).toBe(403);
  expect(chapterUpdate).not.toHaveBeenCalled();
  expect(cleanupMusic).toHaveBeenCalledWith('new', {});
  expect(cleanupMusic).not.toHaveBeenCalledWith('old', {});
});

test('legacy documents without a music version use a missing-or-null compare-and-swap', async () => {
  const { musicVersion: _version, ...legacy } = chapter;
  chapterFind.mockReturnValue({ lean: async () => legacy });
  expect((await post()).status).toBe(200);
  expect(chapterUpdate.mock.calls[0][0]).toEqual({ _id: chapter._id, isDeleted: false, musicVersion: null });
});

test('disabled integration fails clearly before parsing or contacting the provider', async () => {
  musicConfiguration.mockImplementation(() => { throw actualMusic.musicError(503, 'MUSIC_DISABLED', 'Disabled'); });
  const response = await post();
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe('MUSIC_DISABLED');
  expect(uploadMusic).not.toHaveBeenCalled();
});

test('shared user rate limits reject before provider upload', async () => {
  consumeRate.mockRejectedValueOnce({ extensions: { code: 'RATE_LIMITED' }, message: 'Too many requests' });
  const response = await post();
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBe('60');
  expect(uploadMusic).not.toHaveBeenCalled();
});

test('provider failure leaves the prior music association intact', async () => {
  uploadMusic.mockRejectedValueOnce(actualMusic.musicError(502, 'MUSIC_PROVIDER_UNAVAILABLE', 'Unavailable'));
  const response = await post();
  expect(response.status).toBe(502);
  expect(chapterUpdate).not.toHaveBeenCalled();
  expect(cleanupMusic).not.toHaveBeenCalled();
});
