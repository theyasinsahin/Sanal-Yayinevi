import { gql } from '@apollo/client';

export const GET_USER_BY_ID = gql`
    query GetUserById($id:ID!){
        getUserById(id: $id){
          id,    
          username,
          fullName,
          email,
          savedBooks,
          role,
          usersBooks,
          bio,
          profilePicture,
          followers,
          following
        }
    }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      username
      email
      bio
      profilePicture
      followers
      following
      savedBooks
      favouriteAuthors
      usersBooks
    }
  }
`;

