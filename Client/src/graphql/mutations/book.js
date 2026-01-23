import { gql } from '@apollo/client';

export const LIKE_BOOK_MUTATION = gql`
  mutation LikeBook($bookId: ID!) {
    likeBook(bookId: $bookId) {
      id
      stats {
        likes
      }
      likedBy
    }
  }
`;

export const INCREMENT_BOOK_VIEW_MUTATION = gql`
  mutation IncrementBookViews($id: ID!) {
    incrementBookViews(id: $id) {
      id
      stats {
        views
      }
    }
  }
`;

export const DELETE_BOOK_MUTATION = gql`
  mutation DeleteBook($id: ID!) {
    deleteBook(id: $id) {
      code
      message
    }
  }
`;

export const CREATE_BOOK_MUTATION = gql`
    mutation CreateBook($title:String!, $genre:String!, $description:String!, $tags:[String], $imageUrl:String!){
        createBook(title:$title, genre:$genre, description:$description, tags:$tags, imageUrl:$imageUrl){
            id,
            title,
            description,
            authorId,
            comments{
                id
            },
            chapters{
                id
                },
        }
    }
`;

export const UPDATE_BOOK_STATUS_MUTATION = gql`
  mutation UpdateBookStatus(
    $bookId: ID!
    $status: String!
    $fundingTarget: Float
    $printConfig: PrintConfigInput # Backend'de tanımladığımız Input Type ismi
  ) {
    updateBookStatus(
      bookId: $bookId
      status: $status
      fundingTarget: $fundingTarget
      printConfig: $printConfig
    ) {
      id
      title
      status
      fundingTarget
      currentFunding
      backerCount
      printConfig {
        paperType
        coverType
        dimension
        estimatedPageCount
      }
    }
  }
`;