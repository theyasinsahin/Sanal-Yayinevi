import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connect, clearDatabase, closeDatabase } from './db.js';
import Book from '../src/models/book.js';
import User from '../src/models/user.js';
import AdminAudit from '../src/models/adminAudit.js';
import PrintedCatalogRecord from '../src/models/printedCatalogRecord.js';
import { importPrintedCatalog } from '../src/services/printedCatalogImportService.js';
import { validatePrintedCatalog, catalogDigest } from '../src/utils/printedCatalog.js';
import { canEditBookContent } from '../src/utils/printedBooks.js';
import { getPrintedBooks } from '../src/services/printedBookService.js';
import { findAllBooks } from '../src/services/bookService.js';

const snapshotDate = '2026-01-01T00:00:00.000Z';
function fixture() {
  const fields = { isbn: '9786053606116', title: 'Satranç', printedAuthor: 'Stefan Zweig', publisher: 'Türkiye İş Bankası Kültür Yayınları', pageCount: 88, publicationYear: 2013 };
  const imageUrl = 'https://publisher.example/satranc.jpg', purchaseUrl = 'https://bookseller.example/satranc';
  return {
    schemaVersion: 1, batchId: 'test-printed-catalog', books: [{
      ...fields, language: 'tr', description: 'Stefan Zweig’ın Türkçe basılı kitabının katalog kaydı.',
      imageUrl, publicationEvidenceUrl: 'https://publisher.example/satranc', purchaseUrl,
      verification: {
        status: 'REVIEWED', reviewedAt: snapshotDate,
        sources: [
          { role: 'PUBLISHER', url: 'https://publisher.example/satranc', fetchedAt: snapshotDate, observed: { ...fields, imageUrl } },
          { role: 'BOOKSELLER', url: purchaseUrl, fetchedAt: snapshotDate, observed: { ...fields, language: 'tr', imageUrl: 'https://bookseller.example/cover.jpg' } },
        ],
        cover: { method: 'visual-pair-review', sameDesign: true, reviewedAt: snapshotDate, publisherImageUrl: imageUrl, booksellerImageUrl: 'https://bookseller.example/cover.jpg', publisherSha256: 'a'.repeat(64), booksellerSha256: 'b'.repeat(64) },
        editionSelection: { selectedIsbn: fields.isbn, reason: 'Karşılaştırılan adaylarda bu baskının okuyucu etkileşimi daha yüksek.', limitation: 'Kapak tanınırlığının doğrudan ölçümü bulunmuyor.' },
      },
    }],
  };
}
let admin, member;
beforeAll(async () => { await connect(); await Promise.all([Book.init(), PrintedCatalogRecord.init(), AdminAudit.init()]); });
afterAll(closeDatabase);
beforeEach(async () => {
  [admin, member] = await User.create([
    { username: 'catalog_admin', fullName: 'Catalog Admin', email: 'catalog-admin@example.test', password: 'test', role: 'ADMIN' },
    { username: 'catalog_member', fullName: 'Catalog Member', email: 'catalog-member@example.test', password: 'test' },
  ]);
});
afterEach(async () => { jest.restoreAllMocks(); await clearDatabase(); });
const apply = (manifest, options = {}) => importPrintedCatalog(manifest, { apply: true, adminId: admin.id, expectedSha256: catalogDigest(manifest), ...options });

