import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useApolloClient } from '@apollo/client';
import { AuthProvider } from '../../../context/AuthContext';
import NavigationBar from './index';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useApolloClient: jest.fn() }));
jest.mock('../../../hooks/useMessages', () => ({ useUnreadMessageCount: () => 0 }));
jest.mock('../../Notification/NotificationBell', () => () => null);
jest.mock('@mui/icons-material', () => Object.fromEntries([
  'Menu', 'Close', 'Person', 'Explore', 'Create', 'Login', 'Logout',
  'AppRegistration', 'FormatQuote', 'EmojiEvents', 'Forum', 'MenuBook',
].map(name => [name, () => null])));

let client;
function store(seconds = 3600) {
  const token = `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds }))}.signature`;
  localStorage.setItem('token', token);
  localStorage.setItem('userId', 'reader');
  localStorage.setItem('user', JSON.stringify({ id: 'reader' }));
}
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const show = () => render(<MemoryRouter><AuthProvider><NavigationBar /></AuthProvider></MemoryRouter>);

beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  client = { query: jest.fn().mockResolvedValue({ data: { me: { id: 'reader' } } }), clearStore: jest.fn().mockResolvedValue() };
  useApolloClient.mockReturnValue(client);
});
afterEach(() => { jest.useRealTimers(); });

test('guests see login links and cannot see desktop or mobile creation controls', async () => {
  show(); await flush();
  expect(screen.getAllByRole('link', { name: 'Giriş Yap' }).length).toBeGreaterThan(0);
  expect(screen.queryAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(0);
  expect(screen.queryAllByRole('link', { name: 'Mesajlar' })).toHaveLength(0);
});

test('funding history is absent from both desktop and mobile navigation for signed-in readers', async () => {
  store(); show(); await flush();
  expect(screen.getAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(2);
  expect(screen.queryAllByRole('link', { name: /Desteklerim/ })).toHaveLength(0);
});

test('removing credentials updates both real navigation menus without a page reload', async () => {
  store(); show(); await flush();
  expect(screen.getAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(2);
  localStorage.removeItem('token');
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.queryAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(0);
  expect(screen.queryAllByRole('link', { name: 'Mesajlar' })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Çıkış Yap' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'Giriş Yap' })).toHaveLength(2);
  expect(client.clearStore).toHaveBeenCalledTimes(1);
});

test('token expiry removes authenticated navigation while the current screen remains open', async () => {
  store(2); show(); await flush();
  expect(screen.getAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(2);
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.queryAllByRole('link', { name: 'Kitap Oluştur' })).toHaveLength(0);
  expect(screen.getAllByRole('link', { name: 'Giriş Yap' })).toHaveLength(2);
});
