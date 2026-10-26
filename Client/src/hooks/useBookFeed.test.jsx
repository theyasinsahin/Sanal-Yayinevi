import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { GET_BOOK_FEED } from '../graphql/queries/book';
import { useBookFeed } from './useBookFeed';

const card = id => ({ __typename: 'Book', id, publicPath: `/kitap/${id}`, title: id, description: '', imageUrl: '', pageCount: 0,
  publishDate: null, status: 'WRITING', kind: 'DIGITAL', printedAuthor: null, publisher: null,
  publicationYear: null, isbn: null, author: null, genre: null, stats: { __typename: 'BookStats', views: 0, likes: 0 },
  commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0 });
const filters = { genre: 'Tümü', sortBy: 'newest', search: '' };
const variables = { limit: 24, sort: 'NEWEST', genre: null, search: null };
const result = (ids, endCursor, hasNextPage) => ({ data: { getBookFeed: { __typename: 'BookFeedPage', books: ids.map(card), endCursor, hasNextPage } } });
const wrapper = mocks => ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;

test('more books append once while retaining existing cards and server pagination state', async () => {
  const hook = renderHook(() => useBookFeed(filters), { wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first', 'second'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, result: result(['second', 'third'], 'end', false) },
  ]) });
  await waitFor(() => expect(hook.result.current.books).toHaveLength(2));
  await act(async () => { await Promise.all([hook.result.current.loadMore(), hook.result.current.loadMore()]); });
  expect(hook.result.current.moreError).toBeNull();
  await waitFor(() => expect(hook.result.current.books.map(book => book.id)).toEqual(['first', 'second', 'third']));
  expect(hook.result.current.hasNextPage).toBe(false);
});

test('a delayed older page cannot enter the results after the filter changes', async () => {
  const hook = renderHook(({ filter }) => useBookFeed(filter), { initialProps: { filter: filters }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, delay: 100, result: result(['old-page'], 'end', false) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, genre: 'roman' } }, result: result(['filtered'], 'end', false) },
  ]) });
  await waitFor(() => expect(hook.result.current.books[0]?.id).toBe('first'));
  let request;
  act(() => { request = hook.result.current.loadMore(); });
  hook.rerender({ filter: { ...filters, genre: 'roman' } });
  await act(async () => { await request; });
  await waitFor(() => expect(hook.result.current.books.map(book => book.id)).toEqual(['filtered']));
});

test('search waits for typing to settle and sends genre and sort to the server', async () => {
  const searched = jest.fn(() => result(['matching'], 'end', false));
  const hook = renderHook(({ filter }) => useBookFeed(filter), { initialProps: { filter: filters }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first'], 'end', false) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, search: 'roman' } }, result: searched },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, search: 'roman', genre: 'roman', sort: 'POPULAR' } }, result: result(['popular'], 'end', false) },
  ]) });
  await waitFor(() => expect(hook.result.current.books).toHaveLength(1));
  hook.rerender({ filter: { ...filters, search: 'r' } });
  hook.rerender({ filter: { ...filters, search: 'roman' } });
  expect(searched).not.toHaveBeenCalled();
  await waitFor(() => expect(hook.result.current.books[0]?.id).toBe('matching'));
  expect(searched).toHaveBeenCalledTimes(1);
  hook.rerender({ filter: { ...filters, search: 'roman', genre: 'roman', sortBy: 'popular' } });
  await waitFor(() => expect(hook.result.current.books[0]?.id).toBe('popular'));
});

test('recommendation tab does not download the catalog until enabled', async () => {
  const fetched = jest.fn(() => result(['first'], 'end', false));
  const hook = renderHook(({ enabled }) => useBookFeed(filters, enabled), { initialProps: { enabled: false }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: fetched },
  ]) });
  expect(fetched).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await waitFor(() => expect(hook.result.current.books).toHaveLength(1));
  expect(fetched).toHaveBeenCalledTimes(1);
});
