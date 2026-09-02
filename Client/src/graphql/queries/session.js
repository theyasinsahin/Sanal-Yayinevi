// src/graphql/queries/session.js
import { gql } from '@apollo/client';

// --- FRAGMENTS ---
const SESSION_FIELDS = gql`
  fragment SessionFields on Session {
    id
    title
    description
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
      ...SessionFields
    }
  }
`;

export const GET_SESSION = gql`
  ${SESSION_FIELDS}
  query GetSession($sessionId: ID!) {
    getSession(sessionId: $sessionId) {
      ...SessionFields
    }
  }
`;

export const GET_SESSION_ENTRIES = gql`
  ${ENTRY_FIELDS}
  query GetSessionEntries($sessionId: ID!, $limit: Int, $offset: Int) {
    getSessionEntries(sessionId: $sessionId, limit: $limit, offset: $offset) {
      ...EntryFields
    }
  }
`;

// --- MUTATIONS ---
export const CREATE_SESSION = gql`
  ${SESSION_FIELDS}
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      ...SessionFields
    }
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
  mutation ToggleSessionEntryLike($entryId: ID!) {
    toggleSessionEntryLike(entryId: $entryId) {
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
  subscription OnNewSessionEntry($sessionId: ID!) {
    onNewSessionEntry(sessionId: $sessionId) {
      ...EntryFields
    }
  }
`;

export const VERIFY_SESSION_ACCESS_CODE = gql`
  query VerifySessionAccessCode($sessionId: ID!, $accessCode: String!) {
    verifySessionAccessCode(sessionId: $sessionId, accessCode: $accessCode)
  }
`;