import * as FollowService from '../../services/followService.js';
import User from '../../models/user.js';

function authenticated(user) {
  if (!user) throw new Error('Giriş yapmalısınız.');
  return user._id;
}

export default {
  Query: {
    getIncomingFollowRequests: (_, { limit, offset }, { user }) => FollowService.getIncomingFollowRequests(authenticated(user), limit, offset),
  },
  Mutation: {
    requestFollowUser: (_, { targetId }, { user }) => FollowService.requestFollow(authenticated(user), targetId),
    cancelFollowRequest: (_, { targetId }, { user }) => FollowService.cancelFollowRequest(authenticated(user), targetId),
    unfollowUser: (_, { targetId }, { user }) => FollowService.unfollowUser(authenticated(user), targetId),
    removeFollower: (_, { followerId }, { user }) => FollowService.removeFollower(authenticated(user), followerId),
    respondToFollowRequest: (_, { requestId, accept }, { user }) => FollowService.respondToFollowRequest(authenticated(user), requestId, accept),
  },
  User: {
    followStatus: (profile, _, { user }) => FollowService.getFollowStatus(user?._id, profile._id ?? profile.id),
  },
  FollowRequest: {
    requester: request => request.requesterId?.username ? request.requesterId : User.findById(request.requesterId),
    createdAt: request => new Date(request.createdAt).toISOString(),
  },
};
