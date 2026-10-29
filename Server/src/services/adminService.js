import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import { GraphQLError } from 'graphql';
import { resources, fieldsFor, sensitive } from './adminResources.js';
import { requireAdmin } from '../utils/adminAccess.js';
import { normalizeGenre } from '../utils/genreNaming.js';
import { normalizeSessionCover } from '../utils/sessionCover.js';
import { normalizeText } from './quoteService.js';
import AdminAudit from '../models/adminAudit.js';
import AdminControl from '../models/adminControl.js';
import User from '../models/user.js';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import { PrintApplication } from '../models/printFunding.js';
import Genre from '../models/genre.js';
import UserScore from '../models/userScore.js';
import { moderateVisibility } from './adminVisibility.js';
import { normalizeIsbn } from '../utils/printedBooks.js';

const fail = (message, code = 'BAD_USER_INPUT') => new GraphQLError(message, { extensions: { code } });
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const getResource = name => { const resource = resources.get(name); if (!resource) throw fail('Geçerli bir veri grubu seçin.'); return resource; };
function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive(key) && key !== '__proto__' && key !== 'constructor').map(([key, item]) => [key, scrub(item)]));
  return value;
}
const valuesOf = record => scrub(JSON.parse(JSON.stringify(record.toObject ? record.toObject() : record)));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const revisionOf = values => createHash('sha256').update(JSON.stringify(canonical(values))).digest('hex');
const titleOf = values => String(values.title || values.name || values.username || values.email || values.action || values.content || values.text || values._id).slice(0, 120);
const recordOf = record => { const values = valuesOf(record); return { id: String(record._id), title: titleOf(values), revision: revisionOf(values), values }; };
function validId(resource, id) {
  if (typeof id !== 'string' || !id || (resource.model.schema.path('_id').instance === 'ObjectId' && !mongoose.isObjectIdOrHexString(id))) throw fail('Geçerli bir kayıt kimliği girin.');
}
function reasonOf(reason) {
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) throw fail('İşlem gerekçesi 5–500 karakter olmalı.');
  return reason.trim();
}

export async function getAdminResources(context) {
  await requireAdmin(context);
  return [...resources.values()].map(resource => ({ ...resource, fields: fieldsFor(resource), indexes: resource.model.schema.indexes().map(([keys, options]) => ({ keys, unique: Boolean(options.unique), sparse: Boolean(options.sparse), partialFilter: options.partialFilterExpression || null })) }));
}

