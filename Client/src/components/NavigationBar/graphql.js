import { gql } from '@apollo/client';

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