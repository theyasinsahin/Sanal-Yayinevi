import mongoose from 'mongoose';
import Book from '../models/book.js';
import AdminAudit from '../models/adminAudit.js';
import PrintedCatalogRecord from '../models/printedCatalogRecord.js';
import { requireAdmin } from '../utils/adminAccess.js';
import { catalogDigest, catalogFields, normalizeCatalogText, printedWorkKey, printedCatalogDocument, validatePrintedCatalog } from '../utils/printedCatalog.js';
import { normalizeIsbn } from '../utils/printedBooks.js';

export async function importPrintedCatalog(manifest, { apply = false, adminId, expectedSha256 } = {}) {
  const summary = validatePrintedCatalog(manifest);
  if (apply && expectedSha256 !== summary.sha256) throw new Error('İncelenen paket özeti eşleşmiyor; beklenen SHA-256 gerekli.');
  if (apply) await requireAdmin({ user: { id: adminId } });
  const report = { ...summary, mode: apply ? 'apply' : 'dry-run', created: 0, existing: 0, conflicts: 0, entries: [] };
  // Cursors bound memory use even when the existing catalog is large.
  const existingByIsbn = new Map(), existingByWork = new Map();
  const relevantIsbns = new Set(manifest.books.map(book => book.isbn));
  const relevantWorks = new Set(manifest.books.map(printedWorkKey));
  for await (const book of Book.find({ $or: [{ kind: 'PRINTED' }, { isbn: { $in: [...relevantIsbns] } }] }).select('isbn title printedAuthor publisher publicationYear pageCount kind publicationStatus isDeleted').lean().cursor()) {
    let isbn;
    try { isbn = normalizeIsbn(book.isbn); } catch { /* Legacy entries may have no ISBN. */ }
    if (relevantIsbns.has(isbn)) existingByIsbn.set(isbn, book);
    if (relevantWorks.has(printedWorkKey(book))) existingByWork.set(printedWorkKey(book), book);
  }
  for (const entry of manifest.books) {
    const prior = existingByIsbn.get(entry.isbn);
    const otherEdition = existingByWork.get(printedWorkKey(entry));
    const result = { isbn: entry.isbn, title: entry.title };
    if (prior) {
      const differences = catalogFields.filter(field => entry[field] !== undefined && (field === 'isbn' ? normalizeIsbn(prior.isbn) !== entry.isbn : typeof entry[field] === 'number' ? prior[field] !== entry[field] : normalizeCatalogText(prior[field]) !== normalizeCatalogText(entry[field])));
      const same = prior.kind === 'PRINTED' && prior.publicationStatus === 'APPROVED' && !prior.isDeleted && differences.length === 0;
      Object.assign(result, { outcome: same ? 'EXISTS' : 'CONFLICT', bookId: String(prior._id), differences });
      report[same ? 'existing' : 'conflicts']++;
    } else if (otherEdition) {
      Object.assign(result, { outcome: 'OTHER_EDITION_EXISTS', bookId: String(otherEdition._id), existingIsbn: otherEdition.isbn });
      report.conflicts++;
    } else if (!apply) {
      result.outcome = 'WOULD_CREATE';
    } else {
      // Each new book, its provenance, and its audit entry commit together.
      // The ISBN unique index is the final guard against parallel submissions.
      try {
        const bookId = await mongoose.connection.transaction(async session => {
          const actor = await requireAdmin({ user: { id: adminId } }, session);
          const [book] = await Book.create([printedCatalogDocument(entry, { adminId: actor._id, batchId: manifest.batchId })], { session });
          await PrintedCatalogRecord.create([{ bookId: book._id, batchId: manifest.batchId, manifestSha256: summary.sha256, entrySha256: catalogDigest(entry), importedBy: actor._id, verification: entry.verification }], { session });
          await AdminAudit.create([{ actorId: actor._id, resource: 'Book', recordId: book.id, action: 'IMPORT_PRINTED_CATALOG', reason: `Doğrulanmış basılı katalog: ${manifest.batchId}; SHA-256 ${summary.sha256}`, fields: Object.keys(printedCatalogDocument(entry, { adminId: actor._id, batchId: manifest.batchId })) }], { session });
          return book.id;
        });
        Object.assign(result, { outcome: 'CREATED', bookId }); report.created++;
      } catch (error) {
        if (error.code !== 11000) throw error;
        result.outcome = 'CONCURRENT_ISBN_CONFLICT'; report.conflicts++;
      }
    }
    report.entries.push(result);
  }
  return report;
}