export async function getAdminRecords(context, { resource: name, page = 1, limit = 25, search = '', state = 'ALL', relatedField, relatedId }) {
  await requireAdmin(context);
  const resource = getResource(name);
  if (!Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw fail('Geçerli bir sayfa ve liste boyutu seçin.');
  if (search.length > 120 || !['ALL', 'ACTIVE', 'INACTIVE', 'DELETED'].includes(state)) throw fail('Geçerli arama ve durum filtresi seçin.');
  const query = {}, paths = fieldsFor(resource);
  if (state === 'DELETED') query.isDeleted = resource.model.schema.path('isDeleted') ? true : { $exists: true };
  if (state === 'ACTIVE') {
    if (resource.model.schema.path('isDeleted')) query.isDeleted = { $ne: true };
    if (resource.model.schema.path('isActive')) query.isActive = { $ne: false };
  }
  if (state === 'INACTIVE') query.isActive = resource.model.schema.path('isActive') ? false : { $exists: true };
  if (relatedField || relatedId) {
    const field = paths.find(item => item.name === relatedField && item.reference);
    if (!field || !mongoose.isObjectIdOrHexString(relatedId)) throw fail('Geçerli bir ilişki filtresi seçin.');
    query[relatedField] = relatedId;
  }
  const term = search.trim();
  if (term) {
    const expression = new RegExp(escape(term), 'i');
    const searchable = paths.filter(field => !field.sensitive && field.type === 'String' && !field.name.includes('.') && !['content', 'description', 'normalizedText'].includes(field.name));
    const choices = searchable.map(field => ({ [field.name]: expression }));
    if (['Book', 'Transaction'].includes(name)) {
      const users = await User.find({ $or: ['username', 'fullName', 'email'].map(key => ({ [key]: expression })) }).select('_id').lean().exec();
      choices.push({ [name === 'Book' ? 'authorId' : 'userId']: { $in: users.map(user => user._id) } });
      if (name === 'Book') {
        const genres = await Genre.find({ name: expression }).select('_id').lean().exec();
        choices.push({ genreId: { $in: genres.map(genre => genre._id) } });
      } else {
        const books = await Book.find({ title: expression }).select('_id').lean().exec();
        choices.push({ bookId: { $in: books.map(book => book._id) } });
      }
    }
    if (mongoose.isObjectIdOrHexString(term)) {
      choices.push({ _id: term });
      paths.filter(field => field.reference).forEach(field => choices.push({ [field.name]: term }));
    } else if (resource.model.schema.path('_id').instance === 'String') choices.push({ _id: expression });
    if (!choices.length) return { items: [], total: 0, page, totalPages: 0 };
    query.$or = choices;
  }
  const excluded = paths.filter(field => field.sensitive).map(field => `-${field.name}`).join(' ');
  // Long manuscript bodies are available in record detail, not every list row.
  const select = `${excluded} ${name === 'Chapter' ? '-content' : ''}`;
  const [total, records] = await Promise.all([
    resource.model.countDocuments(query).exec(),
    resource.model.find(query).select(select).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
  ]);
  return { total, page, totalPages: Math.ceil(total / limit), items: records.map(recordOf) };
}

export async function getAdminRecord(context, { resource: name, id }) {
  await requireAdmin(context);
  const resource = getResource(name); validId(resource, id);
  const record = await resource.model.findById(id).exec();
  if (!record) return null;
  const result = recordOf(record);
  const references = [];
  for (const field of fieldsFor(resource).filter(field => field.reference && resources.has(field.reference))) {
    const value = record.get(field.name);
    const ids = (Array.isArray(value) ? value : value ? [value] : []).slice(0, 100);
    if (!ids.length) continue;
    const targets = await resources.get(field.reference).model.find({ _id: { $in: ids } }).select('_id title name username email').lean().exec();
    const map = new Map(targets.map(target => [String(target._id), titleOf(target)]));
    for (const key of ids) references.push({ field: field.name, resource: field.reference, id: String(key), title: map.get(String(key)) || 'Kayıt bulunamadı', exists: map.has(String(key)) });
  }
  return { ...result, references };
}

async function checkedChanges(resource, changes, session) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Buffer.byteLength(JSON.stringify(changes)) > 1000000) throw fail('Geçerli alan değişiklikleri gönderin.');
  const result = {};
  for (const [key, value] of Object.entries(changes)) {
    if (!resource.editable.includes(key)) throw fail(`Bu alan düzenlenemez: ${key}`);
    const path = resource.model.schema.path(key);
    if (value === null) { if (path.isRequired) throw fail(`${key} boş bırakılamaz.`); result[key] = null; continue; }
    if (path.instance === 'String' && (typeof value !== 'string' || value.length > (path.options.maxlength || (['content', 'text'].includes(key) ? 500000 : 20000)))) throw fail(`${key} için geçerli uzunlukta metin girin.`);
    if (path.instance === 'Number' && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000000)) throw fail(`${key} için geçerli bir sayı girin.`);
    if (path.instance === 'Boolean' && typeof value !== 'boolean') throw fail(`${key} için açık/kapalı değeri seçin.`);
    const reference = path.options.ref || path.$embeddedSchemaType?.options?.ref || path.caster?.options?.ref;
    if (path.instance === 'Array' && (!Array.isArray(value) || value.length > (reference ? 500 : 30) || value.some(item => typeof item !== 'string' || item.length > 100))) throw fail(`${key} için geçerli ve sınırlı bir liste girin.`);
    if (path.instance === 'Array' && reference) {
      if (value.some(id => !mongoose.isObjectIdOrHexString(id))) throw fail('İlişkiler geçerli kayıt kimliklerinden oluşmalı.');
      const unique = [...new Set(value)];
      const count = await resources.get(reference).model.countDocuments({ _id: { $in: unique }, ...(reference === 'Genre' ? { isActive: true } : {}) }).session(session).exec();
      if (count !== unique.length) throw fail('İlişkili kayıtlardan biri bulunamadı veya pasif.');
      result[key] = unique; continue;
    }
    if (path.instance === 'ObjectId') {
      if (!mongoose.isObjectIdOrHexString(value) || !await resources.get(path.options.ref).model.exists({ _id: value, ...(path.options.ref === 'Genre' ? { isActive: true } : {}) }).session(session)) throw fail('Seçilen ilişkili kayıt bulunamadı veya pasif.');
    }
    if (path.enumValues?.length && !path.enumValues.includes(value)) throw fail(`${key} için listeden seçim yapın.`);
    if (typeof value === 'string' && (/(?:Url|Picture)$/.test(key) || key === 'website') && value) {
      try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { throw fail('Görsel ve bağlantılar geçerli bir HTTPS adresi olmalı.'); }
    }
    result[key] = typeof value === 'string' && !['content', 'text', 'bio'].includes(key) ? value.trim() : value;
  }
  return result;
}

