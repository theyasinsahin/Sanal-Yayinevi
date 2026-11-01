import { hiddenChapterIds } from '../utils/chapterAccess.js';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import Book from '../models/book.js';
import { classificationFilter } from './classificationService.js';
import User from '../models/user.js';
import Quote from '../models/quote.js';
import { inactiveUserIds } from '../utils/activeUsers.js';
import { publicQuoteFilter } from '../utils/quoteAccess.js';
import { campaignCatalogMatch, latestCampaignLookup } from './bookFundingService.js';

const SORTS = { NEWEST: ['publishDate', -1], OLDEST: ['publishDate', 1], UPDATED: ['updatedAt', -1], POPULAR: ['stats.likes', -1], CLOSEST_TO_TARGET: ['_fundingRemaining', 1] };
const PUBLIC_STATUSES = ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = 'urlSlug title description authorId formatId genreIds tagIds narrativeFeatureIds targetAudienceId contentWarningIds classificationStatus imageUrl pageCount publishDate stats createdAt updatedAt status digitalStatus writingStatus backerCount fundingTarget currentFunding kind printedAuthor publisher publicationYear isbn';
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

export async function getBookFeed({ limit = 24, after, sort = 'NEWEST', classification, search, funding = 'ALL' } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 48 || !SORTS[sort] || !['ALL', 'ACTIVE', 'FUNDED'].includes(funding)) throw new Error('Geçerli bir sayfa boyutu, destek filtresi ve sıralama seçin.');
  if (sort === 'CLOSEST_TO_TARGET') {
    if (funding === 'FUNDED') throw new Error('Hedefe yakın sıralaması yalnızca desteği açık kitaplarda kullanılabilir.');
    funding = 'ACTIVE';
  }
  const [field, direction] = SORTS[sort];
  const hiddenUserIds = await inactiveUserIds();
  const clauses = [{ kind: { $ne: 'PRINTED' }, isDeleted: false, authorId: { $nin: hiddenUserIds }, $or: [
    { digitalStatus: 'PUBLISHED' }, { digitalStatus: null, status: { $in: PUBLIC_STATUSES } },
  ] }];
  clauses.push(await classificationFilter(classification));
  const term = String(search || '').trim();
  if (term.length > 100) throw new Error('Arama en fazla 100 karakter olabilir.');
  if (term) {
    const expression = new RegExp(escape(term).replace(/[iİıI]/g, '[iİıI]'), 'i');
    const [authors, quotedBookIds] = await Promise.all([
      User.find({ isDeleted: false, isActive: { $ne: false }, $or: [{ username: expression }, { fullName: expression }] }).select('_id').lean().exec(),
      Quote.distinct('bookId', { chapterId: { $nin: await hiddenChapterIds() }, text: expression, isRepost: false, isDeleted: { $ne: true }, userId: { $nin: hiddenUserIds }, ...publicQuoteFilter() }).exec(),
    ]);
    clauses.push({ $or: [{ title: expression }, { authorId: { $in: authors.map(author => author._id) } }, { _id: { $in: quotedBookIds } }] });
  }
  const scope = createHash('sha256').update(JSON.stringify(canonical({ funding, search: term, classification: classification || null }))).digest('hex');
  let cursorClause;
  if (after) {
    try {
      if (after.length > 1000) throw new Error();
      const cursor = JSON.parse(Buffer.from(after, 'base64url').toString());
      if (cursor.sort !== sort || (cursor.funding || 'ALL') !== funding || (cursor.scope && cursor.scope !== scope) || !mongoose.isObjectIdOrHexString(cursor.id)) throw new Error();
      const numeric = ['stats.likes', '_fundingRemaining'].includes(field);
      const value = numeric ? cursor.value : new Date(cursor.value);
      if (numeric ? !Number.isFinite(value) : Number.isNaN(value.getTime())) throw new Error();
      if (field === '_fundingRemaining' && (!Number.isSafeInteger(value) || value < 0 || !cursor.scope)) throw new Error();
      const operator = direction === -1 ? '$lt' : '$gt';
      cursorClause = { $or: [{ [field]: { [operator]: value } }, { [field]: value, _id: { [operator]: new mongoose.Types.ObjectId(cursor.id) } }] };
    } catch { throw new Error('Sayfalama bağlantısı geçersiz. Listeyi yenileyin.'); }
  }
  let records;
  if (funding === 'ALL') {
    if (cursorClause) clauses.push(cursorClause);
    records = await Book.find({ $and: clauses }).sort({ [field]: direction, _id: direction }).limit(limit + 1).select(fields).lean().exec();
  } else {
    records = await Book.aggregate([
      { $match: { $and: clauses } },
      { $project: Object.fromEntries(fields.split(' ').map(key => [key, 1])) },
      ...latestCampaignLookup(),
      { $match: campaignCatalogMatch(funding, new Date()) },
      { $lookup: { from: User.collection.name, localField: 'authorId', foreignField: '_id', pipeline: [
        { $match: { isDeleted: false, isActive: { $ne: false } } }, { $project: { _id: 1 } },
      ], as: '_activeAuthor' } },
      { $match: { '_activeAuthor.0': { $exists: true } } },
      { $set: { _fundingRemaining: { $max: [0, { $subtract: ['$_fundingCampaign.targetMinor', '$_fundingCampaign.acceptedMinor'] }] } } },
      ...(cursorClause ? [{ $match: cursorClause }] : []),
      { $sort: { [field]: direction, _id: direction } }, { $limit: limit + 1 },
      { $unset: ['_campaigns', '_activeAuthor'] },
    ]).exec();
  }
  const hasNextPage = records.length > limit;
  const books = records.slice(0, limit).map(record => ({ ...record, id: String(record._id) }));
  const last = books.at(-1);
  const value = last && (field === 'stats.likes' ? last.stats?.likes || 0 : last[field]);
  return { books, hasNextPage, endCursor: last ? Buffer.from(JSON.stringify({ sort, funding, scope, id: last.id, value })).toString('base64url') : null };
}
