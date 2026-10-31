import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import QuotesPage from './index';
import { GET_QUOTES_FEED, SEARCH_QUOTES } from '../../graphql/queries/quote';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Quote/QuoteCard', () => ({ quote }) => <article>{quote.text}</article>);
const quote = (id, text = id) => ({ __typename: 'Quote', id, text, note: '', visibility: 'PUBLIC', chapterId: null, chapterTitle: '', chapterIndex: null, location: null, pageNumber: null, likedBy: [], isRepost: false, originalQuote: null, repostComment: '', isSpoiler: false, repostedBy: [], commentCount: 0, createdAt: '2026-01-01', user: null, book: null });
let observers;
const originalObserver = window.IntersectionObserver;
beforeEach(() => {
  observers = [];
  window.IntersectionObserver = jest.fn(callback => {
    const observer = { callback, observe: jest.fn(), disconnect: jest.fn() };
    observers.push(observer); return observer;
  });
});
afterEach(() => { window.IntersectionObserver = originalObserver; jest.useRealTimers(); });
const page = (sortBy, values, offset = 0) => ({ request: { query: GET_QUOTES_FEED, variables: { limit: 20, offset, sortBy } }, result: { data: { getQuotesFeed: values } } });
const show = mocks => render(<MockedProvider mocks={mocks}><QuotesPage /></MockedProvider>);

test('an empty public quote feed provides a readable empty state', async () => {
  show([page('popular', [])]);
  expect(await screen.findByText('Henüz alıntı yok')).toBeInTheDocument();
});
test('sorting replaces the feed with the selected order', async () => {
  show([page('popular', [quote('popular')]), page('newest', [quote('newest')])]);
  expect(await screen.findByText('popular')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'En Yeni' }));
  expect(await screen.findByText('newest')).toBeInTheDocument();
  expect(screen.queryByText('popular')).not.toBeInTheDocument();
});
test('search debounces requests, displays matches, and clearing returns to the feed', async () => {
  jest.useFakeTimers();
  const search = jest.fn(() => ({ data: { searchQuotes: [quote('match', 'Search match')] } }));
  show([page('popular', [quote('feed', 'Feed quote')]), { request: { query: SEARCH_QUOTES, variables: { query: 'final', limit: 20, offset: 0 } }, result: search }]);
  await act(async () => { jest.advanceTimersByTime(50); });
  const input = screen.getByPlaceholderText('Alıntı, kitap veya yazar ara...');
  fireEvent.change(input, { target: { value: 'first' } });
  act(() => jest.advanceTimersByTime(200));
  fireEvent.change(input, { target: { value: 'final' } });
  await act(async () => { jest.advanceTimersByTime(400); });
  await act(async () => { jest.advanceTimersByTime(50); });
  expect(screen.getByText('Search match')).toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByText('Feed quote')).toBeInTheDocument();
});
test('infinite scrolling deduplicates overlapping pages and stops after a short final page', async () => {
  const first = Array.from({ length: 20 }, (_, i) => quote(`quote${i}`));
  show([page('popular', first), page('popular', [first[19], quote('last')], 20)]);
  expect(await screen.findByText('quote0')).toBeInTheDocument();
  // Wait for the observer associated with the loaded page, rather than firing
  // the initial observer while its callback still captures loading=true.
  await waitFor(() => expect(observers.length).toBeGreaterThan(1));
  await act(async () => { observers.at(-1).callback([{ isIntersecting: true }]); });
  expect(await screen.findByText('last')).toBeInTheDocument();
  expect(screen.getAllByText('quote19')).toHaveLength(1);
  expect(screen.getByText(/Tüm alıntılar yüklendi/)).toBeInTheDocument();
});
