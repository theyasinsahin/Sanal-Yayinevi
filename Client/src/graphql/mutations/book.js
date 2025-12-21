import { gql } from '@apollo/client';

export const LIKE_BOOK_MUTATION = gql`
  mutation LikeBook($bookId: ID!) {
    likeBook(bookId: $bookId) {
      id
      stats {
        likes
      }
      likedBy
    }
  }
`;

export const INCREMENT_BOOK_VIEW_MUTATION = gql`
  mutation IncrementBookViews($id: ID!) {
    incrementBookViews(id: $id) {
      id
      stats {
        views
      }
    }
  }
`;

export const DELETE_BOOK_MUTATION = gql`
  mutation DeleteBook($id: ID!) {
    deleteBook(id: $id) {
      code
      message
    }
  }
`;