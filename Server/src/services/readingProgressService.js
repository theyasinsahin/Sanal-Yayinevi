import { canReadChapter } from '../utils/chapterAccess.js';
import mongoose from 'mongoose';
import ReadingProgress from '../models/readingProgress.js';
import Chapter from '../models/chapter.js';
import User from '../models/user.js';
import { findBookById } from './bookService.js';
import { inactiveUserIds } from '../utils/activeUsers.js';

export async function readerChapters(userId, bookId) {
  if (!mongoose.isObjectIdOrHexString(bookId)) throw new Error('Geçerli bir kitap seçmelisiniz.');
  const user = await User.findOne({ _id: userId, isDeleted: false, isActive: { $ne: false } }).exec();
  const book = user && await findBookById(bookId, { viewer: user });
  if (!book || (book.status === 'DRAFT' && String(book.authorId) !== String(userId) && user.role !== 'ADMIN')) throw new Error('Kitap bulunamadı veya bu kitaba erişiminiz yok.');
  const chapters = await Chapter.find({ bookId, isDeleted: false, authorId: { $nin: await inactiveUserIds() } }).select('-content').sort({ createdAt: 1, _id: 1 }).exec();
  return chapters.map(chapter => Object.assign(chapter, { canReadContent: canReadChapter(chapter, book, user) }));
}

export async function getReadingProgress(userId, bookId) {
  const chapters = await readerChapters(userId, bookId);
  const progress = await ReadingProgress.findOne({ userId, bookId }).lean().exec();
  if (!progress) return null;
  const completed = new Set((progress.completedChapters || []).map(String));
  return { ...progress,
    lastChapterId: chapters.some(chapter => String(chapter._id) === String(progress.lastChapterId)) ? progress.lastChapterId : null,
    completedChapters: chapters.filter(chapter => chapter.canReadContent && completed.has(String(chapter._id))).map(chapter => chapter._id),
    isCompleted: chapters.length > 0 && chapters.every(chapter => chapter.canReadContent && completed.has(String(chapter._id))),
  };
}

export async function saveReadingProgress(userId, { bookId, chapterId, completedChapterIds }) {
  const chapters = await readerChapters(userId, bookId);
  const current = chapters.find(chapter => String(chapter._id) === String(chapterId));
  if (!current) throw new Error('Kaldığınız bölüm bu kitapta bulunamadı.');
  const completed = new Set(completedChapterIds.map(String));
  const completedChapters = chapters.filter(chapter => chapter.canReadContent && completed.has(String(chapter._id))).map(chapter => chapter._id);
  // A single document update keeps the position, checkboxes and completion flag
  // consistent. Unknown/deleted chapter IDs never enter the progress record.
  return ReadingProgress.findOneAndUpdate({ userId, bookId }, { $set: {
    lastChapterId: current._id, completedChapters, lastReadAt: new Date(),
    isCompleted: chapters.length > 0 && completedChapters.length === chapters.length,
  } }, { upsert: true, new: true, runValidators: true }).exec();
}
