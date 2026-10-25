import { gql } from '@apollo/client';
export const GET_SOCIAL_SHARE = gql`
  query GetSocialShare($type: SocialShareType!, $id: ID!) {
    getSocialShare(type: $type, id: $id) { type id title description path imagePath webOrigin }
  }
`;
