import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import PrintedReadingLibrary from './index';
import { useAuth } from '../../../context/AuthContext';
import { GET_PRINTED_READINGS, REMOVE_PRINTED_READING } from '../../../graphql/printedReadings';

jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
const item = { __typename: 'PrintedBookReading', id: 'reading', userId: 'reader', rating: 5, review: 'Özgün ve akıcı bir roman.', readAt: '2026-10-27T09:00:00Z', updatedAt: '2026-10-27T09:00:00Z', book: { __typename: 'Book', id: 'book', publicPath: '/kitap/basili-roman', title: 'Basılı Roman', imageUrl: '', kind: 'PRINTED', publicationStatus: 'APPROVED', printedAuthor: 'Bir Yazar', publisher: 'Yayınevi' } };
const shelf = (items = [item], extra = {}, page = 1) => ({ request: { query: GET_PRINTED_READINGS, variables: { userId: 'reader', page } }, result: { data: { getPrintedReadings: { __typename: 'PrintedReadingPage', items, total: items.length, page, totalPages: items.length ? 1 : 0, canView: true, ...extra } } } });
const show = mocks => render(<MockedProvider mocks={mocks}><MemoryRouter><PrintedReadingLibrary userId="reader" /></MemoryRouter></MockedProvider>);
beforeEach(() => useAuth.mockReturnValue({ user: { id: 'reader' }, ensureSession: () => ({ id: 'reader' }) }));

test('profile library shows the real printed edition, score and review', async () => {
  show([shelf()]);
  expect(await screen.findByRole('link', { name: 'Basılı Roman' })).toHaveAttribute('href', '/kitap/basili-roman');
  expect(screen.getByLabelText('5 / 5 puan')).toBeInTheDocument();
  expect(screen.getByText(item.review)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Değerlendirmeyi düzenle' })).toBeInTheDocument();
});

test('visitors can read a public shelf without owner controls', async () => {
  useAuth.mockReturnValue({ user: { id: 'visitor' } }); show([shelf()]);
  await screen.findByText(item.review);
  expect(screen.queryByRole('button', { name: 'Kitaplığımdan kaldır' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Değerlendirmeyi düzenle' })).not.toBeInTheDocument();
});

test('a private library response displays no books, review or count', async () => {
  show([shelf([], { canView: false })]);
  expect(await screen.findByText('Bu kullanıcının kitaplığı gizli.')).toBeInTheDocument();
  expect(screen.queryByText(item.review)).not.toBeInTheDocument();
  expect(screen.queryByText(/basılı kitap okundu/)).not.toBeInTheDocument();
});

test('an owner can remove a book from the profile and sees the empty state', async () => {
  show([shelf(), { request: { query: REMOVE_PRINTED_READING, variables: { bookId: 'book' } }, result: { data: { removePrintedBookReading: true } } }, shelf([])]);
  fireEvent.click(await screen.findByRole('button', { name: 'Kitaplığımdan kaldır' }));
  expect(await screen.findByRole('link', { name: 'Basılı kitapları keşfet' })).toHaveAttribute('href', '/printed-books');
  expect(screen.queryByText(item.review)).not.toBeInTheDocument();
});

test('the next profile page uses the server page number', async () => {
  show([shelf([item], { total: 13, totalPages: 2 }), shelf([{ ...item, id: 'second', review: 'İkinci sayfadaki değerlendirme.' }], { total: 13, totalPages: 2 }, 2)]);
  await screen.findByText(item.review);
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  expect(await screen.findByText('İkinci sayfadaki değerlendirme.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sonraki' })).toBeDisabled();
});
