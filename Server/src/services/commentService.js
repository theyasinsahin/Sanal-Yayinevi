import Comment from '../models/comment.js';
import Book from '../models/book.js';
import * as ScoreService from './scoreService.js';

// --- OKUMA İŞLEMLERİ ---
// Varsayılan olarak silinmiş (isDeleted: true) yorumlar hariç tutulur.
export const findCommentById = async (id, { includeDeleted = false } = {}) => {
  const query = { _id: id };
  if (!includeDeleted) query.isDeleted = false;
  return await Comment.findOne(query);
};

export const findCommentsByBookId = async (bookId) => {
  return await Comment.find({ bookId, isDeleted: false }).sort({ date: -1 });
};

export const findCommentsByUserId = async (userId) => {
  return await Comment.find({ userId, isDeleted: false }).sort({ date: -1 });
};

export const findAllComments = async () => {
  return await Comment.find({ isDeleted: false }).sort({ date: -1 });
};

// Bir yoruma gelen yanıtları bulmak için (Nested Comments)
export const findRepliesByParentId = async (parentCommentId) => {
  return await Comment.find({ _id: { $in: parentCommentId.replies }, isDeleted: false });
};

// --- YAZMA İŞLEMLERİ ---
export const createComment = async (data) => {
  const newComment = new Comment({ ...data });
  const savedComment = await newComment.save();

  await ScoreService.onCommentCreated(data.userId);

  return await savedComment;
};

// SOFT DELETE — tek bir yorumu işaretler (reply zincirine dokunmaz)
export const deleteComment = async (id) => {
  return await Comment.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true }
  );
};

export const toggleLike = async (commentId, userId) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new Error("Yorum bulunamadı.");

  const index = comment.likedBy.indexOf(userId);
  if (index === -1) {
    comment.likedBy.push(userId); // Beğen
  } else {
    comment.likedBy.splice(index, 1); // Beğeniyi çek
  }
  return await comment.save();
};

// REPLY OLUŞTURMA
export const createReply = async (user, bookId, content, parentCommentId) => {
  const targetComment = await Comment.findOne({ _id: parentCommentId, isDeleted: false }).populate('userId');
  if (!targetComment) throw new Error("Hedef yorum bulunamadı.");

  // Eğer hedef zaten bir yanıtsa, onun ana yorumunu (root) bul
  let rootCommentId = parentCommentId;
  let finalContent = content;

  if (targetComment.parentId) {
    rootCommentId = targetComment.parentId;
    finalContent = `@${targetComment.userId.username} ${content}`;
  }

  const newReply = new Comment({
    userId: user._id,
    bookId,
    content: finalContent,
    parentId: rootCommentId,
    date: new Date().toISOString()
  });

  const savedReply = await newReply.save();

  // Ana yoruma reply referansını ekle
  await Comment.findByIdAndUpdate(rootCommentId, { $push: { replies: savedReply._id } });

  return savedReply;
};

// YORUM SİLME (SOFT DELETE — kendisi ve tüm yanıtları)
export const deleteCommentRecursive = async (commentId) => {
  const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
  if (!comment) throw new Error("Yorum bulunamadı.");

  const now = new Date();

  // 1. Alt yanıtları soft-delete et
  const replyIds = comment.replies || [];
  if (replyIds.length > 0) {
    await Comment.updateMany(
      { _id: { $in: replyIds } },
      { isDeleted: true, deletedAt: now }
    );
  }

  // 2. Eğer bu bir yanıtsa, ana yorumdan referansı sil (döküman hâlâ duruyor, sadece liste temizleniyor)
  if (comment.parentId) {
    await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: commentId } });
  }

  // 3. Kitabın comments referans listesinden çıkar
  await Book.findByIdAndUpdate(comment.bookId, { $pull: { comments: commentId } });

  // 4. Kendisini soft-delete et
  comment.isDeleted = true;
  comment.deletedAt = now;
  await comment.save();

  return { code: 200, message: "Yorum ve yanıtları silindi." };
};

// Bir kitap soft-delete edildiğinde tüm yorumlarını soft-delete etmek için
// bookService.softDeleteBook() tarafından çağrılır.
export const softDeleteCommentsByBookId = async (bookId) => {
  await Comment.updateMany(
    { bookId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() }
  );
};