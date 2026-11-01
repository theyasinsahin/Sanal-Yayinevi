import { API_URL } from '../config/api';

export function publicWebOrigin(serverOrigin, browserOrigin = window.location.origin, configured = process.env.REACT_APP_PUBLIC_WEB_URL) {
  // Capacitor's localhost origin is not the public website. A development web
  // server with a port stays local instead of silently switching to production.
  let browser;
  try { browser = new URL(browserOrigin); } catch { return new URL(configured || serverOrigin).origin; }
  if (['http:', 'https:'].includes(browser.protocol) && !(browser.hostname === 'localhost' && !browser.port)) return browser.origin;
  return new URL(configured || serverOrigin).origin;
}

export function shareLinks(item, webOrigin = publicWebOrigin(item.webOrigin), apiUrl = API_URL) {
  const directUrl = new URL(item.path, webOrigin).href;
  const readablePath = /^\/(kitap|yazar|oturum)\//.test(item.path);
  const shareKey = readablePath ? decodeURIComponent(item.path.split('/').pop()) : item.id;
  const previewUrl = new URL(`/share/${item.type.toLowerCase()}/${encodeURIComponent(shareKey)}`, apiUrl);
  previewUrl.searchParams.set('webOrigin', webOrigin);
  const url = previewUrl.href;
  const caption = [item.title, item.description].filter(Boolean).join('\n\n');
  const text = `${caption}\n\n${url}`;
  return {
    url, directUrl, caption, text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(caption)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(item.title)}&url=${encodeURIComponent(url)}`,
    imageUrl: new URL(item.imagePath, webOrigin).href,
    fallbackImageUrl: new URL('/social-share/default.jpg', webOrigin).href,
  };
}

export async function loadShareFile(item, links, signal) {
  for (const url of [...new Set([links.imageUrl, links.fallbackImageUrl])]) {
    try {
      const response = await fetch(url, { signal, credentials: 'omit' });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) continue;
      return new File([blob], `betik-${item.type.toLowerCase()}-${item.id}.jpg`, { type: blob.type });
    } catch (error) { if (error.name === 'AbortError') throw error; }
  }
  throw new Error('Paylaşım görseli yüklenemedi. Bağlantıyı paylaşabilir veya görseli tekrar yükleyebilirsiniz.');
}

export async function copyShareText(text) {
  const previousFocus = document.activeElement;
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  } catch { /* Try the selection-based fallback before asking for manual copy. */ }
  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.dataset.socialShareCopy = 'true';
  input.style.position = 'fixed'; input.style.left = '-9999px';
  document.body.appendChild(input); input.select();
  try { if (!document.execCommand?.('copy')) throw new Error('Metni aşağıdaki alandan seçip kopyalayabilirsiniz.'); }
  finally { input.remove(); previousFocus?.focus?.(); }
}

export function canShareImage(file, text) {
  try { return Boolean(file && navigator.share && navigator.canShare?.({ files: [file], text })); }
  catch { return false; }
}
