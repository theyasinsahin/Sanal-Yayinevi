import { gql } from '@apollo/client';

export const INITIALIZE_PAYMENT = gql`
  mutation InitializePayment($bookId: ID!, $amount: Float!) {
    initializePayment(bookId: $bookId, amount: $amount) {
      htmlContent
      token
      transactionId
    }
  }
`;