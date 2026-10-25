import { getPublicQuote, getSocialShare } from '../../services/socialShareService.js';
export default {
  Query: {
    getSocialShare: (_, { type, id }) => getSocialShare(type, id),
    getQuoteById: async (_, { id }) => {
      try { return await getPublicQuote(id); }
      catch (error) { if (error.extensions?.code === 'NOT_FOUND') return null; throw error; }
    },
  },
};
