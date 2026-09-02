// src/graphql/queries/bookFollow.js
import { gql } from '@apollo/client';

export const IS_FOLLOWING_BOOK = gql`
  query IsFollowingBook($bookId: ID!) {
    isFollowingBook(bookId: $bookId)
  }
`;

export const GET_FOLLOWED_BOOKS = gql`
  query GetFollowedBooks {
    getFollowedBooks {
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
      genre {
        name
        slug
        hexColor
      }
      stats {
        views
        likes
      }
    }
  }
`;