import { gql } from '@apollo/client';

export const SEARCH_MENTION_USERS = gql`
  query SearchMentionUsers($query: String!) {
    searchMentionUsers(query: $query) { id username fullName profilePicture }
  }
`;
