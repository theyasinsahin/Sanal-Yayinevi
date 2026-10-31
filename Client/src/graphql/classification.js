import { gql } from '@apollo/client';

export const WORK_CLASSIFICATION_FIELDS = gql`
  fragment WorkClassificationFields on Book {
    format { id slug name isActive }
    genres { id slug name group hexColor isActive }
    classificationTags { id slug name isActive }
    narrativeFeatures { id slug name isActive }
    targetAudience { id slug name isActive }
    contentWarnings { id slug name isActive }
    classificationStatus
  }
`;
export const GET_CLASSIFICATION_OPTIONS = gql`
  query GetClassificationOptions {
    getClassificationOptions {
      formats { id slug name isActive }
      genres { id slug name group hexColor isActive }
      narrativeFeatures { id slug name isActive }
      targetAudiences { id slug name isActive }
      contentWarnings { id slug name isActive }
    }
  }
`;
export const SEARCH_CLASSIFICATION_TAGS = gql`
  query SearchClassificationTags($search: String) {
    searchClassificationTags(search: $search) { id slug name isActive }
  }
`;
export const UPDATE_BOOK_CLASSIFICATION = gql`
  ${WORK_CLASSIFICATION_FIELDS}
  mutation UpdateBookClassification($bookId: ID!, $classification: ClassificationInput!) {
    updateBookClassification(bookId: $bookId, classification: $classification) { id ...WorkClassificationFields }
  }
`;
