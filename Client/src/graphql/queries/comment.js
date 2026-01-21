import { gql } from '@apollo/client';

export const GET_COMMENT_BY_ID = gql`
  query GetCommentById($id: ID!) {
    getCommentById(id: $id) {
      id
      content
      date
      userId # Yazarın ismini çekmek için bu ID'ye ihtiyacımız olacak
      likes
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