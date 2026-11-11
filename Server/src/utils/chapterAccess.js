import mongoose from 'mongoose';
import Book from '../models/book.js';
import Chapter from '../models/chapter.js';
import { inactiveUserIds } from './activeUsers.js';
import { canReadBook } from './bookAccess.js';

export const registrationGateEnabled = () => process.env.REGISTRATION_GATE_ENABLED === 'true';

// Publication/author restrictions always take precedence over the registration gate.
export function chapterAccessStatus(chapter, book, user, firstChapterId) {
  if (!canReadChapter(chapter, book, user)) {
    return chapter?.isHidden && !chapter.isDeleted && canReadBook(book, user) ? 'HIDDEN' : 'UNAVAILABLE';
  }
  if (registrationGateEnabled() && !user && String(chapter._id || chapter.id) !== String(firstChapterId)) return 'REGISTRATION_REQUIRED';
  return 'READABLE';
}

export function canReadChapter(chapter, book, user) {
  if (!chapter || chapter.isDeleted || !book || book.isDeleted) return false;
  const privileged = user && !user.isDeleted && user.isActive !== false && (user.role === 'ADMIN' || String(book.authorId?._id || book.authorId) === String(user._id || user.id));
  if (!canReadBook(book, user)) return false;
  return !chapter.isHidden || Boolean(privileged);
}

export async function readableChapter(id, user, bookId) {
  if (!mongoose.isObjectIdOrHexString(id)) return null;
  const chapter = await Chapter.findOne({ _id: id, isDeleted: false, ...(bookId ? { bookId } : {}) }).select('-content').lean();
  const book = chapter && await Book.findById(chapter.bookId).lean();
  if (!canReadChapter(chapter, book, user)) return null;
  const inactive = await inactiveUserIds();
  if (inactive.some(id => String(id) === String(book.authorId) || String(id) === String(chapter.authorId))) return null;
  if (registrationGateEnabled() && !user) {
    const first = await Chapter.findOne({ bookId: chapter.bookId, isDeleted: false, isHidden: { $ne: true }, authorId: { $nin: inactive } }).sort({ createdAt: 1, _id: 1 }).select('_id').lean();
    if (chapterAccessStatus(chapter, book, user, first?._id) !== 'READABLE') return null;
  }
  return chapter;
}

export const hiddenChapterIds = () => Chapter.distinct('_id', { isHidden: true }).exec();
