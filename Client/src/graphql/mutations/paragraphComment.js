// src/graphql/mutations/paragraphComment.js
import { gql } from '@apollo/client';

export const ADD_PARAGRAPH_COMMENT = gql`
  mutation AddParagraphComment(
    $bookId: ID!
    $chapterId: ID!
    $paragraphIndex: Int!
    $content: String!
  ) {
    addParagraphComment(
      bookId: $bookId
      chapterId: $chapterId
      paragraphIndex: $paragraphIndex
      content: $content
    ) {
      id content createdAt
      user { id username fullName profilePicture }
    }
  }
`;

export const DELETE_PARAGRAPH_COMMENT = gql`
  mutation DeleteParagraphComment($id: ID!) {
    deleteParagraphComment(id: $id) { code message }
  }
`;

export const TOGGLE_PARAGRAPH_COMMENT_LIKE = gql`
  mutation ToggleParagraphCommentLike($id: ID!) {
    toggleParagraphCommentLike(id: $id) { id likedBy }
  }
`;