import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ApolloError, useApolloClient } from '@apollo/client';
import { AuthProvider, useAuth } from './index';
import { clearSession } from '../../utils/authSession';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useApolloClient: jest.fn() }));

const token = (seconds = 3600, id = 'reader') => `e30.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, userId: id }))}.signature`;
function store(value = token(), id = 'reader') {
  localStorage.setItem('token', value);
  localStorage.setItem('userId', id);
  localStorage.setItem('user', JSON.stringify({ id, role: 'USER' }));
  return value;
}
function Probe() {
  const { user, loading, login, ensureSession } = useAuth();
  return <><span>{loading ? 'checking' : user?.id || 'guest'}</span>
    {user && <button>Kitap oluştur</button>}
    <button onClick={() => login(token(3600, 'other'), 'other')}>login other</button>
    <button onClick={() => ensureSession()}>check action</button></>;
}
let client;
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
const show = () => render(<AuthProvider><Probe /></AuthProvider>);

beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  client = { query: jest.fn().mockResolvedValue({ data: { me: { id: 'reader' } } }), clearStore: jest.fn().mockResolvedValue() };
  useApolloClient.mockReturnValue(client);
});
afterEach(() => { jest.useRealTimers(); });

test('restored credentials are verified before authenticated controls appear', async () => {
  store(); let resolve;
  client.query.mockImplementation(() => new Promise(done => { resolve = done; }));
  show();
  expect(screen.getByText('checking')).toBeInTheDocument();
  expect(screen.queryByText('Kitap oluştur')).not.toBeInTheDocument();
  await act(async () => resolve({ data: { me: { id: 'reader' } } }));
  expect(screen.getByText('Kitap oluştur')).toBeInTheDocument();
  expect(client.query).toHaveBeenCalledWith(expect.objectContaining({ fetchPolicy: 'no-cache' }));
});

test.each(['expired', 'malformed', 'missing', 'broken user'])('invalid stored session: %s', async kind => {
  store(kind === 'expired' ? token(-1) : kind === 'malformed' ? 'broken' : token());
  if (kind === 'missing') localStorage.removeItem('token');
  if (kind === 'broken user') localStorage.setItem('user', '{');
  show(); await flush();
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(client.query).not.toHaveBeenCalled();
  expect(localStorage.getItem('user')).toBeNull();
});

test('same-tab token removal updates the idle screen and clears private cache', async () => {
  store(); show(); await flush();
  localStorage.removeItem('token');
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(screen.queryByText('Kitap oluştur')).not.toBeInTheDocument();
  expect(client.clearStore).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('userId')).toBeNull();
});

test('expiry logs out without waiting for an API error', async () => {
  store(token(2)); show(); await flush();
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBeNull();
});

test.each(['storage', 'focus', 'visibilitychange', 'pointerdown', 'keydown'])('%s notices credentials removed outside React', async event => {
  store(); show(); await flush(); localStorage.clear();
  act(() => (['visibilitychange', 'pointerdown', 'keydown'].includes(event) ? document : window).dispatchEvent(event === 'storage' ? new StorageEvent('storage', { key: null }) : new Event(event)));
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(client.clearStore).toHaveBeenCalledTimes(1);
});

test('server rejection on returning to the app clears the session', async () => {
  store(); show(); await flush();
  client.query.mockRejectedValue(new ApolloError({ graphQLErrors: [{ message: 'Login required', extensions: { code: 'UNAUTHENTICATED' } }] }));
  fireEvent.focus(window); await flush();
  expect(screen.getByText('guest')).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBeNull();
});

test('temporary network errors preserve a previously verified login', async () => {
  const value = store(); show(); await flush();
  client.query.mockRejectedValue(new ApolloError({ networkError: new Error('offline') }));
  fireEvent.focus(window); await flush();
  expect(screen.getByText('reader')).toBeInTheDocument();
  expect(localStorage.getItem('token')).toBe(value);
});

test('an unavailable server does not cause validation on every local check', async () => {
  const value = store();
  client.query.mockRejectedValue(new ApolloError({ networkError: new Error('offline') }));
  show(); await flush();
  act(() => jest.advanceTimersByTime(10000)); await flush();
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBe(value);
});

test('a delayed validation cannot restore a session after logout', async () => {
  store(); let resolve;
  client.query.mockImplementation(() => new Promise(done => { resolve = done; }));
  show(); act(() => clearSession());
  await act(async () => resolve({ data: { me: { id: 'reader' } } }));
  expect(screen.getByText('guest')).toBeInTheDocument();
});

test('switching accounts in another tab immediately hides the previous account', async () => {
  store(); show(); await flush(); let resolve;
  client.query.mockImplementation(() => new Promise(done => { resolve = done; }));
  store(token(3600, 'other'), 'other');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token' })));
  expect(screen.queryByText('reader')).not.toBeInTheDocument();
  expect(screen.queryByText('Kitap oluştur')).not.toBeInTheDocument();
  await act(async () => resolve({ data: { me: { id: 'other' } } }));
  expect(screen.getByText('other')).toBeInTheDocument();
});
