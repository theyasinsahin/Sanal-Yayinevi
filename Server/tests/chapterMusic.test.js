import { jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { MAX_MUSIC_BYTES, musicConfiguration, musicTitle, signedMusicForm, verifiedMusic, uploadMusic, cleanupMusic } from '../src/services/chapterMusic.js';

const config = { cloud: 'test-cloud', key: 'test-key', secret: 'test-secret' };
const publicId = 'chapter_music/00000000-0000-4000-8000-000000000000';
const asset = {
  public_id: publicId, resource_type: 'video', format: 'mp3', bytes: 3,
  duration: 600, audio: { codec: 'mp3' }, secure_url: 'https://res.cloudinary.com/test-cloud/video/upload/music.mp3',
};

test('configuration fails closed and Docker requires external integrations opt-in', () => {
  const env = { CHAPTER_MUSIC_ENABLED: 'true', CLOUDINARY_CLOUD_NAME: config.cloud, CLOUDINARY_API_KEY: config.key, CLOUDINARY_API_SECRET: config.secret };
  expect(musicConfiguration(env)).toEqual(config);
  expect(() => musicConfiguration({ ...env, CHAPTER_MUSIC_ENABLED: 'false' })).toThrow(/devre dışı/);
  expect(() => musicConfiguration({ ...env, CLOUDINARY_API_SECRET: '' })).toThrow(/yapılandırılmamış/);
  expect(() => musicConfiguration({ ...env, BETIK_DOCKER_DEV: 'true' })).toThrow(/devre dışı/);
});

test('titles decode UTF-8 headers with bounded length and reject malformed encoding', () => {
  expect(musicTitle(encodeURIComponent('Şarkı'))).toBe('Şarkı');
  expect(musicTitle()).toBe('Bölüm müziği');
  for (const title of ['%', 'a'.repeat(161), '%00']) expect(() => musicTitle(title)).toThrow();
});

test('REST parameters use the sorted Cloudinary SHA-1 signature', () => {
  const form = signedMusicForm({ timestamp: 123, public_id: publicId, overwrite: false }, config);
  expect(form.get('api_key')).toBe(config.key);
  expect(form.get('signature')).toBe(createHash('sha1').update(`overwrite=false&public_id=${publicId}&timestamp=123${config.secret}`).digest('hex'));
  expect(form.has('secret')).toBe(false);
});

test('verified MP3 permits exact limits and returns only association fields', () => {
  expect(verifiedMusic(asset, publicId, 3, 'Title')).toEqual({ publicId, url: asset.secure_url, title: 'Title', duration: 600 });
  expect(verifiedMusic({ ...asset, bytes: MAX_MUSIC_BYTES }, publicId, MAX_MUSIC_BYTES, 'Title').duration).toBe(600);
});

test.each([
  { format: 'mp4' }, { bytes: MAX_MUSIC_BYTES + 1 }, { bytes: 2 }, { bytes: 0 },
  { duration: 600.01 }, { duration: 0 }, { duration: NaN }, { audio: null },
  { audio: { codec: 'aac' } }, { video: {} }, { width: 0 }, { height: 100 },
  { public_id: 'other' }, { resource_type: 'image' },
  { secure_url: 'https://attacker.example/audio.mp3' }, { secure_url: 'http://res.cloudinary.com/audio.mp3' },
])('rejects invalid provider metadata %j', patch => {
  expect(() => verifiedMusic({ ...asset, ...patch }, publicId, 3, 'Title')).toThrow(/MP3/);
});

test('invalid provider upload is cleaned up using the server-generated id', async () => {
  const fetcher = jest.fn(async (url, options) => ({ ok: true, json: async () => url.endsWith('/upload')
    ? { ...asset, public_id: options.body.get('public_id'), video: { codec: 'h264' } } : { result: 'ok' } }));
  await expect(uploadMusic(Buffer.from('mp3'), 'Title', config, fetcher)).rejects.toMatchObject({ status: 422 });
  expect(fetcher).toHaveBeenCalledTimes(2);
  const first = fetcher.mock.calls[0][1];
  const destroy = fetcher.mock.calls[1][1];
  expect(destroy.body.get('public_id')).toBe(first.body.get('public_id'));
  expect(first.body.get('file').type).toBe('audio/mpeg');
  expect(first.signal).toBeDefined();
});

test('oversize/empty uploads do not contact provider and cleanup failure is harmless', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(uploadMusic(Buffer.alloc(0), 'Title', config, fetcher)).rejects.toMatchObject({ status: 400 });
  await expect(uploadMusic(Buffer.alloc(MAX_MUSIC_BYTES + 1), 'Title', config, fetcher)).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(cleanupMusic(publicId, config, fetcher)).resolves.toBeUndefined();
});

test('successful signed upload persists only verified provider fields', async () => {
  const fetcher = jest.fn(async (_url, options) => ({ ok: true, json: async () => ({ ...asset, public_id: options.body.get('public_id'), ignored: 'provider-only-data' }) }));
  const result = await uploadMusic(Buffer.from('mp3'), 'Track', config, fetcher);
  expect(result).toEqual({ url: asset.secure_url, title: 'Track', duration: 600, publicId: expect.stringMatching(/^chapter_music\/[a-f0-9-]+$/) });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('https://api.cloudinary.com/v1_1/test-cloud/video/upload');
  expect(fetcher.mock.calls[0][1].redirect).toBe('error');
});

test.each(['http', 'timeout', 'invalid-json'])('provider %s failure returns a safe error and attempts cleanup', async failure => {
  const fetcher = jest.fn(async url => {
    if (url.endsWith('/destroy')) return { ok: true, json: async () => ({ result: 'ok' }) };
    if (failure === 'timeout') throw new Error('synthetic sensitive provider details');
    return { ok: failure !== 'http', json: async () => { throw new Error('synthetic sensitive provider details'); } };
  });
  await expect(uploadMusic(Buffer.from('mp3'), 'Track', config, fetcher)).rejects.toMatchObject({
    status: 502, code: 'MUSIC_PROVIDER_UNAVAILABLE', message: 'Müzik sağlayıcısı işlemi tamamlayamadı.',
  });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1][0]).toContain('/video/destroy');
});
