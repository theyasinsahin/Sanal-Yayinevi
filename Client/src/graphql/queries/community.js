import { gql } from '@apollo/client';

export const GET_AUTHORS = gql`
  query GetAuthors($page: Int) {
    getAuthors(page: $page) {
      total page pageSize totalPages
      authors { id username fullName bio profilePicture bookCount pageCount }
    }
  }
`;

export const GET_COMMUNITY_CONFIG = gql`
  query GetCommunityConfig {
    getCommunityConfig { email phone socials { instagram x linkedin tiktok } }
  }
`;
