import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PublisherRoute from './PublisherRoute';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
const tree = () => <MemoryRouter initialEntries={['/publisher']}><Routes>
  <Route path="/" element={<p>Ana sayfa</p>} />
  <Route path="/login" element={<p>Giriş ekranı</p>} />
  <Route path="/publisher" element={<PublisherRoute><p>Portal içeriği</p></PublisherRoute>} />
</Routes></MemoryRouter>;

test('session verification hides privileged content', () => {
  useAuth.mockReturnValue({ user: { role: 'PUBLISHER' }, loading: true }); render(tree());
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText('Portal içeriği')).not.toBeInTheDocument();
});
test.each([[null, 'Giriş ekranı'], [{ role: 'USER' }, 'Ana sayfa']])('unauthorized user %j is redirected', async (user, destination) => {
  useAuth.mockReturnValue({ user, loading: false }); render(tree());
  expect(await screen.findByText(destination)).toBeInTheDocument();
  expect(screen.queryByText('Portal içeriği')).not.toBeInTheDocument();
});
test.each(['PUBLISHER', 'ADMIN'])('%s can open the portal', role => {
  useAuth.mockReturnValue({ user: { role }, loading: false }); render(tree());
  expect(screen.getByText('Portal içeriği')).toBeInTheDocument();
});
test('losing the role removes an already open portal', async () => {
  useAuth.mockReturnValue({ user: { role: 'PUBLISHER' }, loading: false });
  const view = render(tree());
  useAuth.mockReturnValue({ user: { role: 'USER' }, loading: false }); view.rerender(tree());
  expect(await screen.findByText('Ana sayfa')).toBeInTheDocument();
  expect(screen.queryByText('Portal içeriği')).not.toBeInTheDocument();
});
