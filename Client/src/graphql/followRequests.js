import { gql } from '@apollo/client';

export const GET_INCOMING_FOLLOW_REQUESTS = gql`
  query GetIncomingFollowRequests($limit: Int!, $offset: Int!) {
    getIncomingFollowRequests(limit: $limit, offset: $offset) {
      total
      items { id status createdAt requester { id username fullName profilePicture } }
    }
  }
`;

const ACTION_FIELDS = gql`fragment FollowActionFields on FollowActionResult { code message followStatus request { id status } }`;
export const REQUEST_FOLLOW = gql`
  ${ACTION_FIELDS}
  mutation RequestFollow($targetId: ID!) { requestFollowUser(targetId: $targetId) { ...FollowActionFields } }
`;
export const CANCEL_FOLLOW_REQUEST = gql`
  ${ACTION_FIELDS}
  mutation CancelFollowRequest($targetId: ID!) { cancelFollowRequest(targetId: $targetId) { ...FollowActionFields } }
`;
export const UNFOLLOW_USER = gql`
  ${ACTION_FIELDS}
  mutation UnfollowUser($targetId: ID!) { unfollowUser(targetId: $targetId) { ...FollowActionFields } }
`;
export const REMOVE_FOLLOWER = gql`
  ${ACTION_FIELDS}
  mutation RemoveFollower($followerId: ID!) { removeFollower(followerId: $followerId) { ...FollowActionFields } }
`;
export const RESPOND_TO_FOLLOW_REQUEST = gql`
  ${ACTION_FIELDS}
  mutation RespondToFollowRequest($requestId: ID!, $accept: Boolean!) {
    respondToFollowRequest(requestId: $requestId, accept: $accept) { ...FollowActionFields }
  }
`;
