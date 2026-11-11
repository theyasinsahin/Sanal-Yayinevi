import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import { GET_USER_BY_ID, GET_PROFILE_SAVED_BOOKS } from '../../graphql/queries/user';
import { GET_QUOTES_BY_USER } from '../../graphql/queries/quote';
import UserProfile from './index';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useLiveScoreQuery', () => ({ useLiveScoreQuery: () => ({ data: {} }) }));
jest.mock('../../hooks/useMessages', () => ({ useGetOrCreateConversation: () => ({ getOrCreateConversation: jest.fn() }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Books/BookCarousel', () => ({ __esModule: true, default: ({ books = [] }) => <div>{books.map(book => <span key={book.id}>{book.title}</span>)}</div> }));
jest.mock('../../components/Books/PrintedReadingLibrary', () => ({ __esModule: true, default: ({ userId }) => <div>Basılı kitaplık: {userId}</div> }));
jest.mock('../../components/ImageUpload', () => () => null);
jest.mock('../../components/Quote/QuoteCard', () => ({ quote }) => <blockquote>{quote.text}</blockquote>);
jest.mock('../../components/Settings/UserSettings', () => () => null);
jest.mock('../../components/Follow/UserFollowButton', () => () => null);
jest.mock('../../components/Follow/RemoveFollowerButton', () => () => null);
jest.mock('../../components/Sharing/SocialShareButton', () => () => null);
jest.mock('@mui/icons-material', () => Object.fromEntries(['Person', 'Email', 'Link', 'Book', 'Bookmark', 'Edit', 'Save', 'Cancel', 'Close', 'Logout', 'Verified', 'TrendingUp', 'Star', 'Chat', 'Settings', 'FormatQuote', 'Receipt'].map(name => [name, () => null])));

let profile;
beforeEach(() => {
  window.scrollTo = jest.fn();
  profile = { id: 'owner', username: 'owner', fullName: 'Kitap Okuru', canViewProfile: true, canViewLibrary: true, canViewFollowList: true, isSearchIndexable: true, usersBooks: [], savedBooks: [], followers: [], following: [] };
  useAuth.mockReturnValue({ user: { id: 'owner' }, logout: jest.fn() });
  useQuery.mockImplementation((query, options) => {
    if (query === GET_USER_BY_ID) return { data: { getUserById: profile }, loading: false, refetch: jest.fn(), startPolling: jest.fn(), stopPolling: jest.fn() };
    if (query === GET_PROFILE_SAVED_BOOKS) return { data: options?.skip ? undefined : { getUserById: { id: profile?.id, savedBooks: profile?.savedBooks } }, loading: false, refetch: jest.fn() };
    return { data: {} };
  });
  useMutation.mockReturnValue([jest.fn(), { loading: false }]);
});
const show = () => render(<MemoryRouter><Routes><Route path="/" element={<UserProfile resolvedId="owner" />} /><Route path="/login" element={<h1>Login destination</h1>} /></Routes></MemoryRouter>);

test.each(['Sorgu derinlik veya işlem bütçesini aşıyor.', 'Network request failed'])('profile query failure preserves the Google session and offers retry: %s', message => {
  const implementation = useQuery.getMockImplementation(), refetch = jest.fn();
  useQuery.mockImplementation((query, options) => query === GET_USER_BY_ID
    ? { ...implementation(query, options), data: undefined, error: new Error(message), refetch }
    : implementation(query, options));
  show();
  expect(screen.getByRole('alert')).toHaveTextContent('Profil yüklenemedi');
  expect(useAuth().logout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('heading', { name: 'Login destination' })).not.toBeInTheDocument();
});

test('only a successful query confirming a missing own account ends the session', () => {
  profile = null;
  show();
  expect(useAuth().logout).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
});

test('the saved library is requested only when its tab is opened', () => {
  show();
  expect(useQuery).toHaveBeenCalledWith(GET_PROFILE_SAVED_BOOKS, expect.objectContaining({ skip: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Dijital Kitaplık' }));
  expect(useQuery).toHaveBeenCalledWith(GET_PROFILE_SAVED_BOOKS, expect.objectContaining({ variables: { id: 'owner' }, skip: false }));
});

test('profile totals abbreviate followers, following and book interactions consistently', () => {
  profile.followers = new Array(21530);
  profile.following = new Array(1000);
  profile.usersBooks = [{ id: 'large', title: 'Büyük kitap', status: 'WRITING', stats: { views: 999950, likes: 25300 } }];
  show();
  expect(screen.getByText('21,5 B')).toBeInTheDocument();
  expect(screen.getByText('1 B')).toBeInTheDocument();
  expect(screen.getByText('1 Mn')).toBeInTheDocument();
  expect(screen.getByText('25,3 B')).toBeInTheDocument();
  expect(screen.getByTitle('21.530')).toBeInTheDocument();
  expect(screen.getByTitle('999.950')).toBeInTheDocument();
});

test('hidden follow lists never expose counts through tooltips or screen reader text', () => {
  useAuth.mockReturnValue({ user: { id: 'visitor' } });
  profile.canViewFollowList = false;
  profile.followers = new Array(21530);
  profile.following = new Array(25300);
  show();
  expect(screen.getAllByText('Gizli')).toHaveLength(2);
  expect(screen.queryByTitle('21.530')).not.toBeInTheDocument();
  expect(screen.queryByTitle('25.300')).not.toBeInTheDocument();
  expect(screen.queryByText('21.530')).not.toBeInTheDocument();
});

test('a saved-library failure preserves the profile and can be retried separately', () => {
  const implementation = useQuery.getMockImplementation(), refetch = jest.fn();
  useQuery.mockImplementation((query, options) => query === GET_PROFILE_SAVED_BOOKS
    ? { error: options?.skip ? undefined : new Error('Offline'), refetch }
    : implementation(query, options));
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Dijital Kitaplık' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Dijital kitaplık yüklenemedi');
  expect(useAuth().logout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

test('profile owner can open their funding and preorder history from the account actions', () => {
  show();
  expect(screen.getByRole('link', { name: 'Desteklerim' })).toHaveAttribute('href', '/funding-history');
});

test.each([{ id: 'visitor' }, null])('funding history stays private when another person views the profile (%j)', user => {
  useAuth.mockReturnValue({ user });
  show();
  expect(screen.queryByRole('link', { name: 'Desteklerim' })).not.toBeInTheDocument();
});

test.each([true, false])('profile groups quotes by book and limits private groups to owner (%s)', isOwner => {
  if (!isOwner) useAuth.mockReturnValue({ user: { id: 'visitor' } });
  const quotes = [
    { id: 'first', text: 'First public quote', visibility: 'PUBLIC', book: { id: 'one', title: 'Birinci kitap' } },
    { id: 'private', text: 'Personal quote', visibility: 'PRIVATE', book: { id: 'two', title: 'Özel kitap' } },
    { id: 'repost', text: 'Reposted quote', visibility: 'PUBLIC', isRepost: true, originalQuote: { book: { id: 'one', title: 'Birinci kitap' } } },
  ];
  const previous = useQuery.getMockImplementation();
  useQuery.mockImplementation(query => query === GET_QUOTES_BY_USER ? { data: { getQuotesByUser: quotes } } : previous(query));
  show(); fireEvent.click(screen.getByRole('button', { name: /Alıntılar/ }));
  expect(screen.getAllByRole('heading', { name: 'Birinci kitap' })).toHaveLength(1);
  expect(screen.getByText('2 alıntı')).toBeInTheDocument();
  expect(screen.queryAllByText('Personal quote')).toHaveLength(Number(isOwner));
  expect(screen.queryAllByRole('heading', { name: 'Özel kitap' })).toHaveLength(Number(isOwner));
});

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
  expect(useQuery).toHaveBeenCalledWith(GET_PROFILE_SAVED_BOOKS, expect.objectContaining({ skip: true }));
});

test('saved physical books do not appear as read or as saved digital editions', () => {
  profile.savedBooks = [{ id: 'digital', title: 'Kaydedilmiş dijital kitap', kind: 'DIGITAL' }, { id: 'printed', title: 'Sadece kaydedilmiş fiziksel kitap', kind: 'PRINTED' }];
  show(); fireEvent.click(screen.getByRole('button', { name: 'Dijital Kitaplık' }));
  expect(screen.getByText('Kaydedilmiş dijital kitap')).toBeInTheDocument();
  expect(screen.queryByText('Sadece kaydedilmiş fiziksel kitap')).not.toBeInTheDocument();
});
