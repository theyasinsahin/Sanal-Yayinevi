import { GraphQLError } from 'graphql';
import * as CommunityService from '../../services/communityService.js';

// Keep validation errors useful, but do not disclose SMTP/database errors publicly.
const execute = async operation => {
  try { return await operation(); }
  catch (error) {
    if (error instanceof GraphQLError) throw error;
    throw new GraphQLError('İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }
};
const status = async operation => ({ code: 200, ...await execute(operation) });

export default {
  Query: {
    getAuthors: (_, args) => execute(() => CommunityService.getAuthors(args)),
    getCommunityConfig: () => CommunityService.getCommunityConfig(),
  },
  Mutation: {
    sendContactMessage: (_, { input }, { req }) => status(() => CommunityService.sendContactMessage(input, req)),
    subscribeNewsletter: (_, { input }, { req }) => status(() => CommunityService.subscribeNewsletter(input, req)),
    manageNewsletter: (_, args, { req }) => status(() => CommunityService.manageNewsletter(args, req)),
  },
};
