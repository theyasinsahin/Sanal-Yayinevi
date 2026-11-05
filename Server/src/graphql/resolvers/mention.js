import { searchMentionUsers } from '../../services/mentionService.js';

export default {
  Query: {
    searchMentionUsers: (_, { query }, { user }) => {
      if (!user) throw new Error('Giriş yapmalısınız.');
      return searchMentionUsers(user._id, query);
    },
  },
};