export async function saveAdminRecord(context, { resource: name, id, revision, changes, reason }) {
  await requireAdmin(context);
  const resource = getResource(name), creating = !id;
  if (creating && !resource.canCreate) throw fail('Bu kayıt uygulamanın ilgili oluşturma akışından eklenmeli.');
  if (!creating) validId(resource, id);
  reason = reasonOf(reason);
  await Promise.all([AdminAudit.init(), AdminControl.init(), resource.model.init()]);
  if (name === 'User') {
    try { await AdminControl.updateOne({ _id: 'users' }, { $setOnInsert: { version: 0 } }, { upsert: true }).exec(); }
    catch (error) { if (error.code !== 11000) throw error; }
  }
  try {
    const result = await mongoose.connection.transaction(async session => {
      if (name === 'User') await AdminControl.updateOne({ _id: 'users' }, { $inc: { version: 1 } }, { session }).exec();
      const actor = await requireAdmin(context, session);
      const record = creating ? new resource.model() : await resource.model.findById(id).session(session).exec();
      if (!record) throw fail('Kayıt bulunamadı.');
      if (!creating && revision !== revisionOf(valuesOf(record))) throw fail('Bu kayıt başka bir işlemde değişti. Güncel kaydı yükleyip yeniden düzenleyin.', 'CONFLICT');
      let updates = await checkedChanges(resource, changes, session);
      if (name === 'Genre') {
        updates = normalizeGenre(updates, creating);
        if (updates.name && await Genre.exists({ _id: { $ne: record._id }, name: new RegExp(`^${escape(updates.name)}$`, 'i') }).session(session)) throw fail('Bu tür adı zaten kullanılıyor.');
        if (!creating && updates.name && updates.name !== record.name) await User.updateMany({ 'authorSettings.preferredGenres': record.name }, [{ $set: { 'authorSettings.preferredGenres': { $setUnion: [{ $map: { input: '$authorSettings.preferredGenres', as: 'genre', in: { $cond: [{ $eq: ['$$genre', record.name] }, updates.name, '$$genre'] } } }, []] } } }], { session }).exec();
      }
      if (name === 'User') {
        if (record.isDeleted && updates.isDeleted !== false) throw fail('Bu hesabı düzenlemek için önce arşivden çıkarın.');
        if (String(actor._id) === String(record._id) && ((updates.role && updates.role !== 'ADMIN') || updates.isActive === false || updates.isDeleted === true)) throw fail('Kendi yönetici yetkinizi veya aktif oturumunuzu kaldıramazsınız.');
        if (updates.isDeleted === true) updates.isActive = false;
        if ('username' in updates && !/^[\p{L}\p{N}_-]{3,30}$/u.test(updates.username)) throw fail('Kullanıcı adı 3–30 harf, rakam, alt çizgi veya kısa çizgiden oluşmalı.');
        for (const key of ['username', 'email']) if (updates[key]) {
          if (key === 'email') {
            updates.email = updates.email.toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) throw fail('Geçerli bir e-posta girin.');
          }
          if (await User.exists({ _id: { $ne: record._id }, [key]: new RegExp(`^${escape(updates[key])}$`, 'i') }).session(session)) throw fail('Bu e-posta veya kullanıcı adı zaten kullanılıyor.');
        }
        if (['role', 'isActive', 'isDeleted', 'email'].some(key => key in updates && updates[key] !== record[key])) record.authVersion = (record.authVersion || 0) + 1;
        if (updates.email && updates.email !== record.email) { record.resetPasswordToken = null; record.resetPasswordExpires = null; if (!('isVerified' in updates)) updates.isVerified = false; }
      }
      if (name === 'Quote' && 'text' in updates) {
        if (record.isRepost) throw fail('Yeniden paylaşımın alıntı metni asıl kayıt üzerinden düzenlenmeli.');
        record.normalizedText = normalizeText(updates.text);
        await resource.model.updateMany({ originalQuoteId: record._id, isRepost: true }, { $set: { text: updates.text, normalizedText: record.normalizedText } }, { session }).exec();
      }
      if (name === 'Badge') {
        if ('condition.stat' in updates && !UserScore.schema.path(`stats.${updates['condition.stat']}`)) throw fail('Geçerli bir puan istatistiği seçin.');
        if ('condition.threshold' in updates && (!Number.isSafeInteger(updates['condition.threshold']) || updates['condition.threshold'] < 1)) throw fail('Rozet eşiği pozitif tam sayı olmalı.');
      }
      if (name === 'Book' && 'publicationYear' in updates && updates.publicationYear !== null && (!Number.isInteger(updates.publicationYear) || updates.publicationYear < 1450 || updates.publicationYear > new Date().getFullYear() + 1)) throw fail('Geçerli bir baskı yılı girin.');
      if (name === 'Book') {
        if (record.kind !== 'PRINTED' && ['isbn', 'pageCount', 'printedAuthor', 'publisher', 'publicationYear', 'purchaseUrl', 'publicationEvidenceUrl'].some(key => key in updates)) throw fail('Bu alanlar yalnızca basılı kitap künyesinde düzenlenebilir.');
        if ('isbn' in updates) updates.isbn = updates.isbn ? normalizeIsbn(updates.isbn) : undefined;
        if ('pageCount' in updates && (!Number.isSafeInteger(updates.pageCount) || updates.pageCount < 1 || updates.pageCount > 50000)) throw fail('Basılı kitap sayfa sayısı 1–50000 arasında tam sayı olmalı.');
      }
      if (name === 'Session' && 'coverImageUrl' in updates) updates.coverImageUrl = normalizeSessionCover(updates.coverImageUrl);
      if (name === 'NewsletterSubscription') {
        if (updates.status !== 'unsubscribed') throw fail('Aboneliği yeniden açmak için kullanıcının e-posta onayı gerekir.');
        record.unsubscribedAt = new Date(); record.tokenHash = undefined; record.tokenExpiresAt = undefined;
      }
      if (name === 'UserPreference') {
        const ids = updates.preferredGenres || record.preferredGenres;
        if ((updates.onboardingCompleted ?? record.onboardingCompleted) && !ids.length) throw fail('Tamamlanmış tercihlerde en az bir tür bulunmalı.');
        const genres = await Genre.find({ _id: { $in: ids } }).select('name').session(session).exec();
        await User.updateOne({ _id: record.userId }, { $set: { 'authorSettings.preferredGenres': genres.map(genre => genre.name) } }, { session }).exec();
      }
      if (['Bookmark', 'ReadingProgress'].includes(name)) {
        const chapters = await Chapter.find({ bookId: record.bookId, isDeleted: false }).select('_id title').sort({ createdAt: 1, _id: 1 }).session(session).exec();
        const key = name === 'Bookmark' ? 'chapterId' : 'lastChapterId';
        const chapterId = key in updates ? updates[key] : record[key];
        const index = chapters.findIndex(chapter => String(chapter._id) === String(chapterId));
        if (chapterId && index < 0) throw fail('Seçilen bölüm bu kitapta bulunamadı.');
        if (name === 'Bookmark') {
          if (!Number.isSafeInteger(updates.paragraphIndex ?? record.paragraphIndex)) throw fail('Paragraf numarası tam sayı olmalı.');
          record.chapterIndex = index; record.chapterTitle = chapters[index].title;
        } else {
          const completed = (updates.completedChapters || record.completedChapters).map(String);
          if (completed.some(id => !chapters.some(chapter => String(chapter._id) === id))) throw fail('Okunan bölümler bu kitaba ait olmalı.');
          record.isCompleted = chapters.length > 0 && chapters.every(chapter => completed.includes(String(chapter._id)));
          record.lastReadAt = new Date();
        }
      }
      const audit = new AdminAudit({ actorId: actor._id, resource: name, recordId: String(record._id), action: creating ? 'CREATE' : 'UPDATE', reason, fields: Object.keys(updates) });
      if ('isDeleted' in updates && updates.isDeleted !== record.isDeleted) await moderateVisibility(resource, record, updates.isDeleted, audit._id, session);
      if (name === 'Book' && updates.isDeleted === false) {
        const chapters = await Chapter.find({ bookId: record._id, isDeleted: false }).select('_id pageCount').session(session).exec();
        record.chapters = chapters.map(chapter => chapter._id);
        if (record.kind !== 'PRINTED') record.pageCount = chapters.reduce((sum, chapter) => sum + (chapter.pageCount || 0), 0);
      }
      record.set(updates); await record.save({ session });
      if (name === 'User' && !await User.exists({ role: 'ADMIN', isActive: { $ne: false }, isDeleted: false }).session(session)) throw fail('En az bir aktif yönetici kalmalı.');
      if (name === 'Chapter') {
        const active = await Chapter.find({ bookId: record.bookId, isDeleted: false }).select('_id pageCount').session(session).exec();
        await Book.updateOne({ _id: record.bookId }, { $set: { chapters: active.map(chapter => chapter._id) } }, { session }).exec();
        await Book.updateOne({ _id: record.bookId, kind: { $ne: 'PRINTED' } }, { $set: { pageCount: active.reduce((sum, chapter) => sum + chapter.pageCount, 0) } }, { session }).exec();
      }
      await audit.save({ session });
      return recordOf(record);
    });
    return result;
  } catch (error) {
    if (error.code === 11000) throw fail('Bu ad, kullanıcı adı, e-posta veya URL adı başka bir kayıtta kullanılıyor.');
    if (error.name === 'ValidationError') {
      const invalid = Object.values(error.errors)[0];
      const label = fieldsFor(resource).find(field => field.name === invalid.path)?.label || invalid.path;
      throw fail(`${label}: ${invalid.kind === 'required' ? 'bu alan zorunlu.' : 'geçerli bir değer girin.'}`);
    }
    throw error;
  }
}

