import { getPublicQuote, getSocialShare } from '../../services/socialShareService.js';
import { requireQuote } from '../../utils/quoteAccess.js';
import Quote from '../../models/quote.js';
export default {
  Query: {
    getSocialShare: (_, { type, id }) => getSocialShare(type, id),
    getQuoteById: async (_, { id }, { user }) => {
      try {
        const quote = await requireQuote(id, user);
        if (quote.visibility === 'PRIVATE') return Quote.findById(quote._id)
          .populate('userId', 'username fullName profilePicture').populate('bookId', 'title imageUrl urlSlug kind authorId');
        return await getPublicQuote(id);
      }
      catch (error) { if (error.extensions?.code === 'NOT_FOUND') return null; throw error; }
    },
  },
};
