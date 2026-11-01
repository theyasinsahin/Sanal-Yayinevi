import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Newsletter from '../../components/Navigation/Footer/Newsletter';
import { AuthorsPage, PublishedBooksPage, ContactPage, LegalPage } from './index';
import { MockedProvider } from '@apollo/client/testing';
import { GET_AUTHORS, GET_COMMUNITY_CONFIG } from '../../graphql/queries/community';
import { SUBSCRIBE_NEWSLETTER } from '../../graphql/mutations/community';
import { GET_PRINTED_BOOKS } from '../../graphql/printedBooks';

jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
const show = (component, mocks = []) => render(<MockedProvider mocks={mocks} addTypename={false}><MemoryRouter>{component}</MemoryRouter></MockedProvider>);
test('printed catalog shows a real empty state and offers authenticated submission', async () => {
  show(<PublishedBooksPage />, [{ request: { query: GET_PRINTED_BOOKS, variables: { page: 1, search: '' } }, result: { data: { getPrintedBooks: { books: [], total: 0, page: 1, totalPages: 1 } } } }]);
  expect(await screen.findByText('Raflarımız ilk eserlerini bekliyor')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Kitap eklemek için giriş yapın' })).toHaveAttribute('href', '/login');
});
test('authors load with real totals, profile links and pagination', async () => {
  const author = { id: 'abc', username: 'writer', fullName: 'Writer', bio: '', profilePicture: '', bookCount: 2, pageCount: 317 };
  show(<AuthorsPage />, [
    { request: { query: GET_AUTHORS, variables: { page: 1 } }, result: { data: { getAuthors: { total: 25, page: 1, pageSize: 10, totalPages: 3, authors: [author] } } } },
    { request: { query: GET_AUTHORS, variables: { page: 2 } }, result: { data: { getAuthors: { total: 25, page: 2, pageSize: 10, totalPages: 3, authors: [] } } } },
  ]);
  expect(screen.getByRole('status')).toHaveTextContent('yükleniyor');
  expect(await screen.findByRole('heading', { name: 'Topluluğumuzdaki 25 Yazar' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /writer/ })).toHaveAttribute('href', '/yazar/writer');
  expect(screen.getByText('317 sayfa')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText('Sayfa 2 / 3')).toBeInTheDocument();
});
test('authors expose failure and retry', async () => {
  show(<AuthorsPage />, [
    { request: { query: GET_AUTHORS, variables: { page: 1 } }, error: new Error('Bağlantı hatası') },
    { request: { query: GET_AUTHORS, variables: { page: 1 } }, result: { data: { getAuthors: { total: 0, page: 1, pageSize: 12, totalPages: 1, authors: [] } } } },
  ]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı hatası');
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByText('Bu sayfada henüz bir yazar yok')).toBeInTheDocument();
});
test('newsletter reports server failure rather than success', async () => {
  show(<Newsletter />, [{ request: { query: SUBSCRIBE_NEWSLETTER, variables: { input: { email: 'reader@example.test', consent: true, website: '' } } }, error: new Error('Gönderilemedi') }]);
  fireEvent.change(screen.getByLabelText('E-posta adresiniz'), { target: { value: 'reader@example.test' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('form', { name: 'Bülten aboneliği' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Gönderilemedi');
});
test('contact presents bounded labelled fields and privacy notice', async () => {
  show(<ContactPage />, [{ request: { query: GET_COMMUNITY_CONFIG }, result: { data: { getCommunityConfig: { email: '', phone: '', socials: { instagram: null, x: null, linkedin: null, tiktok: null } } } } }]);
  expect(screen.getByLabelText('Mesaj')).toHaveAttribute('maxlength', '5000');
  expect(screen.getByRole('link', { name: 'Gizlilik taslağını okuyun.' })).toHaveAttribute('href', '/privacy');
  expect(await screen.findByText('Telefon bilgisi henüz yayımlanmadı.')).toBeInTheDocument();
});
test.each(['terms', 'privacy'])('legal %s page clearly marks draft content', kind => {
  show(<LegalPage kind={kind} />); expect(screen.getByText(/Bu metin taslaktır/)).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'İçindekiler' })).toBeInTheDocument();
});
