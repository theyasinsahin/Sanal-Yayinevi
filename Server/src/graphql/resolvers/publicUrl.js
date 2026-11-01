import { bookPath, chapterPath, profilePath, sessionPath, resolvePublicRoute } from '../../services/publicUrlService.js';

export default {
  Query: { resolvePublicRoute: async (_, args, { user }) => resolvePublicRoute(args, user) },
  User: { publicPath: profilePath },
  Book: { publicPath: bookPath },
  Chapter: { publicPath: chapterPath },
  Session: { publicPath: sessionPath },
};
