import { gql } from '@apollo/client';

export const GET_COMMENT_BY_ID = gql`
  query GetCommentById($id: ID!) {
    getCommentById(id: $id) {
      id
      content
      date
      userId { id username profilePicture }
      likedBy
    }
  }
`;

export const GET_COMMENTS_BY_BOOK_ID = gql`
  query GetCommentsByBookId($bookId: ID!) {
    getCommentsByBookId(bookId: $bookId) {
      id
      content
      date
      parentId
      userId {
        id
        username
        profilePicture
      }
      likedBy
    }
  }
`;
