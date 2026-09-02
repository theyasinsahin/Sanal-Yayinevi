import { gql } from '@apollo/client';

// --- FRAGMENTS ---
const MESSAGE_FIELDS = gql`
  fragment MessageFields on Message {
    id
    conversationId
    content
    type
    createdAt
    sender {
      id
      username
      fullName
      profilePicture
    }
    attachedQuote {
      id
      text
      chapterTitle
      book {
        id
        title
        imageUrl
      }
      user {
        id
        username
        fullName
      }
    }
    attachedBook {
      id
      title
      imageUrl
      author {
        id
        username
        fullName
      }
    }
  }
`;

const CONVERSATION_FIELDS = gql`
  fragment ConversationFields on Conversation {
    id
    isGroup
    unreadCount
    updatedAt
    participants {
      id
      username
      fullName
      profilePicture
    }
    lastMessage {
      id
      content
      type
      createdAt
      sender {
        id
        username
      }
    }
  }
`;

// --- QUERIES ---
export const GET_CONVERSATIONS = gql`
  ${CONVERSATION_FIELDS}
  query GetConversations {
    getConversations {
      ...ConversationFields
    }
  }
`;

export const GET_CONVERSATION = gql`
  ${CONVERSATION_FIELDS}
  query GetConversation($conversationId: ID!) {
    getConversation(conversationId: $conversationId) {
      ...ConversationFields
    }
  }
`;

export const GET_MESSAGES = gql`
  ${MESSAGE_FIELDS}
  query GetMessages($conversationId: ID!, $limit: Int, $offset: Int) {
    getMessages(conversationId: $conversationId, limit: $limit, offset: $offset) {
      ...MessageFields
    }
  }
`;

export const GET_OR_CREATE_CONVERSATION = gql`
  ${CONVERSATION_FIELDS}
  query GetOrCreateConversation($recipientId: ID!) {
    getOrCreateConversation(recipientId: $recipientId) {
      ...ConversationFields
    }
  }
`;

export const GET_UNREAD_MESSAGE_COUNT = gql`
  query GetUnreadMessageCount {
    getUnreadMessageCount
  }
`;

// --- MUTATIONS ---
export const SEND_MESSAGE = gql`
  ${MESSAGE_FIELDS}
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      ...MessageFields
    }
  }
`;

export const MARK_MESSAGES_AS_READ = gql`
  mutation MarkMessagesAsRead($conversationId: ID!) {
    markMessagesAsRead(conversationId: $conversationId)
  }
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($messageId: ID!) {
    deleteMessage(messageId: $messageId)
  }
`;

export const EDIT_MESSAGE = gql`
  ${MESSAGE_FIELDS}
  mutation EditMessage($messageId: ID!, $content: String!) {
    editMessage(messageId: $messageId, content: $content) {
      ...MessageFields
    }
  }
`;

// --- SUBSCRIPTIONS ---
export const ON_NEW_MESSAGE = gql`
  ${MESSAGE_FIELDS}
  subscription OnNewMessage($conversationId: ID!) {
    onNewMessage(conversationId: $conversationId) {
      ...MessageFields
    }
  }
`;