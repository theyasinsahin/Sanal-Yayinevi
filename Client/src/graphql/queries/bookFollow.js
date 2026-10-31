import { WORK_CLASSIFICATION_FIELDS } from '../classification';
// src/graphql/queries/bookFollow.js
import { gql } from '@apollo/client';

export const IS_FOLLOWING_BOOK = gql`
  query IsFollowingBook($bookId: ID!) {
    isFollowingBook(bookId: $bookId)
  }
`;

export const GET_FOLLOWED_BOOKS = gql`
  ${WORK_CLASSIFICATION_FIELDS}
  query GetFollowedBooks {
    getFollowedBooks {
      publicPath
      id
      title
      imageUrl
      status
      author {
        id
        fullName
        username
        profilePicture
      }
      ...WorkClassificationFields
      stats {
        views
        likes
      }
    }
  }
`;