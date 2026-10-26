export const DEFAULT_SESSION_COVER = '/images/sessions/default-cover.jpg';

export function normalizeSessionCover(value) {
  if (value == null || value === '' || value === DEFAULT_SESSION_COVER) return '';
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Geçerli bir oturum kapağı yükleyin.');
  let url;
  try { url = new URL(value); } catch { throw new Error('Geçerli bir oturum kapağı yükleyin.'); }
  // Covers come from the existing Cloudinary image uploader. Keep previews from
  // embedding arbitrary URLs, credentials, data: URLs or local network hosts.
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port || !url.pathname.includes('/image/upload/')) throw new Error('Kapak fotoğrafını görsel yükleme alanından ekleyin.');
  return url.href;
}
export function sessionCover(session) {
  try { return normalizeSessionCover(session.coverImageUrl) || DEFAULT_SESSION_COVER; }
  catch { return DEFAULT_SESSION_COVER; }
}
