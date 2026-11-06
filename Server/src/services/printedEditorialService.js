import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import Book from '../models/book.js';
import Genre from '../models/genre.js';
import Term from '../models/classificationTerm.js';
import AdminAudit from '../models/adminAudit.js';
import PrintedEditorialRecord from '../models/printedEditorialRecord.js';
import { classificationSeed } from '../data/classification.js';
import { normalizeTag } from './classificationService.js';
import { requireAdmin } from '../utils/adminAccess.js';
import { editorialDigest, editorialFields, editorialFingerprint, editorialSnapshot, validateEditorialManifest } from '../utils/printedEditorial.js';

const publishedPrinted = { kind: 'PRINTED', publicationStatus: 'APPROVED', status: 'PUBLISHED', isDeleted: false };
const termKey = (kind, slug) => `${kind}:${slug}`;
function requiredTerms(manifest) {
  const required = new Map();
  for (const { changes: { classification: c } } of manifest.books) {
    for (const [kind, slugs] of [['FORMAT', [c.format]], ['FEATURE', c.features], ['AUDIENCE', [c.audience]], ['WARNING', c.warnings]]) {
      for (const slug of slugs) required.set(termKey(kind, slug), { kind, slug, name: classificationSeed[kind].find(([code]) => code === slug)[1] });
    }
    for (const value of c.tags) {
      const tag = normalizeTag(value);
      required.set(termKey('TAG', tag.normalizedName), { kind: 'TAG', ...tag, slug: createHash('sha256').update(tag.normalizedName).digest('hex') });
    }
  }
  return required;
}
async function plan(manifest, session = null) {
  const required = requiredTerms(manifest);
  const [books, records, terms, genres] = await Promise.all([
    Book.find(publishedPrinted).session(session).lean(),
    PrintedEditorialRecord.find({ batchId: manifest.batchId }).session(session).lean(),
    Term.find({ $or: [...required.values()].map(t => t.kind === 'TAG' ? { kind: 'TAG', normalizedName: t.normalizedName } : { kind: t.kind, slug: t.slug }) }).session(session).lean(),
    Genre.find({ slug: { $in: [...new Set(manifest.books.flatMap(e => e.changes.classification.genres))] } }).session(session).lean(),
  ]);
  const byId = new Map(books.map(book => [String(book._id), book]));
  const termMap = new Map(terms.map(t => [termKey(t.kind, t.kind === 'TAG' ? t.normalizedName : t.slug), t]));
  const genreMap = new Map(genres.map(g => [g.slug, g]));
  const conflicts = [];
  const ids = new Set(manifest.books.map(e => e.identity.bookId));
  for (const book of books) if (!ids.has(String(book._id))) conflicts.push({ bookId: String(book._id), reason: 'UNREVIEWED_PUBLISHED_BOOK' });
  for (const entry of manifest.books) {
    const book = byId.get(entry.identity.bookId);
    const record = records.find(r => String(r.bookId) === entry.identity.bookId);
    if (!book) { conflicts.push({ bookId: entry.identity.bookId, reason: 'NOT_PUBLISHED_PRINTED' }); continue; }
    if (record) {
      if (record.entrySha256 !== editorialDigest(entry) || record.afterSha256 !== editorialFingerprint(book)) conflicts.push({ bookId: entry.identity.bookId, reason: 'APPLIED_RECORD_CHANGED' });
    } else if (book.isbn !== entry.identity.isbn || book.title !== entry.identity.title || book.printedAuthor !== entry.identity.printedAuthor || editorialFingerprint(book) !== entry.beforeSha256) conflicts.push({ bookId: entry.identity.bookId, reason: 'STALE_REVIEW' });
    for (const slug of entry.changes.classification.genres) if (!genreMap.get(slug)?.isActive || genreMap.get(slug).classificationVersion !== 1) conflicts.push({ bookId: entry.identity.bookId, reason: 'GENRE_UNAVAILABLE', slug });
  }
  for (const [key, existing] of termMap) if (!existing.isActive) conflicts.push({ reason: 'TERM_INACTIVE', key });
  if (records.length) for (const key of required.keys()) if (!termMap.has(key)) conflicts.push({ reason: 'APPLIED_TERM_MISSING', key });
  // An all-or-nothing batch cannot be resumed from an unexplained partial state.
  if (records.length && records.length !== manifest.books.length) conflicts.push({ reason: 'PARTIAL_BATCH_RECORDS' });
  return { byId, records, required, termMap, genreMap, conflicts };
}
export async function applyPrintedEditorial(manifest, { apply = false, adminId, expectedSha256 } = {}) {
  const summary = validateEditorialManifest(manifest);
  if (apply && expectedSha256 !== summary.sha256) throw new Error('İncelenen editoryal paketin SHA-256 özeti eşleşmiyor.');
  if (apply) await requireAdmin({ user: { id: adminId } });
  const initial = await plan(manifest);
  const report = { ...summary, mode: apply ? 'apply' : 'dry-run', updated: 0, existing: initial.records.length, conflicts: initial.conflicts, newTerms: [...initial.required.keys()].filter(key => !initial.termMap.has(key)).length };
  if (initial.conflicts.length || !apply) return report;
  if (initial.records.length === manifest.books.length) return report;
  // Bounded bulk operations keep the complete catalog transaction short.
  await mongoose.connection.transaction(async session => {
    const actor = await requireAdmin({ user: { id: adminId } }, session);
    const state = await plan(manifest, session);
    if (state.conflicts.length) throw new Error('Katalog incelemeden sonra değişti; hiçbir editoryal kayıt uygulanmadı.');
    if (state.records.length === manifest.books.length) { report.existing = state.records.length; report.newTerms = 0; return; }
    const missing = [...state.required].filter(([key]) => !state.termMap.has(key));
    const added = missing.map(([key, term]) => {
      const record = { _id: new mongoose.Types.ObjectId(), ...term, isActive: true, sortOrder: term.kind === 'TAG' ? 0 : classificationSeed[term.kind].findIndex(([slug]) => slug === term.slug), createdBy: actor._id };
      state.termMap.set(key, record); return record;
    });
    // Administrative catalog curation does not weaken the public 50-tag quota.
    if (added.length) await Term.insertMany(added, { session });
    report.newTerms = added.length;
    const updates = [], provenance = [], audits = [];
    for (const entry of manifest.books) {
      const book = state.byId.get(entry.identity.bookId), c = entry.changes.classification;
      const id = (kind, slug) => state.termMap.get(termKey(kind, slug))._id;
      const after = {
        description: entry.changes.description,
        formatId: id('FORMAT', c.format), genreIds: c.genres.map(slug => state.genreMap.get(slug)._id),
        tagIds: c.tags.map(value => id('TAG', normalizeTag(value).normalizedName)),
        narrativeFeatureIds: c.features.map(slug => id('FEATURE', slug)),
        targetAudienceId: id('AUDIENCE', c.audience), contentWarningIds: c.warnings.map(slug => id('WARNING', slug)),
        classificationStatus: 'COMPLETE', classificationVersion: 1,
        recognitionScore: entry.changes.recognitionScore, editorialVersion: manifest.batchId,
        ...(entry.changes.title ? { title: entry.changes.title } : {}),
      };
      const fields = [...editorialFields, ...(entry.changes.title ? ['title'] : [])];
      updates.push({ updateOne: { filter: { _id: book._id, ...publishedPrinted, updatedAt: book.updatedAt }, update: { $set: after } } });
      provenance.push({ bookId: book._id, batchId: manifest.batchId, manifestSha256: summary.sha256, entrySha256: editorialDigest(entry), beforeSha256: entry.beforeSha256, afterSha256: editorialFingerprint({ ...book, ...after }), before: editorialSnapshot(book, fields), after, research: entry.research, reviewedAt: manifest.reviewedAt, appliedBy: actor._id });
      audits.push({ actorId: actor._id, resource: 'Book', recordId: String(book._id), action: 'CURATE_PRINTED_CATALOG', reason: `Editoryal katalog: ${manifest.batchId}; SHA-256 ${summary.sha256}`, fields });
    }
    const result = await Book.bulkWrite(updates, { session, ordered: true });
    if (result.matchedCount !== manifest.books.length) throw new Error('Eşzamanlı katalog değişikliği; işlem bütünüyle geri alındı.');
    await PrintedEditorialRecord.insertMany(provenance, { session });
    await AdminAudit.insertMany(audits, { session });
    report.updated = manifest.books.length;
  });
  return report;
}
