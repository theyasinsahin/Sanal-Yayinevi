// src/graphql/mutations/bookFollow.js
import { gql } from '@apollo/client';

export const TOGGLE_BOOK_FOLLOW = gql`
  mutation ToggleBookFollow($bookId: ID!) {
    toggleBookFollow(bookId: $bookId) {
      isFollowing
      followCount
    }
  }
`;