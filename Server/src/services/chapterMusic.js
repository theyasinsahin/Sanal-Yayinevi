import { createHash, randomUUID } from 'node:crypto';

export const MAX_MUSIC_BYTES = 15 * 1024 * 1024;
export const musicError = (status, code, message) => Object.assign(new Error(message), { status, code });

export function musicConfiguration(env = process.env) {
  if (env.CHAPTER_MUSIC_ENABLED !== 'true' || env.BETIK_DOCKER_DEV === 'true' && env.DEV_EXTERNAL_INTEGRATIONS !== 'true') {
    throw musicError(503, 'MUSIC_DISABLED', 'Bölüm müziği entegrasyonu devre dışı.');
  }
  const cloud = env.CLOUDINARY_CLOUD_NAME, key = env.CLOUDINARY_API_KEY, secret = env.CLOUDINARY_API_SECRET;
  if (!/^[a-zA-Z0-9_-]+$/.test(cloud || '') || !key || !secret) throw musicError(503, 'MUSIC_NOT_CONFIGURED', 'Bölüm müziği sağlayıcısı yapılandırılmamış.');
  return { cloud, key, secret };
}

export function musicTitle(header) {
  let title;
  try { title = decodeURIComponent(header || '').trim(); } catch { throw musicError(400, 'INVALID_MUSIC_TITLE', 'Müzik başlığı kodlaması geçersiz.'); }
  if (title.length > 160 || /[\u0000-\u001f\u007f]/u.test(title)) throw musicError(400, 'INVALID_MUSIC_TITLE', 'Müzik başlığı en fazla 160 karakter olabilir.');
  return title || 'Bölüm müziği';
}

export function signedMusicForm(parameters, config) {
  const form = new FormData();
  const canonical = Object.keys(parameters).sort().map(key => `${key}=${parameters[key]}`).join('&');
  for (const [key, value] of Object.entries(parameters)) form.set(key, String(value));
  form.set('api_key', config.key);
  form.set('signature', createHash('sha1').update(canonical + config.secret).digest('hex'));
  return form;
}

async function providerRequest(action, form, config, fetcher = fetch) {
  try {
    const response = await fetcher(`https://api.cloudinary.com/v1_1/${config.cloud}/video/${action}`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(25000), redirect: 'error',
    });
    if (!response.ok) throw new Error('provider');
    return await response.json();
  } catch {
    throw musicError(502, 'MUSIC_PROVIDER_UNAVAILABLE', 'Müzik sağlayıcısı işlemi tamamlayamadı.');
  }
}

export function verifiedMusic(asset, publicId, bytes, title) {
  let url;
  try { url = new URL(asset.secure_url); } catch { /* rejected below */ }
  if (asset.public_id !== publicId || asset.resource_type !== 'video' || asset.format !== 'mp3'
    || !Number.isSafeInteger(asset.bytes) || asset.bytes !== bytes || asset.bytes < 1 || asset.bytes > MAX_MUSIC_BYTES
    || !Number.isFinite(asset.duration) || asset.duration <= 0 || asset.duration > 600
    || !asset.audio || asset.audio.codec !== 'mp3' || asset.video != null || asset.width != null || asset.height != null
    || url?.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password) {
    throw musicError(422, 'INVALID_MUSIC', 'Yalnızca 15 MiB ve 600 saniyeyi aşmayan, video içermeyen MP3 dosyaları kabul edilir.');
  }
  return { url: url.href, title, duration: asset.duration, publicId };
}

export async function cleanupMusic(publicId, config, fetcher = fetch) {
  if (!publicId || !/^chapter_music\/[a-f0-9-]+$/.test(publicId)) return;
  try {
    await providerRequest('destroy', signedMusicForm({ public_id: publicId, invalidate: true, timestamp: Math.floor(Date.now() / 1000) }, config), config, fetcher);
  } catch { /* Best effort: never undo a persisted association or expose provider details. */ }
}

export async function uploadMusic(data, title, config, fetcher = fetch) {
  if (!Buffer.isBuffer(data) || !data.length || data.length > MAX_MUSIC_BYTES) throw musicError(400, 'INVALID_MUSIC', 'Geçerli bir MP3 dosyası gönderin.');
  const publicId = `chapter_music/${randomUUID()}`;
  const form = signedMusicForm({ public_id: publicId, overwrite: false, timestamp: Math.floor(Date.now() / 1000) }, config);
  form.set('file', new Blob([data], { type: 'audio/mpeg' }), 'music.mp3');
  try {
    return verifiedMusic(await providerRequest('upload', form, config, fetcher), publicId, data.length, title);
  } catch (error) {
    await cleanupMusic(publicId, config, fetcher);
    throw error;
  }
}