test('saved observations require two domains, an exact edition, Turkish language, and a cover pair review', () => {
  expect(validatePrintedCatalog(fixture())).toMatchObject({ books: 1, missingYears: 0 });
  const mutations = [
    x => { x.books[0].verification.sources.pop(); },
    x => { x.books[0].verification.sources[1].url = 'https://publisher.example/other'; x.books[0].purchaseUrl = 'https://publisher.example/other'; },
    x => { x.books[0].verification.sources[1].observed.isbn = '9786254293894'; },
    x => { x.books[0].verification.sources[1].observed.pageCount = 64; },
    x => { x.books[0].verification.sources[1].observed.publicationYear = 2023; },
    x => { x.books[0].verification.sources[1].observed.language = 'en'; },
    x => { x.books[0].verification.sources[1].observed.bookFormat = 'https://schema.org/EBook'; },
    x => { x.books[0].verification.cover.sameDesign = false; },
    x => { x.books[0].imageUrl = 'http://publisher.example/cover.jpg'; },
    x => { x.books.push(structuredClone(x.books[0])); },
    x => { x.books[0].verification.reviewedAt = '2099-01-01T00:00:00Z'; },
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); expect(() => validatePrintedCatalog(input)).toThrow(); }
});

test('unresolved years must be omitted with an explicit reason; a numeric conflict cannot be an alias', () => {
  const input = fixture(), entry = input.books[0];
  entry.verification.sources[1].observed.publicationYear = 2023;
  entry.verification.equivalences = [{ field: 'publicationYear', sourceUrl: entry.purchaseUrl, sourceValue: 2023, catalogValue: 2013, reason: 'Bir sonraki basım.' }];
  expect(() => validatePrintedCatalog(input)).toThrow('publicationYear');
  delete entry.publicationYear;
  expect(() => validatePrintedCatalog(input)).toThrow('gerekçesi');
  entry.verification.omissions = { publicationYear: 'Kaynaklar farklı basım yıllarını gösteriyor.' };
  expect(validatePrintedCatalog(input).missingYears).toBe(1);
});

test('name variants require a review decision bound to the exact source and values', () => {
  const input = fixture(), entry = input.books[0];
  entry.verification.sources[1].observed.title = 'Satranç (Karton Kapak)';
  expect(() => validatePrintedCatalog(input)).toThrow('title');
  entry.verification.equivalences = [{ field: 'title', sourceUrl: entry.purchaseUrl, sourceValue: 'Satranç (Karton Kapak)', catalogValue: 'Satranç', reason: 'Aynı ISBN; kitapçı başlığa cilt türünü eklemiş.' }];
  expect(validatePrintedCatalog(input).books).toBe(1);
});

test('the explicit publisher-first year policy records the conflict and cannot override pages', () => {
  const input = fixture(), entry = input.books[0];
  entry.verification.sources[1].observed.publicationYear = 2023;
  entry.verification.publicationYearDecision = { policy: 'PUBLISHER_AUTHORITATIVE', selectedValue: 2013, conflicts: [{ sourceUrl: entry.purchaseUrl, observedValue: 2023 }], reason: 'Kullanıcının yıl için yayınevini esas alma talimatı.' };
  expect(validatePrintedCatalog(input).books).toBe(1);
  entry.verification.sources[1].observed.pageCount = 64;
  expect(() => validatePrintedCatalog(input)).toThrow('pageCount');
});

test('a database dry run leaves books, provenance, and admin logs untouched', async () => {
  const report = await importPrintedCatalog(fixture());
  expect(report.entries[0].outcome).toBe('WOULD_CREATE');
  expect(await Book.countDocuments()).toBe(0);
  expect(await PrintedCatalogRecord.countDocuments()).toBe(0);
  expect(await AdminAudit.countDocuments()).toBe(0);
});

test('apply requires the reviewed digest and a currently active administrator', async () => {
  await expect(apply(fixture(), { expectedSha256: 'wrong' })).rejects.toThrow('SHA-256');
  await expect(apply(fixture(), { adminId: member.id })).rejects.toThrow('yönetici');
  await User.updateOne({ _id: admin._id }, { isActive: false });
  await expect(apply(fixture())).rejects.toThrow('yönetici');
  expect(await Book.countDocuments()).toBe(0);
});

