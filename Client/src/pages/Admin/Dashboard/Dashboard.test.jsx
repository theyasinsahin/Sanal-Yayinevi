import React from 'react';
import { render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import Overview from './index';
import { GET_ADMIN_OVERVIEW } from '../../../graphql/admin';
jest.mock('../../../components/Admin/AdminLayout', () => ({ __esModule: true, default: ({ children }) => <main>{children}</main> }));

test('dashboard shows real aggregate counts, review queues and separately formatted currencies', async () => {
  render(<MockedProvider addTypename={false} mocks={[{ request: { query: GET_ADMIN_OVERVIEW }, result: { data: { getAdminOverview: {
    counts: [{ resource: 'Book', label: 'Kitaplar', total: 45, active: 40 }], pendingBooks: 3, pendingClaims: 2, pendingSessionAccess: 4,
    revenue: [{ currency: 'TRY', amount: 100, count: 1 }, { currency: 'USD', amount: 20, count: 1 }], recent: [],
  } } } }]}><MemoryRouter><Overview /></MemoryRouter></MockedProvider>);
  expect(await screen.findByText('45')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /3 basılı kitap başvurusu/ })).toHaveAttribute('href', '/admin/printed-books');
  expect(screen.getByRole('link', { name: /4 oturum oluşturma izni/ })).toHaveAttribute('href', '/admin/session-access');
  expect(screen.getByText(/₺100,00/)).toBeInTheDocument();
  expect(screen.getByText(/\$20,00/)).toBeInTheDocument();
  expect(screen.queryByText(/Grafik Alanı/)).not.toBeInTheDocument();
});