export async function getAdminOverview(context) {
  await requireAdmin(context);
  const keys = ['User', 'Book', 'Genre', 'Session', 'Comment', 'Quote'];
  const counts = await Promise.all(keys.map(async name => ({ resource: name, label: getResource(name).label,
    total: await getResource(name).model.countDocuments().exec(),
    active: await getResource(name).model.countDocuments({ ...(getResource(name).model.schema.path('isDeleted') ? { isDeleted: { $ne: true } } : {}), ...(getResource(name).model.schema.path('isActive') ? { isActive: { $ne: false } } : {}) }).exec(),
  })));
  const [pendingBooks, pendingPrintApplications, pendingClaims, pendingSessionAccess, revenue, recent] = await Promise.all([
    Book.countDocuments({ kind: 'PRINTED', publicationStatus: 'PENDING', isDeleted: false }).exec(),
    PrintApplication.countDocuments({ state: 'SUBMITTED' }).exec(),
    getResource('BookClaim').model.countDocuments({ status: 'PENDING' }).exec(),
    User.countDocuments({ isDeleted: false, isActive: { $ne: false }, 'sessionCreationAccess.status': 'PENDING' }).exec(),
    getResource('Transaction').model.aggregate([{ $match: { status: 'SUCCESS' } }, { $group: { _id: '$currency', amount: { $sum: '$amount' }, count: { $sum: 1 } } }]).exec(),
    AdminAudit.find().sort({ createdAt: -1, _id: -1 }).limit(8).exec(),
  ]);
  return { counts, pendingBooks, pendingPrintApplications, pendingClaims, pendingSessionAccess, revenue: revenue.map(item => ({ currency: item._id || 'TRY', amount: item.amount, count: item.count })), recent: recent.map(recordOf) };
}
