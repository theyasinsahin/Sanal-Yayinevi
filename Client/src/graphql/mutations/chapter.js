import { gql } from '@apollo/client';

export const CREATE_CHAPTER_MUTATION = gql`
  mutation CreateChapter($bookId: ID!, $title: String!, $content: String!, $pageCount: Int, $isHidden: Boolean) {
    createChapter(bookId: $bookId, title: $title, content: $content, pageCount: $pageCount, isHidden: $isHidden) {
        id,
        title,
        content,
        createdAt,
        pageCount
    }
  }
`;

export const UPDATE_CHAPTER_MUTATION = gql`
  mutation UpdateChapter($chapterId: ID!, $title: String, $content: String, $pageCount: Int) {
    updateChapter(chapterId: $chapterId, title: $title, content: $content, pageCount: $pageCount) {
        id,
        title,
        content,
        createdAt,
        pageCount
    }
  }
`;

export const DELETE_CHAPTER_MUTATION = gql`
  mutation DeleteChapter($id: ID!) {
    deleteChapter(id: $id) {
      code
      message
    }
  }
`;

export const SET_CHAPTER_VISIBILITY = gql`
  mutation SetChapterVisibility($chapterId: ID!, $isHidden: Boolean!) {
    updateChapter(chapterId: $chapterId, isHidden: $isHidden) {
      id isHidden canReadContent wordCount pageCount
    }
  }
`;
