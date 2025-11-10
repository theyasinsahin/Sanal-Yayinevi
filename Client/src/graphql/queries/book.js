import { gql } from '@apollo/client';

export const GET_BOOKS = gql`
  query GetAllBooks{
    getAllBooks{
        id,
        title,
        description,
        authorId,
        comments,
        chapters,
        genre,
        tags,
        imageUrl,
        pageCount,
        publishDate,
        stats {
            views,
            shares,
            likes,
            comments,
        },
    }
}
`;

export const GET_BOOK_BY_ID = gql`
    query GetBookById($id:ID!){
        getBookById(id:$id){
            id,
            title,
            description,
            authorId,
            comments,
            chapters,
            genre,
            tags,
            imageUrl,
            pageCount,
            publishDate,
            stats {
                views,
                shares,
                likes,
                comments,
            },
        }
    }
`;