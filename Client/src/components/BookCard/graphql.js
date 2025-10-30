import { gql } from '@apollo/client';

export const GET_BOOK_BY_ID_QUERY = gql`
    query GetBookById($id:ID!){
        getBookById(id:$id){
            id,
            title,
            description,
            authorId,
            comments,
            chapters
        }
    }
`;

export const GET_USER_BY_ID_QUERY = gql`
    query GetUserById($id:ID!){
        getUserById(id: $id){
            username,
            fullName,
            email
        }
    }
`;

