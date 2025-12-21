import { gql } from '@apollo/client';

export const CREATE_COMMENT_MUTATION = gql`
  mutation CreateComment($bookId:ID!, $content:String!){
    createComment(bookId:$bookId, content:$content){
        id,
        content,
        bookId,
        userId {
          id
          username
        },
        date
        }
    }
`;

export const DELETE_COMMENT_MUTATION = gql`
  mutation DeleteComment($id:ID!){
    deleteComment(id:$id){
        code,
        message
    }
}
`;

export const TOGGLE_COMMENT_LIKE_MUTATION = gql`
  mutation ToggleCommentLike($commentId: ID!) {
    toggleCommentLike(commentId: $commentId) {
      id
      likedBy
    }
  }
`;

export const REPLY_TO_COMMENT_MUTATION = gql`
  mutation ReplyToComment($bookId: ID!, $content: String!, $parentCommentId: ID!) {
    replyToComment(bookId: $bookId, content: $content, parentCommentId: $parentCommentId) {
      id
      content
      date
      userId{
        id
        username
        profilePicture
      }
    }
  }
`;