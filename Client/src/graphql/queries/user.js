import { gql } from '@apollo/client';

export const GET_USER_BY_ID = gql`
    query GetUserById($id:ID!){
        getUserById(id: $id){
          id,    
          username,
          fullName,
          email,
          savedBooks {
            id
            title
            author {
              id
              fullName
              username
              profilePicture
            }
            imageUrl
            genre
            description
            stats {
              views
              shares
              likes
            }
            pageCount
          },
          role,
          usersBooks {
            id
            title
            author {
              id
              fullName
              username
              profilePicture
            }
              imageUrl
            genre
            description
            stats {
              views
              shares
              likes
            }
            pageCount
          },
          bio,
          profilePicture,
          followers{
            id
          },
          following{
            id
          }
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



export const GET_ALL_USERS = gql`
  query GetAllUsers{
    getAllUsers {
      id,
      username,
      email,
      bio
    }
  }
`;

