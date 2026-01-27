import { gql } from '@apollo/client';

export const GET_ALL_TRANSACTIONS = gql`
  query GetAllTransactions {
    getAllTransactions {
      id
      amount
      currency
      status
      createdAt
      userId {
        username
        email
        profilePicture
      }
      bookId {
        title
        imageUrl
      }
    }
  }
`;