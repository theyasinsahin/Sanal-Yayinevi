import mongoose from 'mongoose';
import Book from '../models/book.js';
import Genre from '../models/genre.js';
import User from '../models/user.js';
import Preference from '../models/userPreference.js';
import Term from '../models/classificationTerm.js';
import { classificationSeed } from '../data/classification.js';
import { classificationFields, normalizeTag, seedClassification } from './classificationService.js';
import { genreSlug } from '../utils/genreNaming.js';
import { createHash } from 'node:crypto';

const logSchema = new mongoose.Schema({
  migration: { type: String, default: 'classification-v1' },
  resource: String, recordId: mongoose.Schema.Types.ObjectId,
  before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed,
  applied: Boolean, rolledBack: Boolean,
}, { timestamps: true });
logSchema.index({ migration: 1, resource: 1, recordId: 1 }, { unique: true });
export const ClassificationMigration = mongoose.models.ClassificationMigration || mongoose.model('ClassificationMigration', logSchema);
const aliases = {
  ask: ['GENRE', 'ask-romantik'], romantik: ['GENRE', 'ask-romantik'], mizahi: ['GENRE', 'mizah-komedi'], mizah: ['GENRE', 'mizah-komedi'],
  toplum: ['GENRE', 'toplum-sosyoloji'], doga: ['GENRE', 'doga-cevre'], yemek: ['GENRE', 'yemek-gastronomi'],
  ekonomi: ['GENRE', 'ekonomi-finans'], genclik: ['GENRE', 'genclik-kurgusu'], 'fan-kurgu': ['FEATURE', 'hayran-kurgusu'],
  fanfiction: ['FEATURE', 'hayran-kurgusu'], sohbet: ['FORMAT', 'soylesi-sohbet'], 'kisa-hikaye': ['FORMAT', 'oyku'], hikaye: ['FORMAT', 'oyku'],
};
export function mapLegacyGenre(genre) {
  const key = genreSlug(genre?.name || genre?.slug || '');
  if (aliases[key]) return aliases[key];
  for (const [kind, entries] of Object.entries(classificationSeed)) {
    const found = entries.find(([slug, name]) => slug === key || genreSlug(name) === key);
    if (found) return [['FICTION', 'KNOWLEDGE'].includes(kind) ? 'GENRE' : kind, found[0]];
  }
  return null;
}
const snapshot = (record, fields) => Object.fromEntries(fields.filter(field => record[field] !== undefined).map(field => [field, JSON.parse(JSON.stringify(record[field]))]));
const fingerprint = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const fieldsByResource = { Book: classificationFields, UserPreference: ['preferredGenres', 'onboardingCompleted'], User: ['authorSettings'] };

