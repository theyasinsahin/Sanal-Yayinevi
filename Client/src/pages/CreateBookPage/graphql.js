import { gql } from '@apollo/client';

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