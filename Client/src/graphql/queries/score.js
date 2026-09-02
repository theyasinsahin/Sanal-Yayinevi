// src/graphql/queries/score.js
import { gql } from '@apollo/client';

export const GET_LEADERBOARD = gql`
  query GetLeaderboard($period: String) {
    getLeaderboard(period: $period) {
      rank
      points
      user {
        id
        username
        fullName
        profilePicture
      }
    }
  }
`;

export const GET_USER_SCORE = gql`
  query GetUserScore($userId: ID!) {
    getUserScore(userId: $userId) {
      totalPoints
      dailyPoints
      weeklyPoints
      monthlyPoints
      stats {
        quotesCreated
        commentsCreated
        repostsCreated
        booksPublished
        chaptersAdded
        minutesRead
      }
    }
  }
`;

export const GET_USER_RANK = gql`
  query GetUserRank($userId: ID!, $period: String) {
    getUserRank(userId: $userId, period: $period) {
      rank
      points
    }
  }
`;

export const GET_USER_BADGES = gql`
  query GetUserBadges($userId: ID!) {
    getUserBadges(userId: $userId) {
      id
      earnedAt
      badge {
        key
        name
        description
        icon
      }
    }
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    getNotifications {
      id
      type
      title
      message
      icon
      isRead
      createdAt
    }
  }
`;

export const GET_UNREAD_NOTIFICATION_COUNT = gql`
  query GetUnreadNotificationCount {
    getUnreadNotificationCount
  }
`;