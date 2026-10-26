import * as access from '../../services/sessionAccessService.js';

export default {
  Query: {
    mySessionCreationAccess: (_, __, context) => access.getMySessionAccess(context),
    sessionAccessRequests: (_, args, context) => access.getSessionAccessRequests(context, args),
  },
  Mutation: {
    requestSessionCreationAccess: (_, { reason }, context) => access.requestSessionAccess(context, reason),
    reviewSessionCreationAccess: (_, args, context) => access.reviewSessionAccess(context, args),
  },
};
