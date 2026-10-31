import mongoose from 'mongoose';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import { inactiveUserIds } from './activeUsers.js';

export function canReadChapter(chapter, book, user) {
  if (!chapter || chapter.isDeleted || !book || book.isDeleted) return false;
  const privileged = user && !user.isDeleted && user.isActive !== false && (user.role === 'ADMIN' || String(book.authorId?._id || book.authorId) === String(user._id || user.id));
  if ((book.status === 'DRAFT' || (book.kind === 'PRINTED' && book.publicationStatus !== 'APPROVED')) && !privileged) return false;
  return !chapter.isHidden || Boolean(privileged);
}

export async function readableChapter(id, user, bookId) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  const chapter = await Chapter.findOne({ _id: id, isDeleted: false, ...(bookId ? { bookId } : {}) }).select('-content').lean();
  const book = chapter && await Book.findById(chapter.bookId).lean();
  if (!canReadChapter(chapter, book, user)) return null;
  const inactive = await inactiveUserIds();
  return inactive.some(id => String(id) === String(book.authorId) || String(id) === String(chapter.authorId)) ? null : chapter;
}

export const hiddenChapterIds = () => Chapter.distinct('_id', { isHidden: true }).exec();
