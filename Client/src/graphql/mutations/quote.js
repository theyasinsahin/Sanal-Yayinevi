// src/graphql/mutations/quote.js
import { gql } from '@apollo/client';

export const CREATE_QUOTE_MUTATION = gql`
  mutation CreateQuote(
    $text: String!
    $note: String
    $bookId: ID!
    $chapterId: ID!
    $chapterTitle: String
    $chapterIndex: Int
    $location: QuoteLocationInput
    $isSpoiler: Boolean
  ) {
    createQuote(
      text: $text note: $note bookId: $bookId chapterId: $chapterId
      chapterTitle: $chapterTitle chapterIndex: $chapterIndex location: $location isSpoiler: $isSpoiler
    ) {
      id text note chapterTitle createdAt isSpoiler
    }
  }
`;

export const REPOST_QUOTE_MUTATION = gql`
  mutation RepostQuote($originalQuoteId: ID!, $repostComment: String, $isSpoiler: Boolean) {
    repostQuote(originalQuoteId: $originalQuoteId, repostComment: $repostComment, isSpoiler: $isSpoiler) {
      id text repostComment isRepost createdAt isSpoiler
      originalQuote {
        id text
        user { id username profilePicture }
        book { id title imageUrl }
        isSpoiler
      }
    }
  }
`;

export const DELETE_QUOTE_MUTATION = gql`
  mutation DeleteQuote($id: ID!) {
    deleteQuote(id: $id) { code message }
  }
`;

export const TOGGLE_QUOTE_LIKE_MUTATION = gql`
  mutation ToggleQuoteLike($id: ID!) {
    toggleQuoteLike(id: $id) { id likedBy }
  }
`;

export const ADD_QUOTE_COMMENT_MUTATION = gql`
  mutation AddQuoteComment($quoteId: ID!, $content: String!) {
    addQuoteComment(quoteId: $quoteId, content: $content) {
      id content createdAt
      user { id username profilePicture }
    }
  }
`;

export const DELETE_QUOTE_COMMENT_MUTATION = gql`
  mutation DeleteQuoteComment($id: ID!) {
    deleteQuoteComment(id: $id) { code message }
  }
`;

export const TOGGLE_QUOTE_COMMENT_LIKE_MUTATION = gql`
  mutation ToggleQuoteCommentLike($id: ID!) {
    toggleQuoteCommentLike(id: $id) { id likedBy }
  }
`;

export const UNREPOST_QUOTE_MUTATION = gql`
  mutation UnrepostQuote($originalQuoteId: ID!) {
    unrepostQuote(originalQuoteId: $originalQuoteId)
  }
`;