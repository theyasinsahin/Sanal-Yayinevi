import { gql } from '@apollo/client';
import { PRINTED_BOOK_FIELDS } from '../printedBooks';

export const BOOK_CARD_FIELDS = gql`
  fragment BookCardFields on Book {
    id publicPath title description imageUrl pageCount publishDate status
    kind printedAuthor publisher publicationYear isbn
    author { id username fullName profilePicture }
    genre { id name slug iconUrl hexColor isActive }
    stats { views likes }
    commentCount currentFunding fundingTarget backerCount
  }
`;

export const GET_BOOK_FEED = gql`
  ${BOOK_CARD_FIELDS}
  query GetBookFeed($limit: Int, $after: String, $sort: BookSort, $genre: String, $search: String) {
    getBookFeed(limit: $limit, after: $after, sort: $sort, genre: $genre, search: $search) {
      books { ...BookCardFields }
      endCursor hasNextPage
    }
  }
`;

export const GET_BOOK_CARD = gql`
  ${BOOK_CARD_FIELDS}
  query GetBookCard($id: ID!) { getBookById(id: $id) { ...BookCardFields } }
`;

export const GET_BOOK_DETAIL = gql`
  ${BOOK_CARD_FIELDS}
  ${PRINTED_BOOK_FIELDS}
  query GetBookDetail($id: ID!) {
    getBookById(id: $id) {
      ...BookCardFields ...PrintedBookFields
      authorId likedBy tags
      chapters { id title createdAt pageCount }
    }
  }
`;

export const GET_BOOKS = gql`
  query GetAllBooks{
    getAllBooks{
      publicPath
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
  ${PRINTED_BOOK_FIELDS}
  query GetBookById($id: ID!) {
    getBookById(id: $id) {
      publicPath
      ...PrintedBookFields
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
        pageCount
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
      publicPath
      id
      kind
      status
      publicationStatus
      title
      authorId
      author { id username fullName }
      chapters {
        id
        title
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

export const GET_READING_CHAPTER = gql`
  query GetReadingChapter($bookId: ID!, $chapterId: ID!) {
    getReadingChapter(bookId: $bookId, chapterId: $chapterId) { id title content }
  }
`;

export const GET_BOOK_READER_FULL = gql`
  query GetBookReaderFull($id: ID!) {
    getBookById(id: $id) { id chapters { id title content } }
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

