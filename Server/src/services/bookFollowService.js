// src/services/bookFollowService.js
import User from '../models/user.js';
import Book from '../models/book.js';
import Notification from '../models/notification.js';

export const toggleBookFollow = async (userId, bookId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('Kullanıcı bulunamadı.');

  const isFollowing = user.followedBooks.includes(bookId);

  if (isFollowing) {
    user.followedBooks.pull(bookId);
  } else {
    user.followedBooks.push(bookId);
  }

  await user.save();

  // Takipçi sayısını hesapla
  const followCount = await User.countDocuments({ followedBooks: bookId });

  return { isFollowing: !isFollowing, followCount };
};

export const isFollowingBook = async (userId, bookId) => {
  const user = await User.findById(userId).select('followedBooks');
  if (!user) return false;
  return user.followedBooks.includes(bookId);
};

export const getFollowedBooks = async (userId) => {
  const user = await User.findById(userId)
    .select('followedBooks')
    .populate({
      path: 'followedBooks',
      populate: [
        { path: 'authorId', select: 'username fullName profilePicture' },
        { path: 'genreId', select: 'name slug hexColor' },
      ]
    });
  return user?.followedBooks || [];
};

// Chapter eklendiğinde takipçilere bildirim gönder
export const notifyBookFollowers = async (bookId, chapterTitle, bookTitle) => {
  // Bu kitabı takip eden tüm kullanıcıları bul
  const followers = await User.find({ followedBooks: bookId }).select('_id');
  if (!followers.length) return;

  // Her takipçiye bildirim oluştur
  const notifications = followers.map(follower => ({
    userId: follower._id,
    type: 'NEW_CHAPTER',
    title: `${bookTitle} — Yeni Bölüm!`,
    message: `"${chapterTitle}" bölümü eklendi.`,
    icon: '📖',
    meta: { bookId, chapterTitle },
  }));

  await Notification.insertMany(notifications);
};