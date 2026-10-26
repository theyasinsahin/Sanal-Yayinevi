import mongoose from 'mongoose';
import { GraphQLError } from 'graphql';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import Quote from '../models/quote.js';
import User from '../models/user.js';
import Session from '../models/session.js';
import { canViewProfile } from '../utils/profileAccess.js';
import { bookPath, chapterPath, profilePath, sessionPath } from './publicUrlService.js';
import { sessionCover } from '../utils/sessionCover.js';

export const SHARE_TYPES = ['BOOK', 'CHAPTER', 'QUOTE', 'PROFILE', 'SESSION'];
const publicStatuses = ['WRITING', 'COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'];
const unavailable = () => new GraphQLError('Bu içerik herkese açık paylaşım için uygun değil veya artık mevcut değil.', { extensions: { code: 'NOT_FOUND' } });
const activeUser = id => User.findOne({ _id: id, isDeleted: false, isActive: { $ne: false } });
export const plainSummary = (text, limit = 240) => {
  const value = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(value);
  return chars.length > limit ? chars.slice(0, limit - 1).join('') + '…' : value;
};

async function publicBook(id) {
  const book = await Book.findOne({ _id: id, isDeleted: false, status: { $in: publicStatuses } });
  if (!book) throw unavailable();
  if (book.kind === 'PRINTED') {
    if (book.publicationStatus !== 'APPROVED') throw unavailable();
  } else if (!book.authorId || !await activeUser(book.authorId)) throw unavailable();
  return book;
}

export async function getPublicQuote(id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw unavailable();
  let quote = await Quote.findOne({ _id: id, isDeleted: false });
  if (quote?.isRepost) quote = await Quote.findOne({ _id: quote.originalQuoteId, isDeleted: false });
  if (!quote) throw unavailable();
  const owner = await activeUser(quote.userId);
  if (!owner || !canViewProfile(owner, null)) throw unavailable();
  await publicBook(quote.bookId);
  return Quote.findById(quote._id)
    .populate('userId', 'username fullName profilePicture')
    .populate('bookId', 'title imageUrl kind authorId publicationStatus').exec();
}

// Only known deployment origins are accepted; share links cannot be used as
// arbitrary redirects. The origin parameter preserves local development URLs.
export function shareWebOrigin(candidate) {
  const configured = new URL(process.env.CLIENT_URL || 'http://localhost:3000').origin;
  const allowed = new Set([configured]);
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000'); allowed.add('http://127.0.0.1:3000');
    for (const value of (process.env.SHARE_ALLOWED_WEB_ORIGINS || '').split(',').filter(Boolean)) allowed.add(new URL(value.trim()).origin);
  }
  const origin = candidate || configured;
  let url;
  try { url = new URL(origin); } catch { throw unavailable(); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !allowed.has(url.origin)) throw unavailable();
  return url.origin;
}

export async function getSocialShare(type, id) {
  if (!SHARE_TYPES.includes(type)) throw unavailable();
  const model = { BOOK: Book, CHAPTER: Chapter, PROFILE: User, SESSION: Session }[type];
  if (model) {
    const record = await model.findOne(type === 'PROFILE' ? { username: id } : { urlSlug: id }).select('_id').lean().exec();
    if (record) id = String(record._id);
    else if (!mongoose.isObjectIdOrHexString(id)) throw unavailable();
  }
  if (!mongoose.isObjectIdOrHexString(id)) throw unavailable();
  let title, description, path, imagePath;
  if (type === 'BOOK') {
    const book = await publicBook(id);
    title = book.title;
    description = plainSummary(book.description) || `${book.title} kitabını Betik'te keşfet.`;
    path = await bookPath(book);
  } else if (type === 'CHAPTER') {
    const chapter = await Chapter.findOne({ _id: id, isDeleted: false });
    if (!chapter) throw unavailable();
    const book = await publicBook(chapter.bookId);
    title = `${chapter.title} — ${book.title}`;
    description = `${book.title} kitabının “${chapter.title}” bölümünü Betik'te oku.`;
    path = await chapterPath(chapter);
  } else if (type === 'QUOTE') {
    const quote = await getPublicQuote(id);
    title = `${quote.bookId.title} kitabından bir alıntı`;
    description = quote.isSpoiler ? 'Bu alıntı spoiler içeriyor. Görmek için Betik’te açın.' : plainSummary(quote.text, 1000);
    path = `/quotes/${quote.id}`;
    id = quote.id;
  } else if (type === 'PROFILE') {
    const profile = await activeUser(id);
    if (!profile) throw unavailable();
    const publicProfile = canViewProfile(profile, null);
    title = publicProfile ? `${profile.fullName || profile.username} — Betik` : 'Betik profil bağlantısı';
    description = publicProfile ? plainSummary(profile.bio) || 'Yazarın kitaplarını ve paylaşımlarını Betik’te keşfet.' : 'Bu profilin paylaşımları, sahibinin gizlilik tercihlerine göre görüntülenir.';
    path = profilePath(profile);
  } else {
    const session = await Session.findOne({ _id: id, isDeleted: false, isActive: true, type: 'OPEN' });
    if (!session || !await activeUser(session.createdBy)) throw unavailable();
    title = session.title;
    description = plainSummary(session.description) || 'Betik’teki bu oturuma katıl ve düşüncelerini paylaş.';
    path = await sessionPath(session);
    imagePath = sessionCover(session);
  }
  const shareKey = decodeURIComponent(path.split('/').pop());
  return { type, id: String(id), shareKey, title: plainSummary(title, 180), description, path, imagePath: imagePath || `/social-share/${type.toLowerCase()}.jpg`, webOrigin: shareWebOrigin() };
}
