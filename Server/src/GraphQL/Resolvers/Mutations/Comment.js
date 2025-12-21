import { authenticateUser } from "../../../utils/auth.js";

export const commentMutations = {
    createComment: async (_, { bookId, content }, { Comment, Book, req, User }) => {
    const user = await authenticateUser(req, User);
    if (!bookId || !content) throw new Error("Missing fields");

    try {
        const newComment = new Comment({
            userId: user.id, // Sadece ID kaydediyoruz
            bookId,
            content,
            likes: 0,
            replies: [],
            date: new Date().toISOString()
        });

        const savedComment = await newComment.save();

        // Kitabı güncelle
        await Book.findByIdAndUpdate(
            bookId,
            { 
                $push: { comments: savedComment._id },
            }
        );

        // DEĞİŞİKLİK: populate('userId') KULLANMIYORUZ.
        // Direkt objeyi dönüyoruz. GraphQL şemadaki userId: ID tanımı sayesinde
        // savedComment.userId (ObjectId) otomatik olarak string ID'ye dönüşür.
        return savedComment;

    } catch (error) {
        throw new Error(error.message);
    }
},
  // --- YORUM SİLME ---
  deleteComment: async (_, { id }, { Comment, Book, req, User }) => {
    const user = await authenticateUser(req, User);

    try {
      // 1. Silinecek yorumu bul
      const comment = await Comment.findById(id);
      if (!comment) throw new Error("Comment not found");

      // 2. Yetki Kontrolü: Yorumun sahibi mi?
      if (comment.userId.toString() !== user.id) {
        throw new Error("Action not allowed");
      }

      // --- YENİ MANTIK BAŞLANGICI ---

      // Silinecek toplam yorum sayısını hesapla (Kendisi + Altındaki Yanıtlar)
      const replyIds = comment.replies || [];
      const totalDeletedCount = 1 + replyIds.length;

      // 3. Eğer bu yorumun alt yanıtları (Children) varsa, önce onları topluca sil
      if (replyIds.length > 0) {
        await Comment.deleteMany({ _id: { $in: replyIds } });
      }

      // 4. Eğer silinen yorumun kendisi bir "Yanıt" ise (Parent'ı varsa),
      // Ana yorumun 'replies' listesinden bu yorumun ID'sini çıkar.
      if (comment.parentId) {
        await Comment.findByIdAndUpdate(comment.parentId, {
          $pull: { replies: id }
        });
      }

      // 5. Yorumun kendisini sil
      await Comment.findByIdAndDelete(id);

      // 6. Kitabı Güncelle:
      // - Eğer ana yorumsa 'comments' listesinden ID'yi çıkar. (Yanıt ise bu işlem boşa çalışır ama hata vermez)
      await Book.findByIdAndUpdate(
        comment.bookId,
        { 
          $pull: { comments: id }, 
        }
      );

      // --- YENİ MANTIK BİTİŞİ ---

      return { code: 200, message: "Comment and its replies deleted successfully" };

    } catch (err) {
      throw new Error(err.message);
    }
},
  toggleCommentLike: async (_, { commentId }, { Comment, req, User }) => {
    // 1. Kullanıcı giriş yapmış mı?
    const user = await authenticateUser(req, User); // Senin auth fonksiyonun
    
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) throw new Error("Comment not found");

      // 2. Kullanıcı zaten beğenmiş mi?
      // (likedBy dizisinde kullanıcının ID'si var mı?)
      const index = comment.likedBy.indexOf(user.id);

      if (index === -1) {
        // Listede yoksa -> BEĞEN (Push)
        comment.likedBy.push(user.id);
      } else {
        // Listede varsa -> BEĞENİYİ GERİ AL (Splice/Pull)
        comment.likedBy.splice(index, 1);
      }

      const updatedComment = await comment.save();
      
      // Field resolver sayesinde userId otomatik dolacaktır, direkt dönüyoruz.
      return updatedComment;

    } catch (err) {
      throw new Error(err.message);
    }
  },

  replyToComment: async (_, { bookId, content, parentCommentId }, { Comment, req, User }) => {
    const user = await authenticateUser(req, User);

    try {
      // 1. Hedef yorumu bul
      const targetComment = await Comment.findById(parentCommentId).populate('userId');
      if (!targetComment) throw new Error("Comment not found");

      let rootCommentId = parentCommentId; // Varsayılan olarak hedef yorum ana yorumdur.
      let finalContent = content;

      // 2. MANTIK: Eğer hedef yorumun zaten bir 'parentId'si varsa (yani bu bir yanıtsa)
      if (targetComment.parentId) {
        // Ana yorum ID'sini güncelle (En tepedeki yorumun altına ekle)
        rootCommentId = targetComment.parentId;
        
        // İçeriğin başına @username ekle
        finalContent = `@${targetComment.userId.username} ${content}`;
      }

      // 3. Yeni Yanıtı Oluştur
      const newReply = new Comment({
        userId: user.id,
        bookId,
        content: finalContent,
        parentId: rootCommentId, // Her zaman ana yorumun ID'si
        likedBy: [],
        replies: [],
        date: new Date().toISOString()
      });

      const savedReply = await newReply.save();

      // 4. Ana Yorumun 'replies' dizisine ekle
      await Comment.findByIdAndUpdate(
        rootCommentId,
        { $push: { replies: savedReply._id } }
      );

      // Yanıtı, userId populated olmadan dönebiliriz (Field resolver halledecek)
      return savedReply;

    } catch (error) {
      throw new Error(error.message);
    }
  }

}