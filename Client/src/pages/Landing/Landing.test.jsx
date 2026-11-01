import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './index';
import { GET_BOOK_FEED } from '../../graphql/queries/book';

jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Landing/HowItWorks', () => () => null);
jest.mock('../../components/Landing/TrustedPublishers', () => () => null);
jest.mock('../../components/Books/BookCard', () => ({ book, skeleton }) => skeleton
  ? <div data-testid="book-skeleton" />
  : <a href={book.publicPath} data-testid="book-card">{book.title}</a>);

const book = (id, title, likes, views = 0, author = null) => ({
  __typename: 'Book', format: null, genres: [], classificationTags: [], narrativeFeatures: [], targetAudience: null, contentWarnings: [], classificationStatus: 'NEEDS_REVIEW', id, publicPath: `/kitap/${id}`, title, description: '', imageUrl: '', pageCount: 10,
  status: 'WRITING', kind: 'DIGITAL', publishDate: null, printedAuthor: null, publisher: null,
  publicationYear: null, isbn: null, author, classification: null,
  stats: { __typename: 'BookStats', likes, views }, commentCount: 0, currentFunding: 0, fundingTarget: 0, backerCount: 0, fundingSummary: null,
});
const books = [
  book('popular', 'En Sevilen Roman', 12, 100),
  book('other', 'Diğer Roman', 10, 10),
  book('first', 'İstanbul Hikâyeleri', 2, 20, { __typename: 'User', id: 'author', fullName: 'Işıl Yılmaz', username: 'kitapkurdu', profilePicture: '' }),
];
const variables = { limit: 10, sort: 'POPULAR', classification: null, search: null };
const response = (records, overrides = {}, hasNextPage = false, endCursor = null) => ({
  request: { query: GET_BOOK_FEED, variables: { ...variables, ...overrides } },
  result: { data: { getBookFeed: { __typename: 'BookFeedPage', books: records, hasNextPage, endCursor } } },
});
const show = (mocks = [response(books)]) => render(
  <MockedProvider mocks={mocks}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LandingPage /></MemoryRouter></MockedProvider>
);
const search = value => fireEvent.change(screen.getByRole('searchbox'), { target: { value } });

test('retains the introduction and requests a bounded page sorted by server popularity', async () => {
  show();
  expect(screen.getByRole('heading', { level: 1, name: 'Fikriniz Kitaplaşsın' })).toBeInTheDocument();
  expect(screen.getByText('Kaleminizden çıkan eserlerin gerçek bir kitaba dönüşme yolculuğuna tanık olun')).toBeInTheDocument();
  expect(screen.getByRole('searchbox', { name: 'Bir sonraki kitabını bul' })).toHaveAttribute('aria-controls', 'home-books');
  expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', '100');
  expect(screen.getAllByTestId('book-skeleton')).toHaveLength(10);
  await screen.findByText('En Sevilen Roman');
  expect(screen.getAllByTestId('book-card').map(card => card.textContent)).toEqual(books.map(item => item.title));
  expect(screen.getByRole('link', { name: 'Tüm Kitapları Gör →' })).toHaveAttribute('href', '/feed');
});

test.each(['  İSTANBUL  ', 'IŞIL', 'KİTAPKURDU'])('sends title or author searches to the catalog and can clear them: %s', async term => {
  show([response(books), response([books[2]], { search: term.trim() })]);
  await screen.findByText('En Sevilen Roman');
  search(term);
  expect(screen.getByRole('region', { name: 'Arama Sonuçları' })).toHaveAttribute('aria-busy', 'true');
  expect(await screen.findByText('1 kitap listeleniyor.')).toBeInTheDocument();
  expect(screen.getAllByTestId('book-card')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'İstanbul Hikâyeleri' })).toHaveAttribute('href', '/kitap/first');
  fireEvent.click(screen.getByRole('button', { name: 'Aramayı temizle' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('heading', { name: 'En Popüler Kitaplar' })).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(3));
});

test('typing each character, submitting with Enter and clearing keep the search connected to the results', async () => {
  show([response(books), response([books[2]], { search: 'İstanbul' })]);
  await screen.findByText('En Sevilen Roman');
  const input = screen.getByRole('searchbox');
  await act(async () => userEvent.type(input, 'İstanbul{enter}'));
  expect(input).toHaveValue('İstanbul');
  expect(await screen.findByText('1 kitap listeleniyor.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'İstanbul Hikâyeleri' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'En Sevilen Roman' })).not.toBeInTheDocument();
  await act(async () => userEvent.click(screen.getByRole('button', { name: 'Aramayı temizle' })));
  expect(input).toHaveValue('');
  await screen.findByRole('link', { name: 'En Sevilen Roman' });
  expect(screen.getAllByTestId('book-card')).toHaveLength(3);
});

test('loads more cursor pages and searches books outside the loaded pages', async () => {
  const records = Array.from({ length: 10 }, (_, index) => book(String(index), `Kitap ${index}`, 10 - index));
  show([
    response(records.slice(0, 8), {}, true, 'cursor'),
    response(records.slice(8), { after: 'cursor' }),
    response([records[9]], { search: 'Kitap 9' }),
  ]);
  await screen.findByText('Kitap 0');
  expect(screen.getAllByTestId('book-card')).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: 'Daha Fazla Kitap Göster' }));
  await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(10));
  search('Kitap 9');
  expect(await screen.findByText('1 kitap listeleniyor.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kitap 9' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Daha Fazla Kitap Göster' })).not.toBeInTheDocument();
});

test('an unmatched search can return to popular books without leaving the homepage', async () => {
  show([response(books), response([], { search: 'bulunmayan kitap' })]);
  await screen.findByText('En Sevilen Roman');
  search('bulunmayan kitap');
  expect(await screen.findByText(/Aramanızla eşleşen kitap bulunamadı/)).toBeInTheDocument();
  expect(screen.queryAllByTestId('book-card')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Popüler Kitaplara Dön' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(3));
});

test('an empty catalog gives a clear message', async () => {
  show([response([])]);
  expect(await screen.findByText('Henüz yayımlanmış kitap bulunmuyor.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Daha Fazla Kitap Göster' })).not.toBeInTheDocument();
});

test('a failed request can be retried without reloading the page', async () => {
  show([{ request: { query: GET_BOOK_FEED, variables }, error: new Error('Offline') }, response(books)]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantınızı kontrol edip tekrar deneyin.');
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden Dene' }));
  await waitFor(() => expect(screen.getAllByTestId('book-card')).toHaveLength(3));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a failed next page keeps existing books and allows retrying the cursor', async () => {
  show([
    response(books, {}, true, 'cursor'),
    { request: { query: GET_BOOK_FEED, variables: { ...variables, after: 'cursor' } }, error: new Error('Offline') },
    response([book('next', 'Sonraki Kitap', 0)], { after: 'cursor' }),
  ]);
  await screen.findByText('En Sevilen Roman');
  fireEvent.click(screen.getByRole('button', { name: 'Daha Fazla Kitap Göster' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Diğer kitaplar yüklenemedi.');
  expect(screen.getAllByTestId('book-card')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Daha Fazla Kitap Göster' }));
  expect(await screen.findByText('Sonraki Kitap')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
