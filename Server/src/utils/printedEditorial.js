import { createHash } from 'node:crypto';
import { classificationSeed } from '../data/classification.js';
import { normalizeTag } from '../services/classificationService.js';
import { normalizeIsbn } from './printedBooks.js';

export const editorialFields = ['description', 'formatId', 'genreIds', 'tagIds', 'narrativeFeatureIds', 'targetAudienceId', 'contentWarningIds', 'classificationStatus', 'classificationVersion', 'recognitionScore', 'editorialVersion'];
export const editorialFingerprintFields = [...editorialFields, 'title', 'isbn', 'printedAuthor', 'publisher', 'publicationYear', 'pageCount', 'imageUrl', 'kind', 'publicationStatus', 'status', 'isDeleted'];
export const editorialDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const canonical = value => {
  if (value === undefined) return { $missing: true };
  if (value === null || typeof value !== 'object') return value;
  if (value._bsontype === 'ObjectId') return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
};
export const editorialFingerprint = book => editorialDigest(canonical(Object.fromEntries(editorialFingerprintFields.map(field => [field, book[field]]))));
export function editorialSnapshot(book, fields = editorialFields) {
  return Object.fromEntries(fields.filter(field => Object.hasOwn(book, field)).map(field => [field, book[field]]));
}
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`Editoryal paket: ${message}`); };
const keys = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`${label}: desteklenmeyen alan.`);
};
const text = (value, min, max) => typeof value === 'string' && value === value.normalize('NFC').trim() && value.length >= min && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value);
const secureUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && value.length <= 1800; } catch { return false; }
};
export function validateEditorialManifest(manifest) {
  keys(manifest, ['schemaVersion', 'batchId', 'reviewedAt', 'scope', 'methodology', 'books'], 'üst düzey');
  if (manifest.schemaVersion !== 1 || !/^[a-z0-9][a-z0-9-]{2,99}$/u.test(manifest.batchId || '') || manifest.scope !== 'TR_GENERAL_READERS') fail('sürüm, kapsam veya paket kimliği geçersiz.');
  if (!Number.isFinite(Date.parse(manifest.reviewedAt)) || Date.parse(manifest.reviewedAt) > Date.now() + 60000) fail('inceleme tarihi geçersiz.');
  if (!object(manifest.methodology) || !Array.isArray(manifest.books) || !manifest.books.length || manifest.books.length > 1000000) fail('kitap listesi veya yöntem eksik.');
  const termSlugs = kind => new Set(classificationSeed[kind].map(([slug]) => slug));
  const formats = termSlugs('FORMAT'), features = termSlugs('FEATURE'), audiences = termSlugs('AUDIENCE'), warnings = termSlugs('WARNING');
  const genres = new Set([...classificationSeed.FICTION, ...classificationSeed.KNOWLEDGE].map(([slug]) => slug));
  const bookIds = new Set(), isbns = new Set(), ranks = new Set();
  for (const entry of manifest.books) {
    keys(entry, ['identity', 'beforeSha256', 'changes', 'research'], 'kitap');
    keys(entry.identity, ['bookId', 'isbn', 'title', 'printedAuthor'], 'kimlik');
    const { identity, changes, research } = entry;
    if (!/^[a-f0-9]{24}$/u.test(identity.bookId || '') || !text(identity.title?.normalize('NFC'), 1, 500) || !text(identity.printedAuthor?.normalize('NFC'), 1, 500) || normalizeIsbn(identity.isbn) !== identity.isbn) fail('kitap kimliği geçersiz.');
    if (bookIds.has(identity.bookId) || isbns.has(identity.isbn)) fail('yinelenen kitap veya ISBN.');
    bookIds.add(identity.bookId); isbns.add(identity.isbn);
    if (!/^[a-f0-9]{64}$/u.test(entry.beforeSha256 || '')) fail('önceki kayıt özeti eksik.');
    keys(changes, ['description', 'classification', 'recognitionScore', 'title'], 'değişiklik');
    if (!text(changes.description, 180, 6000) || /<\/?[a-z][^>]*>/iu.test(changes.description)) fail('özgün düz metin açıklaması geçersiz.');
    if (changes.title !== undefined && !text(changes.title, 1, 500)) fail('düzeltilmiş başlık geçersiz.');
    if (!Number.isInteger(changes.recognitionScore) || changes.recognitionScore < 1 || changes.recognitionScore > 1000000) fail('sıralama puanı geçersiz.');
    const c = changes.classification;
    keys(c, ['format', 'genres', 'tags', 'features', 'audience', 'warnings'], 'sınıflandırma');
    if (!formats.has(c.format) || !audiences.has(c.audience)) fail('biçim veya hedef okur geçersiz.');
    for (const [label, values, allowed, min, max] of [['tür', c.genres, genres, 1, 3], ['anlatım', c.features, features, 0, 32], ['uyarı', c.warnings, warnings, 0, 7]]) {
      if (!Array.isArray(values) || values.length < min || values.length > max || new Set(values).size !== values.length || values.some(value => !allowed.has(value))) fail(`${label} seçenekleri geçersiz.`);
    }
    if (!Array.isArray(c.tags) || c.tags.length < 1 || c.tags.length > 8) fail('etiket sayısı geçersiz.');
    const tags = c.tags.map(normalizeTag);
    if (new Set(tags.map(tag => tag.normalizedName)).size !== tags.length) fail('yinelenen etiket.');
    if (!object(research) || !Array.isArray(research.sources) || research.sources.length < 2 || research.sources.some(source => !secureUrl(source.url) || !text(source.role, 2, 50))) fail('kaynaklar eksik veya geçersiz.');
    if (!['SOURCE_LIMITED', 'SUPPORTED_FLAGS'].includes(research.warningAssessment?.status) || !text(research.warningAssessment?.limitation, 20, 1500)) fail('uyarı incelemesinin sınırı belirtilmeli.');
    if (c.warnings.length && !text(research.warningAssessment?.basis, 10, 1500)) fail('işaretlenen uyarıların dayanağı eksik.');
    const recognition = research.recognition;
    if (!object(recognition) || !Number.isInteger(recognition.rank) || recognition.rank < 1 || recognition.rank > manifest.books.length || ranks.has(recognition.rank) || changes.recognitionScore !== 1000001 - recognition.rank) fail('sıralama tutarsız.');
    if (!['HIGH', 'MEDIUM', 'LIMITED'].includes(recognition.confidence) || !text(recognition.limitation, 20, 1500)) fail('bilinirlik kanıt sınırı eksik.');
    if (changes.title && !research.titleCorrection) fail('başlık düzeltmesi gerekçesiz.');
    ranks.add(recognition.rank);
  }
  return { batchId: manifest.batchId, books: manifest.books.length, sha256: editorialDigest(manifest) };
}
