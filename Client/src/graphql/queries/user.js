import { WORK_CLASSIFICATION_FIELDS } from '../classification';
import { gql } from '@apollo/client';
import { BOOK_FUNDING_FIELDS } from './book';

export const GET_BOOK_VIEWER = gql`
  query GetBookViewer($id: ID!) {
    getUserById(id: $id) { id role savedBooks { id } }
  }
`;

const PROFILE_BOOK_FIELDS = gql`
  ${WORK_CLASSIFICATION_FIELDS}
  ${BOOK_FUNDING_FIELDS}
  fragment ProfileBookFields on Book {
    ...BookFundingFields
    publicPath
    kind printedAuthor publisher publicationYear isbn
    status id title
    author { id fullName username profilePicture }
    imageUrl
    ...WorkClassificationFields
    description
    stats { views shares likes }
    pageCount
  }
`;

// Keep the initial profile and the optional saved library in separate requests.
// Both book lists together exceed the server's nested-list operation budget.
export const GET_USER_BY_ID = gql`
  ${PROFILE_BOOK_FIELDS}
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
          notificationSettings { newFollower mentionInSession mentionInComment bookComment bookLike quoteLike sessionReply }
          authorSettings { copyrightNote weeklyWordGoal preferredGenres }
          id,
          username,
          fullName,
          email,
          role,
          usersBooks {
            ...ProfileBookFields
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

export const GET_PROFILE_SAVED_BOOKS = gql`
  ${PROFILE_BOOK_FIELDS}
  query GetProfileSavedBooks($id: ID!) {
    getUserById(id: $id) {
      id
      savedBooks { ...ProfileBookFields }
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

