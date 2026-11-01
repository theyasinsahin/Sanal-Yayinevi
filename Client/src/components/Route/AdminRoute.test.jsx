import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminRoute from './AdminRoute';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));

const tree = () => <MemoryRouter initialEntries={['/admin']}><Routes>
  <Route path="/" element={<p>Herkese açık ana sayfa</p>} />
  <Route path="/admin" element={<AdminRoute><p>Yönetici içeriği</p></AdminRoute>} />
</Routes></MemoryRouter>;

test('admin content remains hidden while the session is being checked', () => {
  useAuth.mockReturnValue({ user: { role: 'ADMIN' }, loading: true });
  render(tree());
  expect(screen.getByText('Kontrol ediliyor...')).toBeInTheDocument();
  expect(screen.queryByText('Yönetici içeriği')).not.toBeInTheDocument();
  expect(screen.queryByText('Herkese açık ana sayfa')).not.toBeInTheDocument();
});

test.each([null, { id: 'reader', role: 'USER' }, { id: 'publisher', role: 'PUBLISHER' }])('guests and non-admin users cannot enter the admin route: %j', async user => {
  useAuth.mockReturnValue({ user, loading: false }); render(tree());
  expect(await screen.findByText('Herkese açık ana sayfa')).toBeInTheDocument();
  expect(screen.queryByText('Yönetici içeriği')).not.toBeInTheDocument();
});

test('an authenticated admin can enter the route', () => {
  useAuth.mockReturnValue({ user: { id: 'admin', role: 'ADMIN' }, loading: false }); render(tree());
  expect(screen.getByText('Yönetici içeriği')).toBeInTheDocument();
});

test.each([null, { id: 'admin', role: 'USER' }])('losing the login or admin role removes an already open admin page: %j', async nextUser => {
  useAuth.mockReturnValue({ user: { id: 'admin', role: 'ADMIN' }, loading: false });
  const view = render(tree());
  expect(screen.getByText('Yönetici içeriği')).toBeInTheDocument();
  useAuth.mockReturnValue({ user: nextUser, loading: false }); view.rerender(tree());
  expect(await screen.findByText('Herkese açık ana sayfa')).toBeInTheDocument();
  expect(screen.queryByText('Yönetici içeriği')).not.toBeInTheDocument();
});
