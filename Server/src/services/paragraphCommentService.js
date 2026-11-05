import { readableChapter } from '../utils/chapterAccess.js';
import { notifyMentions } from './mentionService.js';
import User from '../models/user.js';
// src/services/paragraphCommentService.js
import { inactiveUserIds } from '../utils/activeUsers.js';
import ParagraphComment from '../models/paragraphComment.js';

const populate = (query) =>
  query.populate('userId', 'username fullName profilePicture');

export const getParagraphComments = async (chapterId, paragraphIndex, viewer) => {
  if (!await readableChapter(chapterId, viewer)) return [];
  return await populate(
    ParagraphComment.find({ chapterId, paragraphIndex, isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() } }).sort({ createdAt: 1 })
  );
};

export const getParagraphCommentCounts = async (chapterId, viewer) => {
  if (!await readableChapter(chapterId, viewer)) return [];
  const results = await ParagraphComment.aggregate([
    { $match: { isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() }, chapterId: new (await import('mongoose')).default.Types.ObjectId(chapterId) } },
    { $group: { _id: '$paragraphIndex', count: { $sum: 1 } } },
    { $project: { paragraphIndex: '$_id', count: 1, _id: 0 } },
  ]);
  return results;
};

export const addParagraphComment = async (userId, { bookId, chapterId, paragraphIndex, content }) => {
  if (!await readableChapter(chapterId, await User.findById(userId), bookId)) throw new Error('Bu bölümün içeriğine erişiminiz yok.');
  const comment = new ParagraphComment({ userId, bookId, chapterId, paragraphIndex, content });
  const saved = await comment.save();
  await notifyMentions({ actorId: userId, content, type: 'PARAGRAPH_MENTION', message: 'Bir paragraf yorumunda etiketlendin.',
    meta: { bookId: String(bookId), chapterId: String(chapterId), paragraphIndex, commentId: String(saved._id) },
    canAccess: recipient => readableChapter(chapterId, recipient, bookId) });
  return await populate(ParagraphComment.findById(saved._id));
};

export const deleteParagraphComment = async (id, userId) => {
  const comment = await ParagraphComment.findById(id);
  if (!comment) throw new Error('Yorum bulunamadı.');
  if (comment.userId.toString() !== userId.toString()) throw new Error('Yetkisiz işlem.');
  await ParagraphComment.findByIdAndDelete(id);
  return { code: 200, message: 'Yorum silindi.' };
};

export const toggleParagraphCommentLike = async (id, userId) => {
  const comment = await ParagraphComment.findById(id);
  if (!comment) throw new Error('Yorum bulunamadı.');
  if (!await readableChapter(comment.chapterId, await User.findById(userId))) throw new Error('Bu bölüme erişiminiz yok.');
  comment.likedBy.includes(userId)
    ? comment.likedBy.pull(userId)
    : comment.likedBy.push(userId);
  await comment.save();
  return await populate(ParagraphComment.findById(id));
};
