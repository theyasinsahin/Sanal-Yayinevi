// src/graphql/mutations/bookmark.js
import { gql } from '@apollo/client';

export const SET_BOOKMARK = gql`
  mutation SetBookmark(
    $bookId: ID!
    $chapterId: ID!
    $chapterIndex: Int!
    $paragraphIndex: Int!
    $chapterTitle: String
  ) {
    setBookmark(
      bookId: $bookId
      chapterId: $chapterId
      chapterIndex: $chapterIndex
      paragraphIndex: $paragraphIndex
      chapterTitle: $chapterTitle
    ) {
      id
      chapterId
      chapterIndex
      paragraphIndex
      chapterTitle
      updatedAt
    }
  }
`;

export const REMOVE_BOOKMARK = gql`
  mutation RemoveBookmark($bookId: ID!) {
    removeBookmark(bookId: $bookId) {
      code
      message
    }
  }
`;