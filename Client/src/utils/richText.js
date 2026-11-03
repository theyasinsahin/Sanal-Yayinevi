import DOMPurify from 'dompurify';

const safeUri = /^(?:(?:https?|mailto):|\/(?!\/)|#)/i;
function safeRaster(value) {
  const match = /^data:image\/(png|jpeg|webp);base64,([a-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || match[2].length > 450000) return false;
  try {
    const header = atob(match[2]).slice(0, 12);
    return match[1].toLowerCase() === 'png' ? header.startsWith('\x89PNG\r\n\x1a\n') : match[1].toLowerCase() === 'jpeg' ? header.startsWith('\xff\xd8\xff') : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
  } catch { return false; }
}
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (['href', 'src'].includes(data.attrName) && !safeUri.test(data.attrValue) && !(node.nodeName === 'IMG' && data.attrName === 'src' && safeRaster(data.attrValue))) data.keepAttr = false;
});
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.nodeName === 'A') node.setAttribute('rel', 'noopener noreferrer');
});

// No arbitrary style, SVG, MathML, data URLs, event handlers or DOM identifiers.
// The server also sanitizes; this protects legacy records and cached responses.
export function cleanRichText(value) {
  return DOMPurify.sanitize(typeof value === 'string' ? value : '', {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'pre', 'code', 'a', 'img', 'sub', 'sup', 'hr'],
    ALLOWED_ATTR: ['class', 'href', 'title', 'target', 'rel', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: safeUri,
    ADD_DATA_URI_TAGS: [], FORBID_TAGS: ['svg', 'math'],
  });
}
