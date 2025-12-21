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