test('imported books appear only in the printed catalog, have provenance, and grant no authorship', async () => {
  const report = await apply(fixture());
  expect(report.created).toBe(1);
  const book = await Book.findById(report.entries[0].bookId);
  expect(book).toMatchObject({ kind: 'PRINTED', publicationStatus: 'APPROVED', status: 'PUBLISHED', classificationStatus: 'NEEDS_REVIEW', pageCount: 88 });
  expect(book.authorId).toBeUndefined();
  expect(book.chapters).toHaveLength(0);
  expect(canEditBookContent(book, admin)).toBe(false);
  expect((await getPrintedBooks({ search: 'Satranç' })).total).toBe(1);
  expect(await findAllBooks()).toHaveLength(0);
  const provenance = await PrintedCatalogRecord.findOne({ bookId: book._id });
  expect(provenance.manifestSha256).toBe(catalogDigest(fixture()));
  expect(provenance.verification.sources).toHaveLength(2);
  expect(await AdminAudit.countDocuments({ recordId: book.id, action: 'IMPORT_PRINTED_CATALOG' })).toBe(1);
});

test('reimport never overwrites an existing edition or its user data', async () => {
  await apply(fixture());
  const original = await Book.findOne();
  await Book.updateOne({ _id: original._id }, { 'stats.likes': 19, authorId: member._id });
  const again = await apply(fixture());
  expect(again).toMatchObject({ created: 0, existing: 1, conflicts: 0 });
  const changed = fixture(); changed.books[0].description = 'Sonradan değiştirilmiş bir katalog açıklaması.';
  await apply(changed);
  const kept = await Book.findById(original._id);
  expect(kept.stats.likes).toBe(19);
  expect(String(kept.authorId)).toBe(member.id);
  expect(kept.description).toBe(fixture().books[0].description);
  expect(await PrintedCatalogRecord.countDocuments()).toBe(1);
});

test('legacy ISBN-10 and its ISBN-13 equivalent never create two editions', async () => {
  const input = fixture(), entry = input.books[0];
  entry.isbn = '9780140328721';
  for (const source of entry.verification.sources) source.observed.isbn = entry.isbn;
  entry.verification.editionSelection.selectedIsbn = entry.isbn;
  await Book.create({ ...entry, isbn: '0-14-032872-6', kind: 'PRINTED', publicationStatus: 'APPROVED' });
  const result = await apply(input);
  expect(result).toMatchObject({ created: 0, existing: 1, conflicts: 0 });
  expect(await Book.countDocuments()).toBe(1);
});

test.each(['deleted', 'pending', 'different-pages', 'digital', 'other-edition'])('existing %s records are reported, preserved, and never revived', async variant => {
  const entry = fixture().books[0];
  const prior = await Book.create({ title: entry.title, printedAuthor: entry.printedAuthor, publisher: entry.publisher, pageCount: entry.pageCount, publicationYear: entry.publicationYear, isbn: variant === 'other-edition' ? '9786254293894' : entry.isbn, kind: variant === 'digital' ? 'DIGITAL' : 'PRINTED', publicationStatus: variant === 'pending' ? 'PENDING' : 'APPROVED', isDeleted: variant === 'deleted', ...(variant === 'different-pages' ? { pageCount: 64 } : {}) });
  const before = JSON.stringify(await Book.findById(prior._id).lean());
  const result = await apply(fixture());
  expect(result).toMatchObject({ created: 0, conflicts: 1 });
  expect(JSON.stringify(await Book.findById(prior._id).lean())).toBe(before);
  expect(await PrintedCatalogRecord.countDocuments()).toBe(0);
});

test('provenance failure rolls back the new book and audit entry', async () => {
  jest.spyOn(PrintedCatalogRecord, 'create').mockRejectedValueOnce(new Error('Injected storage failure'));
  await expect(apply(fixture())).rejects.toThrow('Injected storage failure');
  expect(await Book.countDocuments()).toBe(0);
  expect(await AdminAudit.countDocuments()).toBe(0);
  expect(mongoose.connection.readyState).toBe(1);
});
