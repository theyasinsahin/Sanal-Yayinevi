import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import AdminSessionAccess from './index';
import { SESSION_ACCESS_REQUESTS, REVIEW_SESSION_ACCESS } from '../../../graphql/sessionAccess';

jest.mock('../../../components/Admin/AdminLayout', () => ({ __esModule: true, default: ({ children }) => <main>{children}</main> }));
const item = { __typename: 'SessionCreationAccess', user: { __typename: 'User', id: 'member', username: 'member', fullName: 'Başvuran Üye', email: 'member@example.test' }, status: 'PENDING', reason: 'Haftalık edebiyat buluşmaları düzenlemek istiyorum.', requestedAt: '2026-10-26T09:00:00Z', reviewedAt: null, reviewNote: '', revision: 1 };
const list = (items = [item], status = 'PENDING') => ({ request: { query: SESSION_ACCESS_REQUESTS, variables: { status, page: 1 } }, result: { data: { sessionAccessRequests: { items, total: items.length, page: 1, totalPages: items.length ? 1 : 0 } } } });
const mutation = (approve, note, status = approve ? 'APPROVED' : 'REJECTED') => ({ request: { query: REVIEW_SESSION_ACCESS, variables: { userId: item.user.id, revision: item.revision, approve, note } }, result: { data: { reviewSessionCreationAccess: { ...item, status, reviewNote: note, revision: 2 } } } });
const show = mocks => render(<MockedProvider mocks={mocks}><AdminSessionAccess /></MockedProvider>);

test('admin sees the applicant and approves the request without premium membership controls', async () => {
  const result = jest.fn(() => mutation(true, '').result);
  show([list(), { ...mutation(true, ''), result }, list([])]);
  expect(await screen.findByText(item.reason)).toBeInTheDocument();
  expect(screen.getByText(item.user.email)).toBeInTheDocument();
  const approve = screen.getByRole('button', { name: 'Onayla' });
  fireEvent.click(approve); fireEvent.click(approve);
  expect(await screen.findByText('Bu durumda başvuru yok.')).toBeInTheDocument();
  expect(result).toHaveBeenCalledTimes(1);
});

test('rejection requires a reason and sends the current revision', async () => {
  const note = 'Etkinlik planını detaylandırın.';
  show([list(), mutation(false, note), list([])]);
  fireEvent.click(await screen.findByRole('button', { name: 'Reddet' }));
  expect(screen.getByRole('alert')).toHaveTextContent('en az 5 karakterlik');
  fireEvent.change(screen.getByLabelText('Karar notu / Ret veya izin kaldırma gerekçesi'), { target: { value: note } });
  fireEvent.click(screen.getByRole('button', { name: 'Reddet' }));
  expect(await screen.findByText('Bu durumda başvuru yok.')).toBeInTheDocument();
});

test('approved users are filterable and their permission can be revoked', async () => {
  const note = 'İzin geçici olarak kaldırıldı.';
  show([list([]), list([{ ...item, status: 'APPROVED' }], 'APPROVED'), mutation(false, note), list([], 'APPROVED')]);
  await screen.findByText('Bu durumda başvuru yok.');
  fireEvent.change(screen.getByRole('combobox', { name: 'Başvuru durumu' }), { target: { value: 'APPROVED' } });
  expect(await screen.findByRole('button', { name: 'İzni kaldır' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Karar notu / Ret veya izin kaldırma gerekçesi'), { target: { value: note } });
  fireEvent.click(screen.getByRole('button', { name: 'İzni kaldır' }));
  expect(await screen.findByText('Bu durumda başvuru yok.')).toBeInTheDocument();
});

test('a stale review reports the conflict instead of claiming success', async () => {
  show([list(), { request: mutation(true, '').request, error: new Error('Başvuru değişmiş. Listeyi yenileyin.') }]);
  fireEvent.click(await screen.findByRole('button', { name: 'Onayla' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Başvuru değişmiş');
  expect(screen.queryByText('Karar kaydedildi.')).not.toBeInTheDocument();
});
