// src/graphql/queries/quote.js
import { gql } from '@apollo/client';

const QUOTE_FIELDS = gql`
  fragment QuoteFields on Quote {
    id text note chapterTitle chapterIndex likedBy isRepost repostComment repostedBy createdAt isSpoiler
    user { id username fullName profilePicture }
    book { id title imageUrl }
    originalQuote {
      id text note chapterTitle
      user { id username fullName profilePicture }
      book { id title imageUrl }
    }
    commentCount
  }
`;

export const GET_QUOTES_FEED = gql`
  ${QUOTE_FIELDS}
  query GetQuotesFeed($limit: Int, $offset: Int, $sortBy: String) {
    getQuotesFeed(limit: $limit, offset: $offset, sortBy: $sortBy) {
      ...QuoteFields
    }
  }
`;

export const GET_QUOTES_BY_USER = gql`
  ${QUOTE_FIELDS}
  query GetQuotesByUser($userId: ID!) {
    getQuotesByUser(userId: $userId) {
      ...QuoteFields
    }
  }
`;

export const GET_QUOTES_BY_BOOK = gql`
  ${QUOTE_FIELDS}
  query GetQuotesByBook($bookId: ID!) {
    getQuotesByBook(bookId: $bookId) {
      ...QuoteFields
    }
  }
`;

export const SEARCH_QUOTES = gql`
  ${QUOTE_FIELDS}
  query SearchQuotes($query: String!, $limit: Int, $offset: Int) {
    searchQuotes(query: $query, limit: $limit, offset: $offset) {
      ...QuoteFields
    }
  }
`;

export const CHECK_QUOTE_EXISTS = gql`
  query CheckQuoteExists($text: String!, $bookId: ID!) {
    checkQuoteExists(text: $text, bookId: $bookId) {
      exists
      quote {
        id text
        user { id username profilePicture }
        book { id title }
        likedBy repostedBy
      }
    }
  }
`;

export const GET_QUOTE_COMMENTS = gql`
  query GetQuoteComments($quoteId: ID!) {
    getQuoteComments(quoteId: $quoteId) {
      id content likedBy createdAt
      user { id username profilePicture }
    }
  }
`;