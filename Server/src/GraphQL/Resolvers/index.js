import existingQueries from './Queries/index.js';     // Diğer (User, Book) query'lerin
import existingMutations from './Mutations/index.js'; // Diğer (User, Book) mutation'ların
import CommentResolvers from './Comment.js';          // Yeni yazdığımız dosya

export default {
  // 1. QUERY'LERİ BİRLEŞTİR
  Query: {
    ...existingQueries,            // Örn: getUser, getBook
    ...CommentResolvers.Query      // Örn: getCommentById (Buraya eklenir)
  },

  // 2. MUTATION'LARI BİRLEŞTİR
  Mutation: {
    ...existingMutations,          // Örn: createUser
    ...CommentResolvers.Mutation   // Örn: createComment (Buraya eklenir)
  },

  // 3. FIELD RESOLVER'I EKLE (En Kritik Kısım)
  // Comment.js içindeki "Comment" objesini ana resolver'a ekliyoruz.
  // Bu olmazsa userId otomatik dolmaz.
  Comment: CommentResolvers.Comment,

  Book: {
    // GraphQL ne zaman bir Book objesinin "comments" alanını istese burası çalışır
    comments: async (parent, args, { Comment }) => {
      // parent.comments: Veritabanından gelen ID listesidir (["689...", "690..."])
      
      // Bu ID listesini kullanarak Yorumları veritabanından çekiyoruz
      return await Comment.find({ _id: { $in: parent.comments } });
    },

    commentCount: async (parent, args, { Comment }) => {
      // Veritabanındaki 'Comment' tablosunda, bookId'si bu kitabın ID'si olan
      // HER ŞEYİ (Ana yorum + Yanıtlar) say.
      return await Comment.countDocuments({ bookId: parent.id });
    },

    chapters: async (parent, args, { Chapter }) => {
      // parent.chapters: Veritabanındaki ID listesi ["123", "456"]
      // Chapter modelini kullanarak bu ID'lere sahip bölümleri bulup döndürüyoruz.
      try {
        // ID'leri Chapter tablosunda arat
        const chapters = await Chapter.find({ _id: { $in: parent.chapters } });
        return chapters;
      } catch (error) {
        console.error("Chapter Resolver Hatası:", error);
        return [];
      }
    },
  }
};