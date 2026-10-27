import { gql } from '@apollo/client';

export const MY_PRINTED_READING = gql`
  query MyPrintedReading($bookId: ID!) {
    myPrintedBookReading(bookId: $bookId) { id userId rating review readAt updatedAt }
  }
`;
export const SAVE_PRINTED_READING = gql`
  mutation SavePrintedReading($bookId: ID!, $rating: Int!, $review: String) {
    savePrintedBookReading(bookId: $bookId, rating: $rating, review: $review) { id userId rating review readAt updatedAt }
  }
`;
export const REMOVE_PRINTED_READING = gql`
  mutation RemovePrintedReading($bookId: ID!) { removePrintedBookReading(bookId: $bookId) }
`;
export const GET_PRINTED_READINGS = gql`
  query GetPrintedReadings($userId: ID!, $page: Int!) {
    getPrintedReadings(userId: $userId, page: $page) {
      total page totalPages canView
      items {
        id userId rating review readAt updatedAt
        book { id publicPath title imageUrl kind publicationStatus printedAuthor publisher }
      }
    }
  }
`;
