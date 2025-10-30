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