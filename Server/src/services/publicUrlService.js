import mongoose from 'mongoose';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import Session from '../models/session.js';
import User from '../models/user.js';
import { findBookById } from './bookService.js';
import { getSessionById } from './sessionService.js';

export const slugify = value => String(value || '').replace(/ı/g, 'i').replace(/İ/g, 'I')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100).replace(/-$/, '');

export const profilePath = user => `/yazar/${encodeURIComponent(user.username)}`;
const identifier = value => value?._id || value?.id || value;

// Allocate once, including for existing records. A conditional update and unique
// index make simultaneous requests safe; titles can change without breaking links.
export async function permanentSlug(Model, record, title) {
  if (record.urlSlug) return record.urlSlug;
  const id = identifier(record);
  const stored = await Model.findById(id).select('urlSlug').lean().exec();
  if (!stored) throw new Error('İçerik bulunamadı.');
  if (stored.urlSlug) return stored.urlSlug;
  const base = slugify(typeof title === 'function' ? await title() : title) || 'icerik';
  for (let suffix = 1; suffix < 10000; suffix++) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    try {
      const updated = await Model.findOneAndUpdate(
        { _id: id, urlSlug: { $exists: false } },
        { $set: { urlSlug: candidate } }, { new: true, timestamps: false }
      ).select('urlSlug').lean().exec();
      if (updated) return updated.urlSlug;
      return (await Model.findById(id).select('urlSlug').lean().exec()).urlSlug;
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  throw new Error('Bu içerik için benzersiz adres oluşturulamadı.');
}

export async function bookPath(book) {
  const slug = await permanentSlug(Book, book, async () => {
    const author = book.authorId && await User.findById(identifier(book.authorId)).select('username').lean().exec();
    const title = slugify(book.title).slice(0, 69).replace(/-$/, '') || 'kitap';
    const authorName = slugify(author?.username || book.printedAuthor || 'betik').slice(0, 30).replace(/-$/, '') || 'betik';
    return `${title}-${authorName}`;
  });
  return `/kitap/${slug}`;
}

export async function chapterPath(chapter) {
  const book = await Book.findById(identifier(chapter.bookId)).exec();
  if (!book) throw new Error('Kitap bulunamadı.');
  // Chapter slugs are globally unique, so a chapter stays addressable after edits.
  const slug = await permanentSlug(Chapter, chapter, chapter.title || 'bolum');
  return `${await bookPath(book)}/bolum/${slug}`;
}

export async function sessionPath(session) {
  return `/oturum/${await permanentSlug(Session, session, session.title)}`;
}

export async function resolvePublicRoute({ type, reference, legacy = false, chapter }, viewer) {
  let record;
  if (legacy && !mongoose.isObjectIdOrHexString(reference)) return null;
  if (type === 'PROFILE') {
    record = await User.findOne({ ...(legacy ? { _id: reference } : { username: reference }), isDeleted: false, isActive: { $ne: false } }).exec();
    return record ? { id: record.id, path: profilePath(record) } : null;
  }
  if (type === 'BOOK') {
    const match = await Book.findOne(legacy ? { _id: reference } : { urlSlug: reference }).exec();
    record = match && await findBookById(match.id, { viewer });
    if (!record) return null;
    const path = await bookPath(record);
    if (!chapter) return { id: record.id, path };
    const part = await Chapter.findOne({ bookId: record._id, isDeleted: false,
      ...(legacy ? (mongoose.isObjectIdOrHexString(chapter) ? { _id: chapter } : { _id: null }) : { urlSlug: chapter }) }).exec();
    return part ? { id: record.id, chapterId: part.id, path: await chapterPath(part) } : null;
  }
  if (type === 'SESSION') {
    const match = await Session.findOne(legacy ? { _id: reference } : { urlSlug: reference }).exec();
    record = match && await getSessionById(match.id, viewer?._id);
    return record ? { id: String(identifier(record)), path: await sessionPath(record) } : null;
  }
  return null;
}
