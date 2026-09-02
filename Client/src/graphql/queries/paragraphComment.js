// src/graphql/queries/paragraphComment.js
import { gql } from '@apollo/client';

export const GET_PARAGRAPH_COMMENTS = gql`
  query GetParagraphComments($chapterId: ID!, $paragraphIndex: Int!) {
    getParagraphComments(chapterId: $chapterId, paragraphIndex: $paragraphIndex) {
      id content likedBy createdAt
      user { id username fullName profilePicture }
    }
  }
`;

export const GET_PARAGRAPH_COMMENT_COUNTS = gql`
  query GetParagraphCommentCounts($chapterId: ID!) {
    getParagraphCommentCounts(chapterId: $chapterId) {
      paragraphIndex
      count
    }
  }
`;