export async function migrateClassification({ apply = false } = {}) {
  const report = { dryRun: !apply, books: [], preferences: [], applied: 0, skipped: 0 };
  if (apply) {
    await Promise.all([ClassificationMigration.createIndexes(), Term.createIndexes(), Genre.createIndexes(), Book.createIndexes()]);
    await seedClassification();
  }
  const genres = await Genre.find().lean();
  const byId = new Map(genres.map(genre => [String(genre._id), genre]));
  report.seedConflicts = [...classificationSeed.FICTION, ...classificationSeed.KNOWLEDGE].flatMap(([slug, name]) => genres.filter(genre => genre.name === name && genre.slug !== slug).map(genre => ({ id: String(genre._id), name, existingCode: genre.slug, proposedCode: slug })));
  report.unmappedGenres = genres.filter(genre => !mapLegacyGenre(genre)).map(genre => ({ id: String(genre._id), name: genre.name }));
  async function save(resource, model, record, after) {
    if (!apply) return;
    const changed = await mongoose.connection.transaction(async session => {
      const current = await model.findById(record._id).session(session).lean();
      const fields = fieldsByResource[resource];
      if (!current || fingerprint(snapshot(current, fields)) !== fingerprint(snapshot(record, fields))) return false;
      const existing = await ClassificationMigration.findOne({ resource, recordId: record._id, applied: true, rolledBack: { $ne: true } }).session(session);
      if (existing) return false;
      await ClassificationMigration.findOneAndUpdate({ resource, recordId: record._id }, { $set: { before: snapshot(record, fields), after: JSON.parse(JSON.stringify(after)), applied: true, rolledBack: false } }, { upsert: true, session });
      await model.updateOne({ _id: record._id }, { $set: after }, { session, timestamps: false });
      return true;
    });
    if (changed) report.applied++;
    else report.skipped++;
  }
  for await (const book of Book.find({ classificationVersion: { $ne: 1 } }).lean().cursor()) {
    const legacy = byId.get(String(book.genreId));
    const mapping = mapLegacyGenre(legacy);
    const issues = [];
    const after = { genreIds: [], tagIds: [], narrativeFeatureIds: [], contentWarningIds: [], formatId: null, targetAudienceId: null, classificationVersion: 1, classificationStatus: 'NEEDS_REVIEW' };
    if (!mapping) issues.push(legacy ? `Unmapped: ${legacy.name}` : 'Missing legacy genre');
    else if (apply) {
      const [kind, slug] = mapping;
      const term = kind === 'GENRE' ? await Genre.findOne({ slug, classificationVersion: 1 }) : await Term.findOne({ kind, slug });
      if (!term) issues.push(`Missing destination: ${kind}/${slug}`);
      else if (kind === 'GENRE') after.genreIds = [term._id];
      else if (kind === 'FORMAT') after.formatId = term._id;
      else if (kind === 'FEATURE') after.narrativeFeatureIds = [term._id];
      else if (kind === 'AUDIENCE') after.targetAudienceId = term._id;
      else if (kind === 'WARNING') after.contentWarningIds = [term._id];
    }
    const seen = new Set();
    for (const original of book.tags || []) {
      try {
        const tag = normalizeTag(original);
        if (seen.has(tag.normalizedName)) continue;
        seen.add(tag.normalizedName);
        if (seen.size > 8) { issues.push(`Tag needs review: ${original}`); continue; }
        if (apply) {
          const slug = createHash('sha256').update(tag.normalizedName).digest('hex');
          const record = await Term.findOneAndUpdate({ kind: 'TAG', normalizedName: tag.normalizedName }, { $setOnInsert: { ...tag, slug, isActive: true } }, { upsert: true, new: true });
          after.tagIds.push(record._id);
          if (!record.isActive) issues.push(`Inactive tag: ${original}`);
        }
      } catch { issues.push(`Tag needs review: ${original}`); }
    }
    // A single old category never establishes BOTH mandatory dimensions.
    if (mapping?.[0] !== 'FORMAT') issues.push('Format must be selected');
    if (mapping?.[0] !== 'GENRE') issues.push('Genres must be selected');
    report.books.push({ id: String(book._id), title: book.title, legacy: legacy?.name || null, mapping, issues });
    await save('Book', Book, book, after);
  }
  for await (const pref of Preference.find().lean().cursor()) {
    const converted = [], unresolved = [];
    for (const id of pref.preferredGenres || []) {
      const legacy = byId.get(String(id));
      const mapping = mapLegacyGenre(legacy);
      if (mapping?.[0] !== 'GENRE') { unresolved.push(legacy?.name || String(id)); continue; }
      if (apply) { const target = await Genre.findOne({ slug: mapping[1], classificationVersion: 1 }); if (target) converted.push(target._id); }
    }
    report.preferences.push({ id: String(pref._id), unresolved });
    if (apply) {
      const unique = [...new Map(converted.map(id => [String(id), id])).values()];
      await save('UserPreference', Preference, pref, { preferredGenres: unique, onboardingCompleted: Boolean(unique.length && pref.onboardingCompleted) });
    }
  }
  for await (const user of User.find({ 'authorSettings.preferredGenres.0': { $exists: true } }).lean().cursor()) {
    const names = [];
    for (const name of user.authorSettings.preferredGenres) {
      const mapping = mapLegacyGenre({ name });
      if (mapping?.[0] === 'GENRE' && apply) { const target = await Genre.findOne({ slug: mapping[1], classificationVersion: 1 }); if (target) names.push(target.name); }
    }
    if (apply) await save('User', User, user, { authorSettings: { ...user.authorSettings, preferredGenres: [...new Set(names)] } });
  }
  return report;
}
export async function rollbackClassification() {
  const result = { restored: 0, conflicts: [] };
  const models = { Book, UserPreference: Preference, User };
  for await (const entry of ClassificationMigration.find({ applied: true, rolledBack: { $ne: true } }).sort({ createdAt: -1 }).lean().cursor()) {
    await mongoose.connection.transaction(async session => {
      const model = models[entry.resource], fields = fieldsByResource[entry.resource];
      const current = await model.findById(entry.recordId).session(session).lean();
      if (!current || fingerprint(snapshot(current, fields)) !== fingerprint(entry.after)) { result.conflicts.push(String(entry.recordId)); return; }
      const unset = Object.fromEntries(fields.filter(field => !(field in entry.before)).map(field => [field, '']));
      await model.updateOne({ _id: entry.recordId }, { $set: entry.before, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { session, timestamps: false });
      await ClassificationMigration.updateOne({ _id: entry._id }, { $set: { rolledBack: true } }, { session });
      result.restored++;
    });
  }
  return result;
}
