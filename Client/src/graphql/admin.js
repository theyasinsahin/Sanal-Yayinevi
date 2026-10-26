import { gql } from '@apollo/client';

export const GET_ADMIN_RESOURCES = gql`
  query GetAdminResources {
    getAdminResources { name label description canCreate indexes fields { name label type required editable enumValues reference sensitive maxLength } }
  }
`;
export const GET_ADMIN_RECORDS = gql`
  query GetAdminRecords($resource: String!, $page: Int, $limit: Int, $search: String, $state: String, $relatedField: String, $relatedId: ID) {
    getAdminRecords(resource: $resource, page: $page, limit: $limit, search: $search, state: $state, relatedField: $relatedField, relatedId: $relatedId) {
      total page totalPages items { id title revision values }
    }
  }
`;
export const GET_ADMIN_RECORD = gql`
  query GetAdminRecord($resource: String!, $id: ID!) {
    getAdminRecord(resource: $resource, id: $id) { id title revision values references { field resource id title exists } }
  }
`;
export const SAVE_ADMIN_RECORD = gql`
  mutation SaveAdminRecord($resource: String!, $id: ID, $revision: String, $changes: JSON!, $reason: String!) {
    saveAdminRecord(resource: $resource, id: $id, revision: $revision, changes: $changes, reason: $reason) { id title revision values }
  }
`;
export const GET_ADMIN_OVERVIEW = gql`
  query GetAdminOverview {
    getAdminOverview {
      counts { resource label total active } pendingBooks pendingClaims pendingSessionAccess revenue { currency amount count }
      recent { id title revision values }
    }
  }
`;
