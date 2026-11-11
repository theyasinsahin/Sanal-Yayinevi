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
  expect(screen.getByRole('link', { name: /Review Decision/ })).toHaveAttribute('href', path);
  fireEvent.click(screen.getByRole('link', { name: /Review Decision/ }));
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'false');
});

test.each([
  ['COMMENT_MENTION', { bookId: 'book', commentId: 'comment' }, '/book-detail/book#comment-comment'],
  ['PARAGRAPH_MENTION', { bookId: 'book', chapterId: 'chapter', paragraphIndex: 0, commentId: 'comment' }, '/book-reader/book?chapter=chapter&paragraph=0#paragraph-comment-comment'],
  ['QUOTE_MENTION', { quoteId: 'quote', commentId: 'comment' }, '/quotes/quote#quote-comment-comment'],
  ['QUOTE_MENTION', { quoteId: 'quote' }, '/quotes/quote'],
  ['SESSION_MENTION', { sessionId: 'session', entryId: 'entry' }, '/sessions/session#entry-entry'],
  ['SESSION_REPLY', { sessionId: 'session', entryId: 'entry' }, '/sessions/session#entry-entry'],
  ['COMMENT_RECEIVED', { bookId: 'book', commentId: 'comment' }, '/book-detail/book#comment-comment'],
  ['NEW_CHAPTER', { bookId: 'book', chapterId: 'chapter' }, '/book-reader/book?chapter=chapter'],
  ['BOOK_LIKED', { bookId: 'book' }, '/book-detail/book'],
  ['COMMENT_RECEIVED', { bookId: 'book' }, '/book-detail/book#comments'],
  ['QUOTE_LIKED', { quoteId: 'quote' }, '/quotes/quote'],
  ['SESSION_REPLY', { sessionId: 'session' }, '/sessions/session'],
  ['SESSION_MENTION', { sessionId: 'session' }, '/sessions/session'],
  ['NEW_FOLLOWER', { userId: 'follower' }, '/user/follower'],
  ['FOLLOW_REQUEST_ACCEPTED', { userId: 'writer' }, '/user/writer'],
  ['BADGE_EARNED', {}, '/profile'],
  ['PRINT_UPDATE', { bookId: 'book', authorId: 'reader' }, '/print/book'],
  ['PRINT_UPDATE', { bookId: 'book', authorId: 'writer' }, '/book-detail/book'],
])('%s uses the complete notification as a link to its target', (type, meta, path) => {
  mockNotifications = [{ id: 'n', type, meta, title: 'Haber', message: 'Ayrıntı', createdAt: String(Date.now()) }];
  show(); fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(screen.getByRole('link', { name: /Haber Ayrıntı/ })).toHaveAttribute('href', path);
  fireEvent.click(screen.getByText('Haber'));
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'false');
});

test.each(['POINTS_EARNED', 'UNKNOWN'])('%s remains informational even when it has content metadata', type => {
  mockNotifications = [{ id: 'n', type, meta: { bookId: 'book', sessionId: 'session' }, title: 'Puan', message: '+5', createdAt: String(Date.now()) }];
  show(); fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Puan'));
  expect(screen.getByRole('button', { name: 'Bildirimler' })).toHaveAttribute('aria-expanded', 'true');
});
