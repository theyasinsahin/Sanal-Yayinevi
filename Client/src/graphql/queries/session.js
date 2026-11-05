// src/graphql/queries/session.js
import { gql } from '@apollo/client';

// --- FRAGMENTS ---
const SESSION_FIELDS = gql`
  fragment SessionFields on Session {
    publicPath
    id
    title
    description
    coverImageUrl
    type
    isActive
    tags
    participantCount
    createdAt
    updatedAt
    createdBy {
      id
      username
      fullName
      profilePicture
    }
  }
`;

const ENTRY_FIELDS = gql`
  fragment EntryFields on SessionEntry {
    id
    sessionId
    content
    likedBy
    likeCount
    createdAt
    user {
      id
      username
      fullName
      profilePicture
    }
  }
`;

// --- QUERIES ---
export const GET_SESSIONS = gql`
  ${SESSION_FIELDS}
  query GetSessions($limit: Int, $offset: Int) {
    getSessions(limit: $limit, offset: $offset) {
      publicPath
      ...SessionFields
    }
  }
`;

export const GET_SESSION = gql`
  ${SESSION_FIELDS}
  query GetSession($sessionId: ID!) {
    getSession(sessionId: $sessionId) {
      publicPath
      ...SessionFields
    }
  }
`;

export const GET_SESSION_ENTRIES = gql`
  ${ENTRY_FIELDS}
  query GetSessionEntries($sessionId: ID!, $limit: Int, $offset: Int, $accessCode: String) {
    getSessionEntries(sessionId: $sessionId, limit: $limit, offset: $offset, accessCode: $accessCode) {
      ...EntryFields
    }
  }
`;

export const GET_SESSION_ENTRY = gql`
  ${ENTRY_FIELDS}
  query GetSessionEntry($sessionId: ID!, $entryId: ID!, $accessCode: String) {
    getSessionEntry(sessionId: $sessionId, entryId: $entryId, accessCode: $accessCode) { ...EntryFields }
  }
`;

// --- MUTATIONS ---
export const CREATE_SESSION = gql`
  ${SESSION_FIELDS}
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      publicPath
      ...SessionFields
    }
  }
`;

export const UPDATE_SESSION_COVER = gql`
  ${SESSION_FIELDS}
  mutation UpdateSessionCover($sessionId: ID!, $coverImageUrl: String) {
    updateSessionCover(sessionId: $sessionId, coverImageUrl: $coverImageUrl) { ...SessionFields }
  }
`;

export const ADD_SESSION_ENTRY = gql`
  ${ENTRY_FIELDS}
  mutation AddSessionEntry($sessionId: ID!, $content: String!, $accessCode: String) {
    addSessionEntry(sessionId: $sessionId, content: $content, accessCode: $accessCode) {
      ...EntryFields
    }
  }
`;

export const DELETE_SESSION_ENTRY = gql`
  mutation DeleteSessionEntry($entryId: ID!) {
    deleteSessionEntry(entryId: $entryId)
  }
`;

export const TOGGLE_SESSION_ENTRY_LIKE = gql`
  ${ENTRY_FIELDS}
  mutation ToggleSessionEntryLike($entryId: ID!, $accessCode: String) {
    toggleSessionEntryLike(entryId: $entryId, accessCode: $accessCode) {
      ...EntryFields
    }
  }
`;

export const CLOSE_SESSION = gql`
  mutation CloseSession($sessionId: ID!) {
    closeSession(sessionId: $sessionId)
  }
`;

// --- SUBSCRIPTIONS ---
export const ON_NEW_SESSION_ENTRY = gql`
  ${ENTRY_FIELDS}
  subscription OnNewSessionEntry($sessionId: ID!, $accessCode: String) {
    onNewSessionEntry(sessionId: $sessionId, accessCode: $accessCode) {
      ...EntryFields
    }
  }
`;

export const VERIFY_SESSION_ACCESS_CODE = gql`
  query VerifySessionAccessCode($sessionId: ID!, $accessCode: String!) {
    verifySessionAccessCode(sessionId: $sessionId, accessCode: $accessCode)
  }
`;
