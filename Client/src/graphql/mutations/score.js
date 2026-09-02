// src/graphql/mutations/score.js
import { gql } from '@apollo/client';

export const ADD_READING_MINUTES = gql`
  mutation AddReadingMinutes($minutes: Int!) {
    addReadingMinutes(minutes: $minutes) {
      totalPoints
    }
  }
`;

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead {
    markNotificationsRead
  }
`;