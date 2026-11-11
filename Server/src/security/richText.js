import sanitizeHtml from 'sanitize-html';
import { badInput } from './graphqlSecurity.js';
import { safeImageSource } from './imageSource.js';

const color = /^(?:#[a-f0-9]{3,8}|[a-z]{1,20}|rgba?\([\d.,\s%]+\))$/i;
export function cleanRichText(value) {
  if (typeof value !== 'string') return '';
  if (value.length > 500000) throw badInput('Bölüm metni en fazla 500000 karakter olabilir.');
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'ol', 'ul', 'li', 'pre', 'code', 'a', 'img', 'sub', 'sup', 'hr'],
    allowedAttributes: { '*': ['class', 'style'], a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'width', 'height'] },
    allowedClasses: { '*': [/^ql-(?:align-(?:center|right|justify)|indent-[1-8]|size-(?:small|large|huge)|font-(?:serif|monospace)|direction-rtl|syntax)$/] },
    allowedStyles: { '*': { color: [color], 'background-color': [color], 'text-align': [/^(?:left|right|center|justify)$/], 'font-size': [/^(?:[1-4]?\d|50)(?:px|pt)$/] } },
    allowedSchemes: ['https', 'http', 'mailto'], allowedSchemesByTag: { img: ['https', 'http', 'data'] }, allowProtocolRelative: false,
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer', ...(attribs.target === '_blank' ? { target: '_blank' } : { target: '_self' }) } }), img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, src: safeImageSource(attribs.src) ? attribs.src : '' } }) },
    disallowedTagsMode: 'discard', enforceHtmlBoundary: true,
  });
}
