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

export const UPDATE_USER_MUTATION = gql`
    mutation UpdateProfile($username: String!, $fullName: String!, $bio: String!, $profilePicture: String) {
      updateProfile(username: $username, fullName: $fullName, bio: $bio, profilePicture: $profilePicture) {
        id  
        username
        fullName
        bio
        profilePicture
      }
    }`;