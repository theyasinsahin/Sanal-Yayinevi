import { hiddenChapterIds } from '../utils/chapterAccess.js';
import mongoose from 'mongoose';
import Book from '../models/book.js';
import { classificationFilter } from './classificationService.js';
import User from '../models/user.js';
import Quote from '../models/quote.js';
import { inactiveUserIds } from '../utils/activeUsers.js';
import { publicQuoteFilter } from '../utils/quoteAccess.js';

const SORTS = { NEWEST: ['publishDate', -1], OLDEST: ['publishDate', 1], UPDATED: ['updatedAt', -1], POPULAR: ['stats.likes', -1] };
const PUBLIC_STATUSES = ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fields = 'urlSlug title description authorId formatId genreIds tagIds narrativeFeatureIds targetAudienceId contentWarningIds classificationStatus imageUrl pageCount publishDate stats createdAt updatedAt status backerCount fundingTarget currentFunding kind printedAuthor publisher publicationYear isbn';

export async function getBookFeed({ limit = 24, after, sort = 'NEWEST', classification, search } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 48 || !SORTS[sort]) throw new Error('Geçerli bir sayfa boyutu ve sıralama seçin.');
  const [field, direction] = SORTS[sort];
  const hiddenUserIds = await inactiveUserIds();
  const clauses = [{ kind: { $ne: 'PRINTED' }, isDeleted: false, status: { $in: PUBLIC_STATUSES }, authorId: { $nin: hiddenUserIds } }];
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
  if (after) {
    try {
      if (after.length > 1000) throw new Error();
      const cursor = JSON.parse(Buffer.from(after, 'base64url').toString());
      if (cursor.sort !== sort || !mongoose.isObjectIdOrHexString(cursor.id)) throw new Error();
      const value = field === 'stats.likes' ? cursor.value : new Date(cursor.value);
      if (field === 'stats.likes' ? !Number.isFinite(value) : Number.isNaN(value.getTime())) throw new Error();
      const operator = direction === -1 ? '$lt' : '$gt';
      clauses.push({ $or: [{ [field]: { [operator]: value } }, { [field]: value, _id: { [operator]: new mongoose.Types.ObjectId(cursor.id) } }] });
    } catch { throw new Error('Sayfalama bağlantısı geçersiz. Listeyi yenileyin.'); }
  }
  const records = await Book.find({ $and: clauses }).sort({ [field]: direction, _id: direction }).limit(limit + 1).select(fields).lean().exec();
  const hasNextPage = records.length > limit;
  const books = records.slice(0, limit).map(record => ({ ...record, id: String(record._id) }));
  const last = books.at(-1);
  const value = last && (field === 'stats.likes' ? last.stats?.likes || 0 : last[field]);
  return { books, hasNextPage, endCursor: last ? Buffer.from(JSON.stringify({ sort, id: last.id, value })).toString('base64url') : null };
}
