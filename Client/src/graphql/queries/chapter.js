import { gql } from '@apollo/client';

export const GET_CHAPTER_BY_ID = gql`
    query GetChapterById($id:ID!){
        getChapterById(id:$id){
            id,
            title,
            content,
            createdAt,
        }
    }
`;