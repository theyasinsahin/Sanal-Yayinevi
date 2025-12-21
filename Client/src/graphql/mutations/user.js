import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($username: String!, $fullName: String!, $email: String!, $password: String!) {
    register(username: $username, fullName: $fullName, email: $email, password: $password) {
      code
      message
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        username
        fullName
        email
      }
    }
  }
`;

export const TOGGLE_SAVED_BOOK_MUTATION = gql`
  mutation ToggleSaveBook($bookId: ID!) {
    toggleSaveBook(bookId: $bookId) {
      id
      savedBooks
    }
  }
`;

export const TOGGLE_FOLLOW_MUTATION = gql`
  mutation ToggleFollowUser($followId: ID!) {
    toggleFollowUser(followId: $followId) {
      code
      message
    }
  }
`;