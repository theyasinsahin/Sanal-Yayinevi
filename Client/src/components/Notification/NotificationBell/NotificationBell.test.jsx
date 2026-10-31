import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import NotificationBell from './index';
import { MARK_NOTIFICATIONS_READ } from '../../../graphql/mutations/score';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

let mockUser, mockCount, mockNotifications;
const mockRefetch = jest.fn();
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../hooks/useLiveScoreQuery', () => ({ useLiveScoreQuery: query => ({ data: query.definitions.some(d => d.name?.value === 'GetUnreadNotificationCount') ? { getUnreadNotificationCount: mockCount } : { getNotifications: mockNotifications }, refetch: mockRefetch }) }));
jest.mock('../../Follow/FollowRequests', () => () => <div>Follow requests inbox</div>);
beforeEach(() => { mockUser = { id: 'reader' }; mockCount = 0; mockNotifications = []; mockRefetch.mockReset().mockResolvedValue({}); });
const show = mocks => render(<MockedProvider mocks={mocks || []}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><NotificationBell /></MemoryRouter></MockedProvider>);

test('guests have no notification control', () => {
  mockUser = null; show();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
test('opening an empty inbox exposes follow requests and closes when the overlay is clicked', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(screen.getByText('Follow requests inbox')).toBeInTheDocument();
  expect(screen.getByText('Diğer bildirim yok.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'true');
  // Inspect structural markup that has no independent accessible control.
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.click(document.querySelector('.notif-overlay'));
  expect(screen.queryByText('Diğer bildirim yok.')).not.toBeInTheDocument();
});
test('unread badges cap at 99+ and opening marks notifications read then refreshes both queries', async () => {
  mockCount = 120;
  const mark = jest.fn(() => ({ data: { markNotificationsRead: true } }));
  show([{ request: { query: MARK_NOTIFICATIONS_READ }, result: mark }]);
  expect(screen.getByText('99+')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(2));
  expect(mark).toHaveBeenCalledTimes(1);
});
test('an unavailable mark-read service does not close or erase the inbox', async () => {
  mockCount = 1;
  mockNotifications = [{ id: 'n', title: 'Notice', message: 'Message', icon: '', createdAt: String(Date.now()), isRead: false }];
  show([{ request: { query: MARK_NOTIFICATIONS_READ }, error: new Error('Offline') }]);
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(await screen.findByText('Notice')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'true');
});
test.each([['USER', '/book-detail/book'], ['ADMIN', '/admin/printed-books']])('review notifications navigate appropriately for %s', (role, path) => {
  mockUser.role = role;
  mockNotifications = [{ id: 'n', type: 'BOOK_REVIEW', title: 'Review', message: 'Decision', createdAt: String(Date.now()), isRead: true, meta: { bookId: 'book' } }];
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(screen.getByRole('link', { name: 'Başvuruyu görüntüle' })).toHaveAttribute('href', path);
  fireEvent.click(screen.getByRole('link', { name: 'Başvuruyu görüntüle' }));
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'false');
});
