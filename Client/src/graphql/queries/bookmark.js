// src/graphql/queries/bookmark.js
import { gql } from '@apollo/client';

export const GET_BOOKMARK = gql`
  query GetBookmark($bookId: ID!) {
    getBookmark(bookId: $bookId) {
      id
      chapterId
      chapterIndex
      paragraphIndex
      chapterTitle
      updatedAt
    }
  }
`;