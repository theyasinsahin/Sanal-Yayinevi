import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import UserProfile from './index';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useLiveScoreQuery', () => ({ useLiveScoreQuery: () => ({ data: {} }) }));
jest.mock('../../hooks/useMessages', () => ({ useGetOrCreateConversation: () => ({ getOrCreateConversation: jest.fn() }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Books/BookCarousel', () => ({ __esModule: true, default: ({ books = [] }) => <div>{books.map(book => <span key={book.id}>{book.title}</span>)}</div> }));
jest.mock('../../components/Books/PrintedReadingLibrary', () => ({ __esModule: true, default: ({ userId }) => <div>Basılı kitaplık: {userId}</div> }));
jest.mock('../../components/ImageUpload', () => () => null);
jest.mock('../../components/Quote/QuoteCard', () => () => null);
jest.mock('../../components/Settings/UserSettings', () => () => null);
jest.mock('../../components/Follow/UserFollowButton', () => () => null);
jest.mock('../../components/Follow/RemoveFollowerButton', () => () => null);
jest.mock('../../components/Sharing/SocialShareButton', () => () => null);
jest.mock('@mui/icons-material', () => Object.fromEntries(['Person', 'Email', 'Link', 'Book', 'Bookmark', 'Edit', 'Save', 'Cancel', 'Close', 'Logout', 'Verified', 'TrendingUp', 'Star', 'Chat', 'Settings', 'FormatQuote'].map(name => [name, () => null])));

let profile;
beforeEach(() => {
  window.scrollTo = jest.fn();
  profile = { id: 'owner', username: 'owner', fullName: 'Kitap Okuru', canViewProfile: true, canViewLibrary: true, canViewFollowList: true, isSearchIndexable: true, usersBooks: [], savedBooks: [], followers: [], following: [] };
  useAuth.mockReturnValue({ user: { id: 'owner' }, logout: jest.fn() });
  useQuery.mockImplementation(query => query === GET_USER_BY_ID ? { data: { getUserById: profile }, loading: false, refetch: jest.fn(), startPolling: jest.fn(), stopPolling: jest.fn() } : { data: {} });
  useMutation.mockReturnValue([jest.fn(), { loading: false }]);
});
const show = () => render(<MemoryRouter><UserProfile resolvedId="owner" /></MemoryRouter>);

test('profile exposes a separate tab that loads the target users printed library', () => {
  show();
  expect(screen.queryByText('Basılı kitaplık: owner')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Okuduğum Basılı Kitaplar' }));
  expect(screen.getByText('Basılı kitaplık: owner')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dijital Kitaplık' })).toBeInTheDocument();
});

test('a hidden library does not expose either library tab to visitors', () => {
  useAuth.mockReturnValue({ user: { id: 'visitor' } }); profile.canViewLibrary = false;
  show();
  expect(screen.queryByRole('button', { name: 'Okuduğum Basılı Kitaplar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dijital Kitaplık' })).not.toBeInTheDocument();
});

test('saved physical books do not appear as read or as saved digital editions', () => {
  profile.savedBooks = [{ id: 'digital', title: 'Kaydedilmiş dijital kitap', kind: 'DIGITAL' }, { id: 'printed', title: 'Sadece kaydedilmiş fiziksel kitap', kind: 'PRINTED' }];
  show(); fireEvent.click(screen.getByRole('button', { name: 'Dijital Kitaplık' }));
  expect(screen.getByText('Kaydedilmiş dijital kitap')).toBeInTheDocument();
  expect(screen.queryByText('Sadece kaydedilmiş fiziksel kitap')).not.toBeInTheDocument();
});
