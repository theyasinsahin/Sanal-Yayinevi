import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import BookCard from './index';
import { GET_BOOK_CARD } from '../../../graphql/queries/book';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
const book = { id: 'book', kind: 'DIGITAL', title: 'Forest', description: 'A book description', publicPath: '/kitap/forest', pageCount: 30, status: 'WRITING', author: { id: 'author', username: 'author', fullName: 'Author' }, stats: { likes: 2, views: 1500 } };
const funding = { id: 'campaign', state: 'ACTIVE', environment: 'SANDBOX', targetMinor: 100000, acceptedMinor: 12345, remainingMinor: 87655, progressPercent: 12.345, isOpen: true, goalReached: false, endsAt: '2099-01-01T00:00:00.000Z' };
function Destination() { const location = useLocation(); return <h1>{location.pathname} {location.state?.catalogReturn}</h1>; }
const show = (props, mocks = []) => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={['/feed?search=forest']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/feed" element={<BookCard {...props} />} /><Route path="/kitap/forest" element={<Destination />} /><Route path="/yazar/author" element={<Destination />} /></Routes></MemoryRouter></MockedProvider>);

test('opening a book preserves the originating catalog URL for return navigation', () => {
  show({ book }); fireEvent.click(screen.getByText('Forest'));
  expect(screen.getByRole('heading')).toHaveTextContent('/kitap/forest /feed?search=forest');
});
test('author links open the profile without also opening the book', () => {
  show({ book }); fireEvent.click(screen.getByRole('link', { name: 'Author' }));
  expect(screen.getByRole('heading')).toHaveTextContent('/yazar/author');
});
test('missing or failed cover images use the shared placeholder', () => {
  show({ book });
  const image = screen.getByRole('img', { name: 'Forest' });
  expect(image).toHaveAttribute('src', '/images/book-placeholder.svg');
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/images/book-placeholder.svg');
});
test('metadata provides reading time and popularity while long descriptions are capped', () => {
  show({ book: { ...book, description: 'a'.repeat(150) } });
  expect(screen.getByText('~10 dk okuma')).toBeInTheDocument();
  expect(screen.getByText('Popüler')).toBeInTheDocument();
  expect(screen.getByText(`${'a'.repeat(120)}...`)).toBeInTheDocument();
});
test('unresolved books render no broken card and skeletons render before data is available', () => {
  const { rerender } = render(<MockedProvider mocks={[]}><MemoryRouter><BookCard /></MemoryRouter></MockedProvider>);
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.book-card')).toBeNull();
  rerender(<MockedProvider mocks={[]}><MemoryRouter><BookCard skeleton /></MemoryRouter></MockedProvider>);
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('.book-card.skeleton')).toBeInTheDocument();
});

test('an open campaign shows the accepted amount, target, Turkish percentage and accessible progress', () => {
  show({ book: { ...book, fundingSummary: funding, currentFunding: 999999, fundingTarget: 999999 } });
  expect(screen.getByText('123,45 TL')).toBeInTheDocument();
  expect(screen.getByText(/1.000,00 TL hedef/)).toBeInTheDocument();
  expect(screen.getByText('Tamamlanma: %12,3')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Desteğe açık' })).toHaveAttribute('value', '12.345');
  expect(screen.getByText('Test kampanyası')).toBeInTheDocument();
  expect(screen.queryByText(/999.999/)).not.toBeInTheDocument();
});

test('a new campaign with zero accepted support still shows its zero progress', () => {
  show({ book: { ...book, fundingSummary: { ...funding, acceptedMinor: 0, progressPercent: 0 } } });
  expect(screen.getByText('0,00 TL')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
});

test.each([null, { ...funding, isOpen: false }, { ...funding, endsAt: '2020-01-01' }, { ...funding, targetMinor: 0 },
  { ...funding, state: 'CANCELLED', isOpen: false }, { ...funding, state: 'REFUNDED', isOpen: false }])('non-open campaign %j has no misleading support bar', fundingSummary => {
  show({ book: { ...book, status: 'FUNDING', currentFunding: 500, fundingTarget: 1000, fundingSummary } });
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText(/TL hedef/)).not.toBeInTheDocument();
});

test('funded books retain a full bar and a clear completed label', () => {
  show({ book: { ...book, fundingSummary: { ...funding, state: 'SUCCEEDED', acceptedMinor: 100000, remainingMinor: 0, progressPercent: 100, isOpen: false, goalReached: true, endsAt: '2020-01-01' } } });
  expect(screen.getByRole('progressbar', { name: 'Hedef tamamlandı' })).toHaveAttribute('value', '100');
  expect(screen.getByText('Tamamlanma: %100')).toBeInTheDocument();
  expect(screen.queryByText('Kampanya sonucu doğrulanıyor.')).not.toBeInTheDocument();
});

test('a reached target awaiting settlement is explicitly distinguished from a successful campaign', () => {
  show({ book: { ...book, fundingSummary: { ...funding, state: 'CLOSING', acceptedMinor: 100000, progressPercent: 100, isOpen: false, goalReached: true } } });
  expect(screen.getByText('Kampanya sonucu doğrulanıyor.')).toBeInTheDocument();
});

test('clicking support progress opens the book while preserving the discovery return location', () => {
  show({ book: { ...book, fundingSummary: funding } });
  fireEvent.click(screen.getByRole('progressbar'));
  expect(screen.getByRole('heading')).toHaveTextContent('/kitap/forest /feed?search=forest');
});

test('cards loaded by ID also receive and display the campaign summary', async () => {
  show({ bookId: book.id }, [{ request: { query: GET_BOOK_CARD, variables: { id: book.id } }, result: { data: { getBookById: {
    ...book, __typename: 'Book', publishDate: null, imageUrl: '', printedAuthor: null, publisher: null, publicationYear: null, isbn: null,
    author: { ...book.author, profilePicture: '' }, format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'NEEDS_REVIEW',
    commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0, fundingSummary: funding,
  } } } }]);
  expect(await screen.findByRole('progressbar', { name: 'Desteğe açık' })).toHaveAttribute('value', '12.345');
  expect(screen.getByText('123,45 TL')).toBeInTheDocument();
});
