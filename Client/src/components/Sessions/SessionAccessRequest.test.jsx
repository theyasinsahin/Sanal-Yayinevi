import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { useAuth } from '../../context/AuthContext';
import useSessionCreationAccess from '../../hooks/useSessionCreationAccess';
import SessionAccessRequest from './SessionAccessRequest';
import { MY_SESSION_ACCESS, REQUEST_SESSION_ACCESS } from '../../graphql/sessionAccess';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
const user = { __typename: 'User', id: 'member', fullName: 'Üye', username: 'member', email: 'member@example.test' };
const access = (status = 'NONE', extra = {}) => ({ __typename: 'SessionCreationAccess', user, status, reason: '', requestedAt: null, reviewedAt: null, reviewNote: '', revision: 0, ...extra });
const state = value => ({ request: { query: MY_SESSION_ACCESS }, result: { data: { mySessionCreationAccess: value } } });
function Panel() {
  const { user: currentUser } = useAuth();
  const result = useSessionCreationAccess();
  return result.access?.status === 'APPROVED' ? <button>Oturum Aç</button> : <SessionAccessRequest user={currentUser} {...result} />;
}
const show = mocks => render(<MockedProvider mocks={mocks}><MemoryRouter><Panel /></MemoryRouter></MockedProvider>);
beforeEach(() => useAuth.mockReturnValue({ user }));

test('free permission request is submitted once and immediately becomes pending', async () => {
  const reason = 'Haftalık edebiyat sohbetleri düzenlemek istiyorum.';
  const result = jest.fn(() => ({ data: { requestSessionCreationAccess: access('PENDING', { reason, revision: 1 }) } }));
  show([state(access()), { request: { query: REQUEST_SESSION_ACCESS, variables: { reason } }, result }]);
  fireEvent.change(await screen.findByLabelText(/Nasıl oturumlar düzenlemek istiyorsunuz/), { target: { value: reason } });
  const form = screen.getByRole('form', { name: 'Oturum oluşturma izni başvurusu' });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(await screen.findByText('Oturum açma başvurunuz yönetici onayını bekliyor.')).toBeInTheDocument();
  expect(result).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Oturum açma izni iste' })).not.toBeInTheDocument();
});

test('approval and revocation arrive without another login', async () => {
  show([state(access('PENDING')), state(access('APPROVED')), state(access('REJECTED', { reviewNote: 'İzin geçici olarak kaldırıldı.' }))]);
  fireEvent.click(await screen.findByRole('button', { name: 'Durumu yenile' }));
  expect(await screen.findByRole('button', { name: 'Oturum Aç' })).toBeInTheDocument();
  fireEvent.focus(window);
  expect(await screen.findByText(/İzin geçici olarak kaldırıldı/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Oturum Aç' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Yeniden izin iste' })).toBeInTheDocument();
});

test('rejected applicants can submit a revised explanation', async () => {
  const reason = 'Başvurumu daha detaylı bir etkinlik planıyla yeniliyorum.';
  show([state(access('REJECTED', { reviewNote: 'Detaylandırın.' })), { request: { query: REQUEST_SESSION_ACCESS, variables: { reason } }, result: { data: { requestSessionCreationAccess: access('PENDING', { reason, revision: 3 }) } } }]);
  fireEvent.change(await screen.findByLabelText(/Nasıl oturumlar düzenlemek istiyorsunuz/), { target: { value: reason } });
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden izin iste' }));
  expect(await screen.findByText(/başvurunuz yönetici onayını bekliyor/)).toBeInTheDocument();
});

test('guests are directed to login and do not request private permission data', () => {
  useAuth.mockReturnValue({ user: null }); show([]);
  expect(screen.getByRole('link', { name: 'Başvurmak için giriş yapın' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('button', { name: 'Oturum açma izni iste' })).not.toBeInTheDocument();
});

test('request errors preserve the explanation and permit retry', async () => {
  const reason = 'Düzenli kitap değerlendirme oturumları yapmak istiyorum.';
  show([state(access()), { request: { query: REQUEST_SESSION_ACCESS, variables: { reason } }, error: new Error('Bağlantı kurulamadı.') }]);
  const field = await screen.findByLabelText(/Nasıl oturumlar düzenlemek istiyorsunuz/);
  fireEvent.change(field, { target: { value: reason } }); fireEvent.click(screen.getByRole('button', { name: 'Oturum açma izni iste' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı kurulamadı.');
  expect(field).toHaveValue(reason);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Oturum açma izni iste' })).toBeEnabled());
});

test('permission lookup failures provide a retry without creation controls', async () => {
  show([{ request: { query: MY_SESSION_ACCESS }, error: new Error('Geçici hata') }, state(access('APPROVED'))]);
  expect(await screen.findByRole('alert')).toHaveTextContent('Geçici hata');
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
  expect(await screen.findByRole('button', { name: 'Oturum Aç' })).toBeInTheDocument();
});
