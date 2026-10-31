import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { GET_MESSAGES, GET_CONVERSATIONS, SEND_MESSAGE, DELETE_MESSAGE, GET_UNREAD_MESSAGE_COUNT, GET_OR_CREATE_CONVERSATION } from '../graphql/queries/message';
import { useGetMessages, useSendMessage, useDeleteMessage, useNewMessageSubscription, useUnreadMessageCount, useGetOrCreateConversation, useGetConversations } from './useMessages';
jest.mock('@mui/icons-material', () => require('../../test-support/icons.cjs'));

let mockUser;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
beforeEach(() => { mockUser = { id: 'reader' }; });
const message = (id, content = id) => ({ __typename: 'Message', id, conversationId: 'conversation', content, type: 'TEXT', createdAt: '2026-01-01T12:00:00Z', sender: null, attachedQuote: null, attachedBook: null });
const variables = { conversationId: 'conversation', limit: 20, offset: 0 };
const wrapper = (mocks, cache = new InMemoryCache()) => ({ children }) => <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>;
const conversation = { __typename: 'Conversation', id: 'conversation', isGroup: false, unreadCount: 0, updatedAt: '2026-01-01', participants: [], lastMessage: null };

test('a conversation must be selected before messages are requested', () => {
  const { result } = renderHook(() => useGetMessages(null), { wrapper: wrapper([]) });
  expect(result.current.messages).toEqual([]);
  expect(result.current.loading).toBe(false);
  expect(result.current.hasMore).toBe(false);
});
test('newest-first server pages appear oldest-first and older pages append without reversing the cache', async () => {
  const latest = Array.from({ length: 20 }, (_, i) => message(String(20 - i)));
  const mocks = [
    { request: { query: GET_MESSAGES, variables }, result: { data: { getMessages: latest } } },
    { request: { query: GET_MESSAGES, variables: { ...variables, offset: 20 } }, result: { data: { getMessages: [message('0')] } } },
  ];
  const cache = new InMemoryCache();
  const { result } = renderHook(() => useGetMessages('conversation'), { wrapper: wrapper(mocks, cache) });
  await waitFor(() => expect(result.current.messages).toHaveLength(20));
  expect(result.current.messages[0].id).toBe('1');
  expect(result.current.hasMore).toBe(true);
  act(() => result.current.loadOlderMessages());
  await waitFor(() => expect(result.current.messages).toHaveLength(21));
  expect(result.current.messages[0].id).toBe('0');
  expect(result.current.hasMore).toBe(false);
  expect(cache.readQuery({ query: GET_MESSAGES, variables }).getMessages[0].id).toBe('20');
});
test('empty older pages preserve existing messages', async () => {
  const firstPage = Array.from({ length: 20 }, (_, i) => message(String(i)));
  const mocks = [
    { request: { query: GET_MESSAGES, variables }, result: { data: { getMessages: firstPage } } },
    { request: { query: GET_MESSAGES, variables: { ...variables, offset: 20 } }, result: { data: { getMessages: [] } } },
  ];
  const { result } = renderHook(() => useGetMessages('conversation'), { wrapper: wrapper(mocks) });
  await waitFor(() => expect(result.current.messages).toHaveLength(20));
  act(() => result.current.loadOlderMessages());
  await waitFor(() => expect(result.current.hasMore).toBe(false));
  expect(result.current.messages.map(m => m.id)).toEqual(firstPage.map(m => m.id).reverse());
});
test('send inserts an optimistic message then replaces it with the confirmed message exactly once', async () => {
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_MESSAGES, variables, data: { getMessages: [message('old')] } });
  const sent = message('new', 'Hello');
  const mocks = [{ request: { query: SEND_MESSAGE, variables: { input: { conversationId: 'conversation', content: 'Hello', type: 'TEXT' } } }, result: { data: { sendMessage: sent } }, delay: 20 }];
  const { result } = renderHook(useSendMessage, { wrapper: wrapper(mocks, cache) });
  let pending;
  act(() => { pending = result.current.sendMessage({ conversationId: 'conversation', content: 'Hello' }); });
  expect(cache.readQuery({ query: GET_MESSAGES, variables, optimistic: true }).getMessages).toHaveLength(2);
  await act(async () => expect(await pending).toMatchObject({ id: 'new' }));
  expect(cache.readQuery({ query: GET_MESSAGES, variables }).getMessages.map(m => m.id)).toEqual(['new', 'old']);
});
test('a rejected send rolls back optimistic content and preserves confirmed history', async () => {
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_MESSAGES, variables, data: { getMessages: [message('old')] } });
  const mocks = [{ request: { query: SEND_MESSAGE, variables: { input: { conversationId: 'conversation', content: 'Hello', type: 'TEXT' } } }, error: new Error('Permission denied') }];
  const { result } = renderHook(useSendMessage, { wrapper: wrapper(mocks, cache) });
  await act(async () => { await expect(result.current.sendMessage({ conversationId: 'conversation', content: 'Hello' })).rejects.toThrow('Permission denied'); });
  expect(cache.readQuery({ query: GET_MESSAGES, variables, optimistic: true }).getMessages.map(m => m.id)).toEqual(['old']);
});
test('deletion removes only the requested message from the active conversation', async () => {
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_MESSAGES, variables, data: { getMessages: [message('remove'), message('keep')] } });
  const { result } = renderHook(() => useDeleteMessage('conversation'), { wrapper: wrapper([{ request: { query: DELETE_MESSAGE, variables: { messageId: 'remove' } }, result: { data: { deleteMessage: true } } }], cache) });
  await act(async () => { await result.current.deleteMessage('remove'); });
  expect(cache.readQuery({ query: GET_MESSAGES, variables }).getMessages.map(m => m.id)).toEqual(['keep']);
});
test('subscription deduplicates repeat delivery and updates the correct conversation preview', async () => {
  let observer;
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_MESSAGES, variables, data: { getMessages: [] } });
  cache.writeQuery({ query: GET_CONVERSATIONS, data: { getConversations: [conversation, { ...conversation, id: 'other' }] } });
  const client = new ApolloClient({ cache, link: new ApolloLink(() => new Observable(sink => { observer = sink; })) });
  const provider = ({ children }) => <ApolloProvider client={client}>{children}</ApolloProvider>;
  const { unmount } = renderHook(() => useNewMessageSubscription('conversation'), { wrapper: provider });
  await waitFor(() => expect(observer).toBeDefined());
  const data = { data: { onNewMessage: message('new') } };
  act(() => { observer.next(data); observer.next(data); });
  expect(cache.readQuery({ query: GET_MESSAGES, variables }).getMessages.map(m => m.id)).toEqual(['new']);
  const conversations = cache.readQuery({ query: GET_CONVERSATIONS }).getConversations;
  expect(conversations[0].lastMessage.id).toBe('new');
  expect(conversations[1].lastMessage).toBeNull();
  unmount();
  client.stop();
});
test('unread counts skip guests and load for a signed-in reader', async () => {
  mockUser = null;
  const { result, rerender } = renderHook(useUnreadMessageCount, { wrapper: wrapper([{ request: { query: GET_UNREAD_MESSAGE_COUNT }, result: { data: { getUnreadMessageCount: 3 } } }]) });
  expect(result.current).toBe(0);
  mockUser = { id: 'reader' }; rerender();
  await waitFor(() => expect(result.current).toBe(3));
});
test('conversation lists load and a selected recipient starts the corresponding conversation', async () => {
  const mocks = [
    { request: { query: GET_CONVERSATIONS }, result: { data: { getConversations: [conversation] } } },
    { request: { query: GET_OR_CREATE_CONVERSATION, variables: { recipientId: 'recipient' } }, result: { data: { getOrCreateConversation: conversation } } },
  ];
  const { result } = renderHook(() => ({ list: useGetConversations(), start: useGetOrCreateConversation() }), { wrapper: wrapper(mocks) });
  await waitFor(() => expect(result.current.list.conversations).toHaveLength(1));
  await act(async () => expect(await result.current.start.getOrCreateConversation('recipient')).toMatchObject({ id: 'conversation' }));
});
