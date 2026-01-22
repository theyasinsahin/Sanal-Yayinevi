import { gql } from '@apollo/client';

export const GET_BOOKS = gql`
  query GetAllBooks{
    getAllBooks{
        id,
        title,
        description,
        authorId,
        author {
        id
        username
        fullName
        profilePicture
      },
        comments {
          id
          content
          date
          likedBy
          userId {
            id
            username
            fullName
            profilePicture
          }
          replies {
            id
            content
            date
            likedBy
            userId {
              id
              username
              profilePicture
            }
          }
        },
        likedBy,
        genre,
        tags,
        imageUrl,
        pageCount,
        publishDate,
        stats {
            views,
            shares,
            likes,
        },
        commentCount,
        createdAt,
        updatedAt
    }
  }
`;

export const GET_BOOK_BY_ID = gql`
  query GetBookById($id: ID!) {
    getBookById(id: $id) {
      id
      title
      description
      imageUrl
      genre
      pageCount
      publishDate
      authorId
      author {
        id
        username
        fullName
        profilePicture
      },
      stats {
        views
        likes
      }
      commentCount
      likedBy
      comments {
        id
        content
        date
        likedBy
        userId {
          id
          username
          fullName
          profilePicture
        }
        # YENİ: Yanıtları da çekiyoruz
        replies {
          id
          content
          date
          likedBy
          userId {
            id
            username
            profilePicture
          }
        }
      }
      chapters{
        id
        title
        content
        createdAt
      }
      tags
      backerCount
      fundingTarget
      currentFunding
    }
  }
`;

// Yorumları ve gereksiz detayları içermeyen HAFİF sorgu
export const GET_BOOK_READER_DATA = gql`
  query GetBookReaderData($id: ID!) {
    getBookById(id: $id) {
      id
      title
      authorId
      chapters {
        id
        title
        content
      }
    }
  }
`;