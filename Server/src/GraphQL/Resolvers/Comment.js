import * as CommentService from '../../services/commentService.js';
import * as UserService from '../../services/userService.js';
import { authenticateUser } from '../../utils/auth.js';

export default {
  Query: {
    getCommentsByBookId: async (_, { bookId }) => {
      return CommentService.findCommentsByBookId(bookId);
    },

    getCommentById: async (_, { id }) => {
      const comment = await CommentService.findCommentById(id);
      if (!comment) throw new Error("Comment not found");
      return comment;
    },

    getCommentsByUserId: async (_, { userId }) => {
      return CommentService.findCommentsByUserId(userId);
    },

    getAllComments: async () => {
      return CommentService.findAllComments();
    }
  },

    Mutation: {
        createComment: async (_, { bookId, content }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if(!user) throw new Error("Giriş yapmalısınız");
            
            // Kitap referansını güncelleme işini Service içindeki createComment'e ekleyebilirsin
            // veya burada basitçe bırakabilirsin. Service'i güncellemeni öneririm.
            return CommentService.createComment({
                userId: user._id,
                bookId,
                content,
                date: new Date().toISOString()
            });
        },

        replyToComment: async (_, { bookId, content, parentCommentId }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if(!user) throw new Error("Giriş yapmalısınız");

            return CommentService.createReply(user, bookId, content, parentCommentId);
        },

        deleteComment: async (_, { id }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if(!user) throw new Error("Giriş yapmalısınız");

            const comment = await CommentService.findCommentById(id);
            
            // Yetki: Yorum sahibi mi?
            if (comment.userId.toString() !== user._id.toString()) {
                throw new Error("Yetkiniz yok.");
            }

            return CommentService.deleteCommentRecursive(id);
        },

        toggleCommentLike: async (_, { commentId }, { req, User }) => {
            const user = await authenticateUser(req, User);
            if(!user) throw new Error("Giriş yapmalısınız");
            
            return CommentService.toggleLike(commentId, user._id);
        }
    },

  // FIELD RESOLVERS (İlişkileri Çözme)
  Comment: {
    // comment.userId (User Objesi) istendiğinde çalışır
    userId: async (parent) => {
      // parent.userId veritabanındaki ID'dir.
      // Bunu kullanarak User objesini bulup dönüyoruz.
      return UserService.findUserById(parent.userId);
    },

    // comment.replies istendiğinde çalışır
    replies: async (parent) => {
        // Eğer yorumun içinde reply ID'leri varsa onları populate ederiz
        // Veya parentId mantığı varsa servisten çağırırız.
        // Şimdilik boş dizi veya servisteki logic:
        if (parent.replies && parent.replies.length > 0) {
             // Bu logic, replies array'inde ID'ler tutulduğunu varsayar
             // Service'e findCommentsByIds gibi bir metod ekleyip kullanabilirsin
             // Şimdilik null veya boş dönelim, yapıya göre güncellersin.
             return []; 
        }
        return [];
    }
  },
};