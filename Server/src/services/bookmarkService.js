// src/services/bookmarkService.js
import Bookmark from '../models/bookmark.js';

export const getBookmark = async (userId, bookId) => {
  return await Bookmark.findOne({ userId, bookId });
};

export const setBookmark = async (userId, data) => {
  return await Bookmark.findOneAndUpdate(
    { userId, bookId: data.bookId },
    { userId, ...data },
    { upsert: true, new: true }
  );
};

export const removeBookmark = async (userId, bookId) => {
  await Bookmark.findOneAndDelete({ userId, bookId });
  return { code: 200, message: 'Ayraç kaldırıldı.' };
};