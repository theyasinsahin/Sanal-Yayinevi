import { gql } from '@apollo/client';

const ACCESS_FIELDS = gql`
  fragment SessionAccessFields on SessionCreationAccess {
    status reason requestedAt reviewedAt reviewNote revision
    user { id username fullName email }
  }
`;

export const MY_SESSION_ACCESS = gql`
  ${ACCESS_FIELDS}
  query MySessionAccess {
    mySessionCreationAccess { ...SessionAccessFields }
  }
`;

export const REQUEST_SESSION_ACCESS = gql`
  ${ACCESS_FIELDS}
  mutation RequestSessionAccess($reason: String!) {
    requestSessionCreationAccess(reason: $reason) { ...SessionAccessFields }
  }
`;

export const SESSION_ACCESS_REQUESTS = gql`
  ${ACCESS_FIELDS}
  query SessionAccessRequests($status: SessionAccessStatus!, $page: Int!) {
    sessionAccessRequests(status: $status, page: $page) {
      items { ...SessionAccessFields }
      total page totalPages
    }
  }
`;

export const REVIEW_SESSION_ACCESS = gql`
  ${ACCESS_FIELDS}
  mutation ReviewSessionAccess($userId: ID!, $revision: Int!, $approve: Boolean!, $note: String) {
    reviewSessionCreationAccess(userId: $userId, revision: $revision, approve: $approve, note: $note) { ...SessionAccessFields }
  }
`;
