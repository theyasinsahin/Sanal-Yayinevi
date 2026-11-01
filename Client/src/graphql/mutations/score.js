// src/graphql/mutations/score.js
import { gql } from '@apollo/client';

export const ADD_READING_MINUTES = gql`
  mutation AddReadingMinutes($minutes: Int!) {
    addReadingMinutes(minutes: $minutes) {
      totalPoints
    }
  }
`;

export const START_READING_SESSION = gql`
  mutation StartReadingSession($bookId: ID!, $chapterId: ID!) {
    startReadingSession(bookId: $bookId, chapterId: $chapterId) { sessionId }
  }
`;
export const REPORT_READING_TIME = gql`
  mutation ReportReadingTime($sessionId: String!, $sequence: Int!, $seconds: Int!, $chapterId: ID!) {
    reportReadingTime(sessionId: $sessionId, sequence: $sequence, seconds: $seconds, chapterId: $chapterId) {
      sequence acceptedSeconds earnedPoints score { id totalPoints stats { minutesRead } }
    }
  }
`;

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead {
    markNotificationsRead
  }
`;
