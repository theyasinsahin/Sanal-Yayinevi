// src/graphql/queries/quote.js
import { gql } from '@apollo/client';

const QUOTE_FIELDS = gql`
  fragment QuoteFields on Quote {
    id text note visibility chapterTitle chapterIndex pageNumber likedBy isRepost repostComment repostedBy createdAt isSpoiler
    user { id username fullName profilePicture }
    book { publicPath id title imageUrl }
    originalQuote {
      id text note visibility chapterTitle pageNumber
      user { id username fullName profilePicture }
      book { publicPath id title imageUrl }
    }
    commentCount
  }
`;

export const GET_QUOTE_BY_ID = gql`
  ${QUOTE_FIELDS}
  query GetQuoteById($id: ID!) { getQuoteById(id: $id) { ...QuoteFields } }
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
  query CheckQuoteExists($text: String!, $bookId: ID!, $visibility: QuoteVisibility = PUBLIC) {
    checkQuoteExists(text: $text, bookId: $bookId, visibility: $visibility) {
      exists
      quote {
        id text visibility
        user { id username profilePicture }
        book { publicPath id title }
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
