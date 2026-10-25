import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { getSocialShare, shareWebOrigin } from '../services/socialShareService.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const router = Router();
router.get('/:type/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  try {
    const item = await getSocialShare(req.params.type.toUpperCase(), req.params.id);
    const origin = shareWebOrigin(req.query.webOrigin);
    const destination = new URL(item.path, origin).href;
    const protocol = req.get('x-forwarded-proto')?.split(',')[0].trim() === 'https' ? 'https' : req.protocol;
    const preview = new URL(`/share/${item.type.toLowerCase()}/${item.id}`, `${protocol}://${req.get('host')}`);
    preview.searchParams.set('webOrigin', origin);
    const image = new URL('/social-share/link-preview.jpg', origin).href;
    const nonce = randomBytes(16).toString('base64');
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`);
    res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(item.title)}</title><meta name="description" content="${escapeHtml(item.description)}"><meta property="og:site_name" content="Betik"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(item.title)}"><meta property="og:description" content="${escapeHtml(item.description)}"><meta property="og:url" content="${escapeHtml(preview.href)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:alt" content="Betik paylaşım görseli"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(item.title)}"><meta name="twitter:description" content="${escapeHtml(item.description)}"><meta name="twitter:image" content="${escapeHtml(image)}"></head><body><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.description)}</p><a href="${escapeHtml(destination)}">Betik’te aç</a><script nonce="${nonce}">window.location.replace(${JSON.stringify(destination).replace(/</g, '\\u003c')});</script></body></html>`);
  } catch {
    res.status(404).type('html').send('<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>İçerik bulunamadı — Betik</title></head><body><p>Bu paylaşım artık mevcut değil veya herkese açık değil.</p></body></html>');
  }
});
export default router;
