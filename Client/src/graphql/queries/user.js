import { gql } from '@apollo/client';

export const GET_USER_BY_ID = gql`
    query GetUserById($id:ID!){
        getUserById(id: $id){
          isPremium,
          id,    
          username,
          fullName,
          email,
          savedBooks {
            status
            id
            title
            author {
              id
              fullName
              username
              profilePicture
            }
            imageUrl
            genre{
              name
              slug
              iconUrl
              hexColor
              isActive
            }
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
            status
            id
            title
            author {
              id
              fullName
              username
              profilePicture
            }
              imageUrl
            genre{
              name
              slug
              iconUrl
              hexColor
              isActive
            }
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
            username
            profilePicture
            fullName
          },
          following{
            id
            username
            profilePicture
            fullName
          },
        }
}
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
    }
  }
`;



export const GET_ALL_USERS = gql`
  query GetAllUsers{
    getAllUsers {
      isPremium,
      id,
      username,
      email,
      bio
    }
  }
`;

