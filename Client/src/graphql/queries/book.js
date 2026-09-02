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
        genre{
          name
          slug
          iconUrl
          hexColor
          isActive
        },
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
        status
        backerCount
        fundingTarget
        currentFunding
        tags
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
      genre{
          name
          slug
          iconUrl
          hexColor
          isActive
        }      
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
      status
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
        genre{
          name
          slug
          iconUrl
          hexColor
          isActive
        }
    }
  }
`;

export const GET_BOOK_BACKERS = gql`
  query GetBookBackers($bookId: ID!) {
    getBookBackers(bookId: $bookId) {
      id
      username
      fullName
      profilePicture
    }
  }
`;
 