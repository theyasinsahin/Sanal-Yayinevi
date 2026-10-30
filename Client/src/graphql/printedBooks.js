import { gql } from '@apollo/client';

export const PRINTED_BOOK_FIELDS = gql`
  fragment PrintedBookFields on Book {
    publicPath
    kind isbn printedAuthor publisher publicationYear publicationStatus purchaseUrl
    publicationEvidenceUrl reviewNote canEditContent
    myClaim { id status reviewNote }
  }
`;
export const GET_PRINTED_BOOKS = gql`
  query GetPrintedBooks($page: Int, $search: String) {
    getPrintedBooks(page: $page, search: $search) {
      total page totalPages
      books { publicPath id title printedAuthor publisher publicationYear isbn imageUrl pageCount description }
    }
  }
`;
export const LOOKUP_PRINTED_BOOK = gql`
  query LookupPrintedBook($isbn: String!) {
    lookupPrintedBook(isbn: $isbn) { isbn found title printedAuthor publisher publicationYear pageCount imageUrl }
  }
`;
export const GET_MY_PRINTED_SUBMISSIONS = gql`
  query GetMyPrintedSubmissions {
    getMyPrintedSubmissions { publicPath id title publicationStatus reviewNote }
  }
`;
export const SUBMIT_PRINTED_BOOK = gql`
  mutation SubmitPrintedBook($input: PrintedBookInput!) {
    submitPrintedBook(input: $input) { publicPath id title publicationStatus }
  }
`;
export const REQUEST_BOOK_CLAIM = gql`
  mutation RequestBookClaim($bookId: ID!, $evidence: String!, $evidenceUrl: String) {
    requestBookClaim(bookId: $bookId, evidence: $evidence, evidenceUrl: $evidenceUrl) { id status reviewNote }
  }
`;
export const GET_PRINTED_REVIEWS = gql`
  query GetPrintedReviews {
    getPrintedBookReviews {
      publicPath
      id title isbn printedAuthor publisher publicationYear pageCount description imageUrl
      purchaseUrl publicationEvidenceUrl submittedBy { id username fullName }
    }
    getBookClaimReviews {
      id evidence evidenceUrl status createdAt
      claimant { id username fullName }
      book { publicPath id title isbn printedAuthor }
    }
  }
`;
export const REVIEW_PRINTED_BOOK = gql`
  mutation ReviewPrintedBook($bookId: ID!, $approve: Boolean!, $note: String) {
    reviewPrintedBook(bookId: $bookId, approve: $approve, note: $note) { publicPath id publicationStatus reviewNote }
  }
`;
export const REVIEW_BOOK_CLAIM = gql`
  mutation ReviewBookClaim($claimId: ID!, $approve: Boolean!, $note: String) {
    reviewBookClaim(claimId: $claimId, approve: $approve, note: $note) { id status reviewNote }
  }
`;
export const CREATE_PRINTED_QUOTE = gql`
  mutation CreatePrintedQuote($bookId: ID!, $text: String!, $pageNumber: Int!, $note: String, $isSpoiler: Boolean, $visibility: QuoteVisibility = PUBLIC) {
    createQuote(bookId: $bookId, text: $text, pageNumber: $pageNumber, note: $note, isSpoiler: $isSpoiler, visibility: $visibility) { id text pageNumber visibility }
  }
`;
