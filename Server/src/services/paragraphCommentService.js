// src/services/paragraphCommentService.js
import { inactiveUserIds } from '../utils/activeUsers.js';
import ParagraphComment from '../models/paragraphComment.js';

const populate = (query) =>
  query.populate('userId', 'username fullName profilePicture');

export const getParagraphComments = async (chapterId, paragraphIndex) => {
  return await populate(
    ParagraphComment.find({ chapterId, paragraphIndex, isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() } }).sort({ createdAt: 1 })
  );
};

export const getParagraphCommentCounts = async (chapterId) => {
  const results = await ParagraphComment.aggregate([
    { $match: { isDeleted: { $ne: true }, userId: { $nin: await inactiveUserIds() }, chapterId: new (await import('mongoose')).default.Types.ObjectId(chapterId) } },
    { $group: { _id: '$paragraphIndex', count: { $sum: 1 } } },
    { $project: { paragraphIndex: '$_id', count: 1, _id: 0 } },
  ]);
  return results;
};

export const addParagraphComment = async (userId, { bookId, chapterId, paragraphIndex, content }) => {
  const comment = new ParagraphComment({ userId, bookId, chapterId, paragraphIndex, content });
  const saved = await comment.save();
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
  comment.likedBy.includes(userId)
    ? comment.likedBy.pull(userId)
    : comment.likedBy.push(userId);
  await comment.save();
  return await populate(ParagraphComment.findById(id));
};