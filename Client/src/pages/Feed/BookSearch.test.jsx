import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import FeedPage from './index';
import LandingPage from '../Landing';
import { FiltersProvider } from '../../context/FiltersContext';
import { GET_BOOK_FEED } from '../../graphql/queries/book';
import { GET_ALL_GENRES } from '../../graphql/queries/genre';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@mui/icons-material', () => ({ Search: () => null }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <div>{children}</div> }));
jest.mock('../../components/Landing/HowItWorks', () => () => null);
jest.mock('../../components/Landing/TrustedPublishers', () => () => null);
jest.mock('../../components/Books/BookCard', () => ({ book, skeleton }) => skeleton ? <div />
  : <a href={book.publicPath} data-testid="book-card">{book.title}</a>);

const book = (id, title) => ({
  __typename: 'Book', format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'NEEDS_REVIEW', id, publicPath: `/kitap/${id}`, title, description: '', imageUrl: '', pageCount: 10,
  status: 'WRITING', kind: 'DIGITAL', publishDate: null, printedAuthor: null, publisher: null,
  publicationYear: null, isbn: null, author: null, classification: null,
  stats: { __typename: 'BookStats', likes: 0, views: 0 }, commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0, fundingSummary: null,
});
const quotedBook = book('quoted', 'Kıyıda Bir Sabah');
const otherBook = book('other', 'Başka Bir Kitap');
const quoteText = 'Gökyüzü bize hâlâ umut veriyor.';
const term = 'hâlâ umut';
const response = (variables, books) => ({
  request: { query: GET_BOOK_FEED, variables },
  result: { data: { getBookFeed: { __typename: 'BookFeedPage', books, hasNextPage: false, endCursor: null } } },
});

beforeEach(() => { window.scrollTo = jest.fn(); });

test.each([
  ['homepage', LandingPage, 10, 'POPULAR'],
  ['discovery', FeedPage, 24, 'NEWEST'],
])('%s searches quote text through the book catalog and displays only books', async (_, Page, limit, sort) => {
  const variables = { limit, sort, classification: null, search: null };
  render(
    <MockedProvider mocks={[
      response(variables, [quotedBook, otherBook]),
      response({ ...variables, search: term }, [quotedBook]),
      { request: { query: GET_ALL_GENRES }, result: { data: { getAllGenres: [] } } },
    ]}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FiltersProvider><Page /></FiltersProvider>
      </MemoryRouter>
    </MockedProvider>
  );
  await screen.findByRole('link', { name: otherBook.title });
  const input = screen.getByRole('searchbox', { name: /Kitap, yazar|Bir sonraki kitabını bul/ });
  expect(input).toHaveAttribute('placeholder', 'Kitap, yazar veya alıntı ara...');
  await act(async () => userEvent.type(input, term));
  await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(1));
  expect(screen.getByRole('link', { name: quotedBook.title })).toHaveAttribute('href', quotedBook.publicPath);
  expect(screen.queryByRole('link', { name: otherBook.title })).not.toBeInTheDocument();
  expect(screen.queryByText(quoteText)).not.toBeInTheDocument();
  await act(async () => userEvent.clear(input));
  await screen.findByRole('link', { name: otherBook.title });
  expect(screen.getAllByTestId('book-card')).toHaveLength(2);
});
