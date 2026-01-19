import Comment from '../models/comment.js';
import Book from '../models/book.js';


// --- OKUMA İŞLEMLERİ ---
export const findCommentById = async (id) => {
  return await Comment.findById(id);
};

export const findCommentsByBookId = async (bookId) => {
  // Yorumları tarihe göre (yeniden eskiye) sıralı getir
  return await Comment.find({ bookId }).sort({ date: -1 });
};

export const findCommentsByUserId = async (userId) => {
  return await Comment.find({ userId }).sort({ date: -1 });
};

export const findAllComments = async () => {
  return await Comment.find().sort({ date: -1 });
};

// Bir yoruma gelen yanıtları bulmak için (Nested Comments)
export const findRepliesByParentId = async (parentCommentId) => {
  // Model yapında 'replies' diye bir array tutuyorsan farklı, 
  // 'parentCommentId' diye bir alan tutuyorsan farklı çalışır.
  // Genelde scalable olan yöntem 'parentCommentId' tutmaktır.
  // Ancak senin TypeDef'inde 'replies: [Comment]' var. 
  // Mongoose şemanda eğer children'ları ID array olarak tutuyorsan:
  return await Comment.find({ _id: { $in: parentCommentId.replies } });
  
  // EĞER Mongoose şemanda "parentCommentId" varsa:
  // return await Comment.find({ parentCommentId: parentCommentId });
};

// --- YAZMA İŞLEMLERİ (Mutation Hazırlığı) ---
export const createComment = async (data) => {
  const newComment = new Comment(data);
  return await newComment.save();
};

export const deleteComment = async (id) => {
  return await Comment.findByIdAndDelete(id);
};

export const toggleLike = async (commentId, userId) => {
  const comment = await Comment.findById(commentId);
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
    const targetComment = await Comment.findById(parentCommentId).populate('userId');
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

// YORUM SİLME (COMPLEX LOGIC)
export const deleteCommentRecursive = async (commentId) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new Error("Yorum bulunamadı.");

    // 1. Alt yanıtları sil
    const replyIds = comment.replies || [];
    if (replyIds.length > 0) {
        await Comment.deleteMany({ _id: { $in: replyIds } });
    }

    // 2. Eğer bu bir yanıtsa, ana yorumdan referansı sil
    if (comment.parentId) {
        await Comment.findByIdAndUpdate(comment.parentId, { $pull: { replies: commentId } });
    }

    // 3. Kitaptan sil
    await Book.findByIdAndUpdate(comment.bookId, { $pull: { comments: commentId } });

    // 4. Kendisini sil
    await Comment.findByIdAndDelete(commentId);

    return { code: 200, message: "Yorum ve yanıtları silindi." };
};