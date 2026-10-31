import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { GET_SESSIONS, GET_SESSION, GET_SESSION_ENTRIES, ADD_SESSION_ENTRY, DELETE_SESSION_ENTRY, CREATE_SESSION, TOGGLE_SESSION_ENTRY_LIKE, CLOSE_SESSION } from '../graphql/queries/session';
import { useGetSessions, useGetSession, useGetSessionEntries, useNewSessionEntrySubscription, useAddSessionEntry, useDeleteSessionEntry, useCreateSession, useToggleSessionEntryLike, useCloseSession } from './useSessions';
jest.mock('@mui/icons-material', () => require('../../test-support/icons.cjs'));

const session = id => ({ __typename: 'Session', id, publicPath: `/oturum/${id}`, title: id, description: '', coverImageUrl: '', type: 'OPEN', isActive: true, tags: [], participantCount: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01', createdBy: null });
const entry = id => ({ __typename: 'SessionEntry', id, sessionId: 'room', content: id, likedBy: [], likeCount: 0, createdAt: '2026-01-01', user: null });
const variables = { sessionId: 'room', limit: 30, offset: 0 };
const wrapper = (mocks, cache = new InMemoryCache()) => ({ children }) => <MockedProvider mocks={mocks} cache={cache}>{children}</MockedProvider>;
const roomMock = () => ({ request: { query: GET_SESSION, variables: { sessionId: 'room' } }, result: { data: { getSession: session('room') } } });

test('session and entry queries wait for a selected session', () => {
  const { result } = renderHook(() => ({ room: useGetSession(null), entries: useGetSessionEntries(null) }), { wrapper: wrapper([]) });
  expect(result.current.room).toMatchObject({ session: null, loading: false });
  expect(result.current.entries).toMatchObject({ entries: [], hasMore: false, loading: false });
});
test('session list pagination uses current count and an empty page retains existing sessions', async () => {
  const mocks = [
    { request: { query: GET_SESSIONS, variables: { limit: 2, offset: 0 } }, result: { data: { getSessions: [session('a'), session('b')] } } },
    { request: { query: GET_SESSIONS, variables: { limit: 2, offset: 2 } }, result: { data: { getSessions: [] } } },
  ];
  const { result } = renderHook(() => useGetSessions(2), { wrapper: wrapper(mocks) });
  await waitFor(() => expect(result.current.sessions).toHaveLength(2));
  expect(result.current.hasMore).toBe(true);
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.hasMore).toBe(false));
  expect(result.current.sessions.map(s => s.id)).toEqual(['a', 'b']);
});
test('entry pagination appends in chronological order', async () => {
  const mocks = [
    { request: { query: GET_SESSION_ENTRIES, variables }, result: { data: { getSessionEntries: [entry('a')] } } },
    { request: { query: GET_SESSION_ENTRIES, variables: { ...variables, offset: 1 } }, result: { data: { getSessionEntries: [entry('b')] } } },
  ];
  const { result } = renderHook(() => useGetSessionEntries('room'), { wrapper: wrapper(mocks) });
  await waitFor(() => expect(result.current.entries).toHaveLength(1));
  act(() => result.current.loadMore());
  await waitFor(() => expect(result.current.entries.map(e => e.id)).toEqual(['a', 'b']));
});
test.each([null, 'access-code'])('adding an entry forwards the access code %s and replaces optimistic content', async code => {
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_SESSION_ENTRIES, variables, data: { getSessionEntries: [entry('old')] } });
  const input = { sessionId: 'room', content: 'Hello', ...(code ? { accessCode: code } : {}) };
  const mocks = [{ request: { query: ADD_SESSION_ENTRY, variables: input }, result: { data: { addSessionEntry: entry('new') } } }, roomMock()];
  const { result } = renderHook(() => useAddSessionEntry('room'), { wrapper: wrapper(mocks, cache) });
  await act(async () => { expect(await result.current.addEntry('Hello', code)).toMatchObject({ id: 'new' }); });
  expect(cache.readQuery({ query: GET_SESSION_ENTRIES, variables }).getSessionEntries.map(e => e.id)).toEqual(['old', 'new']);
});
test('entry deletion updates cached entries without removing unrelated entries', async () => {
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_SESSION_ENTRIES, variables, data: { getSessionEntries: [entry('remove'), entry('keep')] } });
  const mocks = [{ request: { query: DELETE_SESSION_ENTRY, variables: { entryId: 'remove' } }, result: { data: { deleteSessionEntry: true } } }, roomMock()];
  const { result } = renderHook(() => useDeleteSessionEntry('room'), { wrapper: wrapper(mocks, cache) });
  await act(async () => { await result.current.deleteEntry('remove'); });
  expect(cache.readQuery({ query: GET_SESSION_ENTRIES, variables }).getSessionEntries.map(e => e.id)).toEqual(['keep']);
});
test('subscription deliveries append once even when a mutation already added the entry', async () => {
  let observer;
  const cache = new InMemoryCache();
  cache.writeQuery({ query: GET_SESSION_ENTRIES, variables, data: { getSessionEntries: [entry('old')] } });
  cache.writeQuery({ query: GET_SESSIONS, variables: { limit: 20, offset: 0 }, data: { getSessions: [session('room')] } });
  const client = new ApolloClient({ cache, link: new ApolloLink(() => new Observable(sink => { observer = sink; })) });
  const provider = ({ children }) => <ApolloProvider client={client}>{children}</ApolloProvider>;
  const { unmount } = renderHook(() => useNewSessionEntrySubscription('room'), { wrapper: provider });
  await waitFor(() => expect(observer).toBeDefined());
  act(() => { observer.next({ data: { onNewSessionEntry: entry('new') } }); observer.next({ data: { onNewSessionEntry: entry('new') } }); });
  expect(cache.readQuery({ query: GET_SESSION_ENTRIES, variables }).getSessionEntries.map(e => e.id)).toEqual(['old', 'new']);
  unmount(); client.stop();
});
test('session creation returns the new session and rejects an empty mutation result', async () => {
  const input = { title: 'New room', type: 'OPEN' };
  const mocks = [
    { request: { query: CREATE_SESSION, variables: { input } }, result: { data: { createSession: session('created') } } },
    { request: { query: GET_SESSIONS, variables: { limit: 20, offset: 0 } }, result: { data: { getSessions: [session('created')] } } },
    { request: { query: CREATE_SESSION, variables: { input } }, result: { data: { createSession: null } } },
    { request: { query: GET_SESSIONS, variables: { limit: 20, offset: 0 } }, result: { data: { getSessions: [] } } },
  ];
  const { result } = renderHook(useCreateSession, { wrapper: wrapper(mocks) });
  await act(async () => { expect(await result.current.createSession(input)).toMatchObject({ id: 'created' }); });
  await act(async () => { await expect(result.current.createSession(input)).rejects.toThrow('Oturum oluşturulamadı'); });
});
test('like and close operations target the selected entry and session', async () => {
  const mocks = [
    { request: { query: TOGGLE_SESSION_ENTRY_LIKE, variables: { entryId: 'e' } }, result: { data: { toggleSessionEntryLike: entry('e') } } },
    { request: { query: CLOSE_SESSION, variables: { sessionId: 'room' } }, result: { data: { closeSession: true } } },
    { request: { query: GET_SESSIONS, variables: { limit: 20, offset: 0 } }, result: { data: { getSessions: [] } } },
  ];
  const { result } = renderHook(() => ({ like: useToggleSessionEntryLike(), close: useCloseSession() }), { wrapper: wrapper(mocks) });
  await act(async () => { expect((await result.current.like.toggleLike('e')).data.toggleSessionEntryLike.id).toBe('e'); });
  await act(async () => { expect((await result.current.close.closeSession('room')).data.closeSession).toBe(true); });
});
