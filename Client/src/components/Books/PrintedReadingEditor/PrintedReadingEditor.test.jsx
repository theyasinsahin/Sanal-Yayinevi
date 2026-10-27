import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import PrintedReadingEditor from './index';
import { useAuth } from '../../../context/AuthContext';
import { MY_PRINTED_READING, SAVE_PRINTED_READING, REMOVE_PRINTED_READING } from '../../../graphql/printedReadings';

jest.mock('../../../context/AuthContext', () => ({ useAuth: jest.fn() }));
const record = { __typename: 'PrintedBookReading', id: 'reading', userId: 'reader', rating: 4, review: 'Düşündürücü bir kitap.', readAt: '2026-10-27T09:00:00Z', updatedAt: '2026-10-27T09:00:00Z' };
const mine = value => ({ request: { query: MY_PRINTED_READING, variables: { bookId: 'book' } }, result: { data: { myPrintedBookReading: value } } });
const show = mocks => render(<MockedProvider mocks={mocks}><MemoryRouter><PrintedReadingEditor bookId="book" /></MemoryRouter></MockedProvider>);
beforeEach(() => useAuth.mockReturnValue({ user: { id: 'reader' }, ensureSession: () => ({ id: 'reader' }) }));

test('marking a printed book read saves the selected rating and comment and becomes editable', async () => {
  const result = jest.fn(() => ({ data: { savePrintedBookReading: record } }));
  show([mine(null), { request: { query: SAVE_PRINTED_READING, variables: { bookId: 'book', rating: 4, review: record.review } }, result }]);
  const submit = await screen.findByRole('button', { name: 'Okudum, kitaplığıma ekle' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Puanınız (5 üzerinden)' }), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Kitap hakkındaki yorumunuz (isteğe bağlı)'), { target: { value: record.review } });
  fireEvent.click(submit); fireEvent.click(submit);
  expect(await screen.findByRole('button', { name: 'Değerlendirmeyi güncelle' })).toBeInTheDocument();
  expect(await screen.findByText(/Değerlendirmeniz kaydedildi/)).toBeInTheDocument();
  expect(result).toHaveBeenCalledTimes(1);
});

test('a prior rating and review can be edited without adding a second book', async () => {
  show([mine(record), { request: { query: SAVE_PRINTED_READING, variables: { bookId: 'book', rating: 5, review: '' } }, result: { data: { savePrintedBookReading: { ...record, rating: 5, review: '' } } } }]);
  await screen.findByRole('button', { name: 'Değerlendirmeyi güncelle' });
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('4'));
  expect(screen.getByLabelText('Kitap hakkındaki yorumunuz (isteğe bağlı)')).toHaveValue(record.review);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Kitap hakkındaki yorumunuz (isteğe bağlı)'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Değerlendirmeyi güncelle' }));
  expect(await screen.findByText(/Değerlendirmeniz kaydedildi/)).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('5');
});

test('removing a read record resets the form and permits adding it again', async () => {
  show([mine(record), { request: { query: REMOVE_PRINTED_READING, variables: { bookId: 'book' } }, result: { data: { removePrintedBookReading: true } } }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Okuduklarımdan kaldır' }));
  expect(await screen.findByText('Kitap okuduklarınızdan kaldırıldı.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Okudum, kitaplığıma ekle' })).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('');
});

test('guests see a login link without private queries or editing controls', () => {
  useAuth.mockReturnValue({ user: null }); show([]);
  expect(screen.getByRole('link', { name: /giriş yapın/ })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});

test('an API failure keeps the draft and lets the user retry', async () => {
  show([mine(record), { request: { query: SAVE_PRINTED_READING, variables: { bookId: 'book', rating: 4, review: record.review } }, error: new Error('Kaydedilemedi.') }]);
  await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('4'));
  fireEvent.click(await screen.findByRole('button', { name: 'Değerlendirmeyi güncelle' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Kaydedilemedi.');
  expect(screen.getByLabelText('Kitap hakkındaki yorumunuz (isteğe bağlı)')).toHaveValue(record.review);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Değerlendirmeyi güncelle' })).toBeEnabled());
});

test('a disappeared login prevents saving before a mutation is sent', async () => {
  const ensureSession = jest.fn().mockReturnValue(null);
  useAuth.mockReturnValue({ user: { id: 'reader' }, ensureSession });
  show([mine(record)]);
  fireEvent.click(await screen.findByRole('button', { name: 'Değerlendirmeyi güncelle' }));
  expect(ensureSession).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
