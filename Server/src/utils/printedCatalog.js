import { createHash } from 'node:crypto';
import { normalizeIsbn } from './printedBooks.js';

export const catalogDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const normalizeCatalogText = value => String(value || '').normalize('NFC').toLocaleLowerCase('tr-TR')
  .replace(/[’‘`]/gu, "'").replace(/[–—]/gu, '-').replace(/\s+/gu, ' ').trim();
export const printedWorkKey = book => `${normalizeCatalogText(book.title).replace(/\s*\((?:karton kapak|ciltli)\)\s*$/u, '').replace(/\s*-\s*bütün yapıtları$/u, '')}|${normalizeCatalogText(book.printedAuthor)}`;
export const catalogFields = ['isbn', 'title', 'printedAuthor', 'publisher', 'pageCount', 'publicationYear'];
const fail = message => { throw new Error(`Katalog doğrulaması: ${message}`); };
const nonempty = (value, max = 1500) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max;
const secureUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && value.length <= 1500; }
  catch { return false; }
};
const comparable = (field, value) => field === 'isbn' ? normalizeIsbn(value)
  : ['pageCount', 'publicationYear'].includes(field) ? value : normalizeCatalogText(value);

// This verifies saved observations and review decisions. It deliberately does
// not treat a successful HTTP response, JSON-LD, or an ISBN checksum as truth.
export function validatePrintedCatalog(manifest, { now = new Date() } = {}) {
  if (manifest?.schemaVersion !== 1 || !nonempty(manifest.batchId, 100) || !Array.isArray(manifest.books) || !manifest.books.length) fail('geçerli, boş olmayan bir paket gerekli.');
  const isbns = new Set(), works = new Set();
  for (const entry of manifest.books) {
    const name = entry?.isbn || '?';
    const check = (condition, message) => { if (!condition) fail(`${name}: ${message}`); };
    check(entry.isbn === normalizeIsbn(entry.isbn), 'ISBN-13 normal biçimde olmalı.');
    check(!isbns.has(entry.isbn), 'yinelenen ISBN.'); isbns.add(entry.isbn);
    for (const [field, max] of [['title', 200], ['printedAuthor', 300], ['publisher', 200], ['description', 5000]]) check(nonempty(entry[field], max), `${field} eksik veya geçersiz.`);
    check(entry.description.length >= 20, 'tanıtım en az 20 karakter olmalı.');
    check(Number.isInteger(entry.pageCount) && entry.pageCount >= 1 && entry.pageCount <= 50000, 'sayfa sayısı geçersiz.');
    check(entry.publicationYear === undefined || (Number.isInteger(entry.publicationYear) && entry.publicationYear >= 1400 && entry.publicationYear <= now.getUTCFullYear()), 'yıl geçersiz.');
    check(entry.language === 'tr', 'yalnız Türkçe baskılar kabul edilir.');
    for (const field of ['imageUrl', 'publicationEvidenceUrl', 'purchaseUrl']) check(secureUrl(entry[field]), `${field} HTTPS olmalı.`);
    const key = printedWorkKey(entry);
    check(!works.has(key), 'aynı eserin birden fazla baskısı seçilmiş.'); works.add(key);
    const evidence = entry.verification;
    check(evidence?.status === 'REVIEWED' && nonempty(evidence.reviewedAt) && Number.isFinite(Date.parse(evidence.reviewedAt)) && Date.parse(evidence.reviewedAt) <= now.getTime(), 'inceleme kaydı gerekli.');
    check(Array.isArray(evidence.sources) && evidence.sources.length >= 2, 'iki kaynak gerekli.');
    check(evidence.sources.some(s => s.role === 'PUBLISHER' && s.url === entry.publicationEvidenceUrl), 'yayınevi kanıtı gerekli.');
    check(evidence.sources.some(s => s.role === 'BOOKSELLER' && s.url === entry.purchaseUrl && s.observed.language === 'tr'), 'Türkçe baskıyı belirten kitapçı kanıtı gerekli.');
    check(evidence.sources.every(s => !s.observed?.bookFormat || /^https?:\/\/schema\.org\/(?:Paperback|Hardcover|BoardBook)$/u.test(s.observed.bookFormat)), 'elektronik/sesli veya belirsiz format kabul edilmez.');
    const hosts = new Set();
    for (const source of evidence.sources) {
      check(secureUrl(source.url), 'kaynak URL geçersiz.');
      hosts.add(new URL(source.url).hostname.replace(/^www\./u, ''));
      check(nonempty(source.fetchedAt) && Number.isFinite(Date.parse(source.fetchedAt)) && Date.parse(source.fetchedAt) <= Date.parse(evidence.reviewedAt), 'kaynak erişim zamanı geçersiz.');
      check(source.observed?.isbn === entry.isbn, 'kaynak başka bir ISBN içeriyor.');
      for (const field of catalogFields) {
        if (field === 'publicationYear' && entry[field] === undefined) continue;
        const observed = source.observed[field];
        const same = observed !== undefined && comparable(field, observed) === comparable(field, entry[field]);
        const decision = evidence.equivalences?.find(d => d.field === field && d.sourceUrl === source.url && d.sourceValue === observed && d.catalogValue === entry[field] && nonempty(d.reason, 500));
        const yearDecision = evidence.publicationYearDecision;
        const publisherYear = field === 'publicationYear' && source.role === 'BOOKSELLER'
          && yearDecision?.policy === 'PUBLISHER_AUTHORITATIVE'
          && yearDecision.selectedValue === entry.publicationYear
          && yearDecision.conflicts?.some(conflict => conflict.sourceUrl === source.url && conflict.observedValue === observed)
          && nonempty(yearDecision.reason, 500)
          && evidence.sources.some(s => s.role === 'PUBLISHER' && s.observed.publicationYear === entry.publicationYear);
        // The user's explicit publisher-first year policy is the only numeric
        // conflict exception. Page counts and ISBNs must agree exactly.
        check(same || publisherYear || (!['isbn', 'pageCount', 'publicationYear'].includes(field) && decision), `${field} kaynaklar arasında doğrulanmadı.`);
      }
    }
    check(hosts.size >= 2, 'iki ayrı kaynak alan adı gerekli.');
    if (entry.publicationYear === undefined) check(nonempty(evidence.omissions?.publicationYear, 500), 'eksik yılın gerekçesi gerekli.');
    const cover = evidence.cover;
    check(cover?.publisherImageUrl === entry.imageUrl && evidence.sources.some(s => s.role === 'PUBLISHER' && s.observed.imageUrl === entry.imageUrl), 'kapak yayınevi kaydıyla eşleşmeli.');
    check(evidence.sources.some(s => s.role === 'BOOKSELLER' && s.observed.imageUrl === cover.booksellerImageUrl), 'kitapçı kapağı kaydı gerekli.');
    check(cover.method === 'visual-pair-review' && cover.sameDesign === true && nonempty(cover.reviewedAt) && Number.isFinite(Date.parse(cover.reviewedAt)) && Date.parse(cover.reviewedAt) <= Date.parse(evidence.reviewedAt), 'iki kaynağın kapağı görsel olarak karşılaştırılmalı.');
    for (const field of ['publisherSha256', 'booksellerSha256']) check(/^[a-f0-9]{64}$/u.test(cover[field]), 'kapak dosyalarının SHA-256 özeti gerekli.');
    check(nonempty(evidence.editionSelection?.reason, 1000) && evidence.editionSelection.selectedIsbn === entry.isbn && nonempty(evidence.editionSelection.limitation, 1000), 'baskı seçimi gerekçesi ve ölçüm sınırı gerekli.');
  }
  return { batchId: manifest.batchId, sha256: catalogDigest(manifest), books: manifest.books.length, missingYears: manifest.books.filter(book => book.publicationYear === undefined).length };
}

export function printedCatalogDocument(entry, { adminId, batchId, now = new Date() }) {
  return {
    ...Object.fromEntries([...catalogFields, 'description', 'imageUrl', 'purchaseUrl', 'publicationEvidenceUrl'].filter(field => entry[field] !== undefined).map(field => [field, entry[field]])),
    kind: 'PRINTED', status: 'PUBLISHED', publicationStatus: 'APPROVED',
    submittedBy: adminId, reviewedBy: adminId, reviewedAt: now,
    reviewNote: `Çift kaynak ve kapak incelemesi: ${batchId}`,
    // A bibliography entry never grants a site user authorship or digital rights.
    classificationStatus: 'NEEDS_REVIEW',
  };
}
