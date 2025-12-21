// Resolvers/Comment.js

// 1. Alt dosyaları import et
import { commentQueries } from './Queries/Comment.js';
import { commentMutations } from './Mutations/Comment.js';

// 2. Hepsini tek bir obje olarak export et
export default {
  // Query'leri buraya ekle
  Query: {
    ...commentQueries
  },

  // Mutation'ları buraya ekle
  Mutation: {
    ...commentMutations
  },

  // --- ÖNEMLİ: Field Resolver Buraya Geliyor ---
  // GraphQL'de "Comment" tipi ne zaman dönülse bu çalışır
  Comment: {
    userId: async (parent, args, { User }) => {
      // parent.userId veritabanındaki "689..." string ID'sidir.
      // Bunu User objesine çeviriyoruz.
      return await User.findById(parent.userId);
    },

    // 2. YENİ: Replies'ı getir (Populate mantığı)
    replies: async (parent, args, { Comment }) => {
      // parent.replies içindeki ID'leri kullanarak objeleri çek
      // Sadece ana yorumların replies'ı doludur, yanıtlarınki boştur.
      return await Comment.find({ _id: { $in: parent.replies } });
    }
  }
};