import { WORK_CLASSIFICATION_FIELDS } from '../classification';
import { gql } from '@apollo/client';
import { BOOK_FUNDING_FIELDS } from './book';

export const GET_BOOK_VIEWER = gql`
  query GetBookViewer($id: ID!) {
    getUserById(id: $id) { id role savedBooks { id } }
  }
`;

export const GET_USER_BY_ID = gql`
  ${WORK_CLASSIFICATION_FIELDS}
  ${BOOK_FUNDING_FIELDS}
    query GetUserById($id:ID!){
        getUserById(id: $id){
          followStatus
          canViewProfile
          canViewLibrary
          canViewFollowList
          canMessage
          isSearchIndexable
          weeklyWritingWords
          privacySettings { isProfilePublic isLibraryPublic isFollowListPublic allowMessages showInSearchEngines }
          notificationSettings { newFollower mentionInSession bookComment bookLike quoteLike sessionReply }
          authorSettings { copyrightNote weeklyWordGoal preferredGenres }
          id,
          username,
          fullName,
          email,
          savedBooks {
            ...BookFundingFields
            publicPath
            kind printedAuthor publisher publicationYear isbn
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
            ...WorkClassificationFields
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
            ...BookFundingFields
            publicPath
            kind printedAuthor publisher publicationYear isbn
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
            ...WorkClassificationFields
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
      role
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
      role
      authorSettings { copyrightNote }
    }
  }
`;

