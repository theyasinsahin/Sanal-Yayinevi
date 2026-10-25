import { gql } from '@apollo/client';
export const GET_READING_PROGRESS = gql`
  query GetReadingProgress($bookId: ID!) {
    getReadingProgress(bookId: $bookId) {
      id lastChapterId completedChapters lastReadAt isCompleted
    }
  }
`;
export const SAVE_READING_PROGRESS = gql`
  mutation SaveReadingProgress($bookId: ID!, $chapterId: ID!, $completedChapterIds: [ID!]!) {
    saveReadingProgress(bookId: $bookId, chapterId: $chapterId, completedChapterIds: $completedChapterIds) {
      id lastChapterId completedChapters lastReadAt isCompleted
    }
  }
`;
