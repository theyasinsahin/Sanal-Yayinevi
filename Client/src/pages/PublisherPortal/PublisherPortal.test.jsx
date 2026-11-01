import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import PublisherPortal from './index';
import { PUBLISHER_CATALOG } from '../../graphql/publisher';

jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
const campaign = { id: 'campaign', state: 'ACTIVE', environment: 'SANDBOX', targetMinor: 100000, acceptedMinor: 12345, supporterCount: 3, endsAt: '2099-12-01T12:00:00.000Z', updatedAt: '2026-11-01T12:00:00.000Z' };
const book = { id: 'book', urlSlug: 'yeni-roman', title: 'Yeni Roman', imageUrl: '', authorName: 'İpek Yazar', writingStatus: 'COMPLETED', publishDate: '2026-11-01T12:00:00.000Z', campaign };
const variables = { page: 1, limit: 20, search: '', funding: 'ALL' };
const catalog = (items = [book], extra = {}) => ({ items, total: items.length, page: 1, totalPages: items.length ? 1 : 0, refreshedAt: '2026-11-01T12:00:00.000Z', ...extra });
const response = (value = catalog(), args = {}, extra = {}) => ({ request: { query: PUBLISHER_CATALOG, variables: { ...variables, ...args } }, result: { data: { publisherCatalog: value } }, ...extra });
const show = mocks => render(<MockedProvider mocks={mocks} addTypename={false}><MemoryRouter><PublisherPortal /></MemoryRouter></MockedProvider>);

test('shows accepted support in TRY, campaign progress and the public book link', async () => {
  show([response()]);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Yeni Roman' })).toHaveAttribute('href', '/kitap/yeni-roman');
  expect(screen.getByText('İpek Yazar')).toBeInTheDocument();
  expect(screen.getByText(/123,45/)).toBeInTheDocument();
  expect(screen.getByText(/1.000,00/)).toBeInTheDocument();
  expect(screen.getByText('Test kampanyası')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '12.345');
  expect(screen.getByRole('button', { name: 'Sonraki' })).toBeDisabled();
});

test('search and funding filters request selected results and reset pagination', async () => {
  show([response(catalog([book], { total: 21, totalPages: 2 })), response(catalog([], { page: 2, total: 21, totalPages: 2 }), { page: 2 }),
    response(catalog(), { search: 'İpek' }), response(catalog([]), { search: 'İpek', funding: 'ACTIVE' })]);
  await screen.findByRole('link', { name: 'Yeni Roman' });
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  await screen.findByText('Sayfa 2 / 2');
  fireEvent.change(screen.getByLabelText('Kitap veya yazar ara'), { target: { value: '  İpek  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ara', exact: true }));
  await screen.findByText('Sayfa 1 / 1');
  fireEvent.change(screen.getByLabelText('Destek durumu'), { target: { value: 'ACTIVE' } });
  expect(await screen.findByText('Bu filtrelere uygun kitap bulunamadı.')).toBeInTheDocument();
});

test('manual refresh fetches updated support instead of displaying a cached amount', async () => {
  show([response(), response(catalog([{ ...book, campaign: { ...campaign, acceptedMinor: 50000 } }]))]);
  await screen.findByText(/123,45/);
  fireEvent.click(screen.getByRole('button', { name: 'Yenile' }));
  expect(await screen.findByText(/500,00/)).toBeInTheDocument();
  expect(screen.queryByText(/123,45/)).not.toBeInTheDocument();
});

test('a rejected refresh hides previously loaded data and supports retry', async () => {
  show([response(), { request: { query: PUBLISHER_CATALOG, variables }, error: new Error('Forbidden') }, response()]);
  await screen.findByRole('link', { name: 'Yeni Roman' });
  fireEvent.click(screen.getByRole('button', { name: 'Yenile' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Portal verileri alınamadı.');
  expect(screen.queryByRole('link', { name: 'Yeni Roman' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByRole('link', { name: 'Yeni Roman' })).toBeInTheDocument();
});

test('books without campaigns have a clear empty state and legacy links', async () => {
  show([response(catalog([{ ...book, urlSlug: null, campaign: null }]))]);
  expect(await screen.findByRole('link', { name: 'Yeni Roman' })).toHaveAttribute('href', '/book-detail/book');
  expect(screen.getByText('Güncel destek sisteminde kampanya yok.')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('empty results can reset all filters', async () => {
  show([response(catalog([])), response(catalog([]), { search: 'Metin' }), response()]);
  await screen.findByText('Bu filtrelere uygun kitap bulunamadı.');
  fireEvent.change(screen.getByLabelText('Kitap veya yazar ara'), { target: { value: 'Metin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ara', exact: true }));
  await screen.findByText('Bu filtrelere uygun kitap bulunamadı.');
  fireEvent.click(screen.getByRole('button', { name: 'Filtreleri temizle' }));
  expect(screen.getByLabelText('Kitap veya yazar ara')).toHaveValue('');
  expect(await screen.findByRole('link', { name: 'Yeni Roman' })).toBeInTheDocument();
});
