import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import Genre from '../models/genre.js';
import Term from '../models/classificationTerm.js';
import { classificationSeed } from '../data/classification.js';

export const classificationFields = ['formatId', 'genreIds', 'tagIds', 'narrativeFeatureIds', 'targetAudienceId', 'contentWarningIds', 'classificationStatus', 'classificationVersion'];
export function normalizeTag(value) {
  if (typeof value !== 'string') throw new Error('Etiket metin olmalıdır.');
  const name = value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (name.length < 2 || name.length > 50 || !/^[\p{L}\p{N}\p{M} '#+.-]+$/u.test(name)) throw new Error('Etiketler 2–50 karakter olmalı; harf, rakam ve basit noktalama içermelidir.');
  return { name, normalizedName: name.toLocaleLowerCase('tr-TR') };
}
export async function seedClassification() {
  for (const [kind, entries] of Object.entries(classificationSeed)) {
    for (const [sortOrder, [slug, name]] of entries.entries()) {
      if (['FICTION', 'KNOWLEDGE'].includes(kind)) {
        // Never overwrite an administrator's display name or inactive status.
        const existing = await Genre.findOne({ $or: [{ slug }, { name }] }).select('_id slug classificationVersion');
        if (existing && existing.slug !== slug) throw new Error(`Sınıflandırma kodu çakışması: ${name}. Mevcut kod değiştirilmedi; yönetici incelemesi gerekli.`);
        await Genre.updateOne(existing ? { _id: existing._id } : { slug }, { $set: { slug, classificationVersion: 1, ...(existing?.classificationVersion === 1 ? {} : { group: kind }) }, $setOnInsert: { name, isActive: true, sortOrder, hexColor: '#6b7280' } }, { upsert: true });
      } else await Term.updateOne({ kind, slug }, { $setOnInsert: { kind, slug, name, isActive: true, sortOrder } }, { upsert: true });
    }
  }
}
const ids = (values, min, max, label) => {
  if (!Array.isArray(values) || values.length < min || values.length > max || values.some(id => !mongoose.isObjectIdOrHexString(id)) || new Set(values.map(String)).size !== values.length) throw new Error(`${label}: ${min}–${max} farklı, geçerli seçim yapın.`);
  return values.map(String);
};
export async function validateClassification(input, userId, session = null) {
  if (!input || typeof input !== 'object') throw new Error('Eser sınıflandırmasını tamamlayın.');
  const format = ids([input.formatId], 1, 1, 'Eser biçimi');
  const genres = ids(input.genreIds, 1, 3, 'Tür ve konu');
  const features = ids(input.narrativeFeatureIds || [], 0, 32, 'Anlatım özellikleri');
  const warnings = ids(input.contentWarningIds || [], 0, 32, 'İçerik uyarıları');
  const audience = input.targetAudienceId ? ids([input.targetAudienceId], 1, 1, 'Hedef okur kitlesi') : [];
  if (!Array.isArray(input.tags || []) || (input.tags || []).length > 8) throw new Error('En fazla 8 etiket ekleyebilirsiniz.');
  const tags = (input.tags || []).map(normalizeTag);
  if (new Set(tags.map(tag => tag.normalizedName)).size !== tags.length) throw new Error('Aynı etiket birden fazla eklenemez.');
  const groups = [['FORMAT', format], ['FEATURE', features], ['WARNING', warnings], ['AUDIENCE', audience]];
  const [validGenres, terms, existingTags] = await Promise.all([
    Genre.countDocuments({ _id: { $in: genres }, isActive: true, classificationVersion: 1 }).session(session),
    Term.find({ _id: { $in: groups.flatMap(([, values]) => values) }, isActive: true }).session(session).lean(),
    Term.find({ kind: 'TAG', normalizedName: { $in: tags.map(tag => tag.normalizedName) } }).session(session).lean(),
  ]);
  if (validGenres !== genres.length || groups.some(([kind, values]) => values.some(id => !terms.some(term => String(term._id) === id && term.kind === kind)))) throw new Error('Seçilen sınıflandırma bulunamadı, pasif veya yanlış alanda kullanıldı.');
  if (existingTags.some(tag => !tag.isActive)) throw new Error('Seçilen etiket kullanıma kapatılmış.');
  const newCount = tags.filter(tag => !existingTags.some(item => item.normalizedName === tag.normalizedName)).length;
  if (newCount) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await Term.countDocuments({ kind: 'TAG', createdBy: userId, createdAt: { $gte: since } }).session(session);
    if (recent + newCount > 50) throw new Error('24 saat içinde en fazla 50 yeni etiket oluşturabilirsiniz. Mevcut etiketleri seçebilirsiniz.');
  }
  const tagIds = [];
  for (const tag of tags) {
    let record = existingTags.find(item => item.normalizedName === tag.normalizedName);
    if (!record) {
      const slug = createHash('sha256').update(tag.normalizedName).digest('hex');
      try { record = await Term.findOneAndUpdate({ kind: 'TAG', normalizedName: tag.normalizedName }, { $setOnInsert: { ...tag, slug, createdBy: userId } }, { upsert: true, new: true, session, runValidators: true }); }
      catch (error) { if (error.code !== 11000 || session) throw error; record = await Term.findOne({ kind: 'TAG', normalizedName: tag.normalizedName }); }
      if (!record?.isActive) throw new Error('Seçilen etiket kullanıma kapatılmış.');
    }
    tagIds.push(record._id);
  }
  return { formatId: format[0], genreIds: genres, tagIds, narrativeFeatureIds: features, targetAudienceId: audience[0] || null, contentWarningIds: warnings, classificationStatus: 'COMPLETE', classificationVersion: 1 };
}
export async function getClassificationOptions() {
  const [terms, genres] = await Promise.all([
    Term.find({ isActive: true, kind: { $ne: 'TAG' } }).sort({ sortOrder: 1, _id: 1 }),
    Genre.find({ isActive: true, classificationVersion: 1 }).sort({ group: 1, sortOrder: 1, _id: 1 }),
  ]);
  const of = kind => terms.filter(term => term.kind === kind);
  return { formats: of('FORMAT'), genres, narrativeFeatures: of('FEATURE'), targetAudiences: of('AUDIENCE'), contentWarnings: of('WARNING') };
}
export async function searchTags(search = '') {
  if (typeof search !== 'string' || search.length > 50) throw new Error('Etiket araması en fazla 50 karakter olabilir.');
  const normalized = search.normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('tr-TR');
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Term.find({ kind: 'TAG', isActive: true, normalizedName: new RegExp(`^${escaped}`) }).sort({ normalizedName: 1 }).limit(20);
}
export async function classificationFilter(input = {}) {
  input ??= {};
  const filter = {};
  for (const [argument, field, kind] of [['formats', 'formatId', 'FORMAT'], ['features', 'narrativeFeatureIds', 'FEATURE'], ['audiences', 'targetAudienceId', 'AUDIENCE'], ['tags', 'tagIds', 'TAG']]) {
    const values = input[argument];
    if (!values?.length) continue;
    if (!Array.isArray(values) || values.length > 20 || values.some(code => typeof code !== 'string' || code.length > 100)) throw new Error('Geçersiz sınıflandırma filtresi.');
    const found = await Term.find({ kind, slug: { $in: values }, isActive: true }).select('_id').lean();
    filter[field] = { $in: found.map(term => term._id) };
  }
  if (input.genres?.length) {
    if (!Array.isArray(input.genres) || input.genres.length > 20 || input.genres.some(code => typeof code !== 'string' || code.length > 100)) throw new Error('Geçersiz tür filtresi.');
    const found = await Genre.find({ slug: { $in: input.genres }, isActive: true, classificationVersion: 1 }).select('_id').lean();
    filter.genreIds = { $in: found.map(genre => genre._id) };
  }
  return filter; // OR within each dimension, AND across dimensions.
}
