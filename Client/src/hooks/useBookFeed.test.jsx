import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';
import { GET_BOOK_FEED } from '../graphql/queries/book';
import { useBookFeed } from './useBookFeed';

const card = id => ({ __typename: 'Book', format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'NEEDS_REVIEW', id, publicPath: `/kitap/${id}`, title: id, description: '', imageUrl: '', pageCount: 0,
  publishDate: null, status: 'WRITING', kind: 'DIGITAL', printedAuthor: null, publisher: null,
  publicationYear: null, isbn: null, author: null, classification: null, stats: { __typename: 'BookStats', views: 0, likes: 0 },
  commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0, fundingSummary: null });
const filters = { classification: null, sortBy: 'newest', search: '' };
const variables = { limit: 24, sort: 'NEWEST', classification: null, search: null };
const result = (ids, endCursor, hasNextPage) => ({ data: { getBookFeed: { __typename: 'BookFeedPage', books: ids.map(card), endCursor, hasNextPage } } });
const wrapper = mocks => ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;

test('more books append once while retaining existing cards and server pagination state', async () => {
  const view = renderHook(() => useBookFeed(filters), { wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first', 'second'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, result: result(['second', 'third'], 'end', false) },
  ]) });
  await waitFor(() => expect(view.result.current.books).toHaveLength(2));
  await act(async () => { await Promise.all([view.result.current.loadMore(), view.result.current.loadMore()]); });
  expect(view.result.current.moreError).toBeNull();
  await waitFor(() => expect(view.result.current.books.map(book => book.id)).toEqual(['first', 'second', 'third']));
  expect(view.result.current.hasNextPage).toBe(false);
});

test('a delayed older page cannot enter the results after the filter changes', async () => {
  const view = renderHook(({ filter }) => useBookFeed(filter), { initialProps: { filter: filters }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, delay: 100, result: result(['old-page'], 'end', false) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, classification: { genres: ['fantastik'] } } }, result: result(['filtered'], 'end', false) },
  ]) });
  await waitFor(() => expect(view.result.current.books[0]?.id).toBe('first'));
  let request;
  act(() => { request = view.result.current.loadMore(); });
  view.rerender({ filter: { ...filters, classification: { genres: ['fantastik'] } } });
  await act(async () => { await request; });
  await waitFor(() => expect(view.result.current.books.map(book => book.id)).toEqual(['filtered']));
});

test('search waits for typing to settle and sends genre and sort to the server', async () => {
  const searched = jest.fn(() => result(['matching'], 'end', false));
  const view = renderHook(({ filter }) => useBookFeed(filter), { initialProps: { filter: filters }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first'], 'end', false) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, search: 'roman' } }, result: searched },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, search: 'roman', classification: { genres: ['fantastik'] }, sort: 'POPULAR' } }, result: result(['popular'], 'end', false) },
  ]) });
  await waitFor(() => expect(view.result.current.books).toHaveLength(1));
  view.rerender({ filter: { ...filters, search: 'r' } });
  view.rerender({ filter: { ...filters, search: 'roman' } });
  expect(searched).not.toHaveBeenCalled();
  await waitFor(() => expect(view.result.current.books[0]?.id).toBe('matching'));
  expect(searched).toHaveBeenCalledTimes(1);
  view.rerender({ filter: { ...filters, search: 'roman', classification: { genres: ['fantastik'] }, sortBy: 'popular' } });
  await waitFor(() => expect(view.result.current.books[0]?.id).toBe('popular'));
});

test('recommendation tab does not download the catalog until enabled', async () => {
  const fetched = jest.fn(() => result(['first'], 'end', false));
  const view = renderHook(({ enabled }) => useBookFeed(filters, enabled), { initialProps: { enabled: false }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables }, result: fetched },
  ]) });
  expect(fetched).not.toHaveBeenCalled();
  view.rerender({ enabled: true });
  await waitFor(() => expect(view.result.current.books).toHaveLength(1));
  expect(fetched).toHaveBeenCalledTimes(1);
});

test('returning to discovery retains books loaded with load more and the pagination cursor', async () => {
  const cache = new InMemoryCache();
  const mocks = [
    { request: { query: GET_BOOK_FEED, variables }, result: result(['first'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, result: result(['second'], 'next', true) },
  ];
  const provider = ({ children }) => <MockedProvider cache={cache} mocks={mocks}>{children}</MockedProvider>;
  const view = renderHook(() => useBookFeed(filters), { wrapper: provider });
  await waitFor(() => expect(view.result.current.books).toHaveLength(1));
  await act(async () => { await view.result.current.loadMore(); });
  await waitFor(() => expect(view.result.current.books).toHaveLength(2));
  view.unmount();
  const utils = renderHook(() => useBookFeed(filters), {
    wrapper: ({ children }) => <MockedProvider cache={cache} mocks={[]}>{children}</MockedProvider>,
  });
  expect(utils.result.current.books.map(book => book.id)).toEqual(['first', 'second']);
  expect(utils.result.current.loading).toBe(false);
  expect(utils.result.current.hasNextPage).toBe(true);
});

test('funding filters and closest sort are sent with the same search and pagination cursor', async () => {
  const selected = { ...filters, sortBy: 'closestToTarget', search: 'İpek', classification: { genres: ['roman'] } };
  const requested = { ...variables, sort: 'CLOSEST_TO_TARGET', funding: 'ACTIVE', search: 'İpek', classification: { genres: ['roman'] } };
  const view = renderHook(() => useBookFeed(selected), { wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables: requested }, result: result(['near'], 'near-cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...requested, after: 'near-cursor' } }, result: result(['far'], null, false) },
  ]) });
  await waitFor(() => expect(view.result.current.books[0]?.id).toBe('near'));
  await act(async () => { await view.result.current.loadMore(); });
  await waitFor(() => expect(view.result.current.books.map(book => book.id)).toEqual(['near', 'far']));
});

test('changing from active campaigns to funded books starts a separate result set', async () => {
  const view = renderHook(({ funding }) => useBookFeed({ ...filters, funding }), { initialProps: { funding: 'ACTIVE' }, wrapper: wrapper([
    { request: { query: GET_BOOK_FEED, variables: { ...variables, funding: 'ACTIVE' } }, result: result(['active'], 'cursor', true) },
    { request: { query: GET_BOOK_FEED, variables: { ...variables, funding: 'FUNDED' } }, result: result(['funded'], null, false) },
  ]) });
  await waitFor(() => expect(view.result.current.books[0]?.id).toBe('active'));
  view.rerender({ funding: 'FUNDED' });
  await waitFor(() => expect(view.result.current.books.map(book => book.id)).toEqual(['funded']));
  expect(view.result.current.hasNextPage).toBe(false);
});
