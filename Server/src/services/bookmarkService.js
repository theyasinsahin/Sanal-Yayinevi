// src/services/bookmarkService.js
import Bookmark from '../models/bookmark.js';
import { readerChapters } from './readingProgressService.js';

export const getBookmark = async (userId, bookId) => {
  const chapters = await readerChapters(userId, bookId);
  const bookmark = await Bookmark.findOne({ userId, bookId }).exec();
  if (!bookmark) return null;
  const index = chapters.findIndex(chapter => String(chapter._id) === String(bookmark.chapterId));
  if (index < 0 || !chapters[index].canReadContent) return null;
  bookmark.chapterIndex = index;
  return bookmark;
};

export const setBookmark = async (userId, data) => {
  const chapters = await readerChapters(userId, data.bookId);
  const chapterIndex = chapters.findIndex(chapter => String(chapter._id) === String(data.chapterId));
  if (chapterIndex < 0 || !chapters[chapterIndex].canReadContent) throw new Error('Ayraç konulacak bölüm bu kitapta bulunamadı.');
  if (!Number.isSafeInteger(data.paragraphIndex) || data.paragraphIndex < 0) throw new Error('Geçerli bir paragraf seçmelisiniz.');
  return await Bookmark.findOneAndUpdate(
    { userId, bookId: data.bookId },
    { ...data, chapterIndex, chapterTitle: chapters[chapterIndex].title, userId },
    { upsert: true, new: true }
  );
};

export const removeBookmark = async (userId, bookId) => {
  await Bookmark.findOneAndDelete({ userId, bookId });
  return { code: 200, message: 'Ayraç kaldırıldı.' };
};
