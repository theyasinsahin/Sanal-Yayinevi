import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GoogleCallback from './index';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

const mockLogin = jest.fn();
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin }) }));
jest.mock('../../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
beforeEach(() => mockLogin.mockReset());
afterEach(() => jest.restoreAllMocks());
const show = search => render(<React.StrictMode><MemoryRouter initialEntries={[`/auth/callback${search}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth/callback" element={<GoogleCallback />} /><Route path="/profile" element={<h1>Profile</h1>} /><Route path="/login" element={<h1>Login failed</h1>} /></Routes></MemoryRouter></React.StrictMode>);

test('Google callback logs in once in StrictMode and leaves the credential URL', async () => {
  const user = { id: 'reader', username: 'a+b', fullName: 'Türkçe İsim' };
  show(`?token=credential&user=${encodeURIComponent(JSON.stringify(user))}`);
  expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
  expect(mockLogin).toHaveBeenCalledTimes(1);
  expect(mockLogin).toHaveBeenCalledWith('credential', 'reader', user);
});
test.each(['', '?token=credential', '?user=%7B%7D', '?token=credential&user=bad-json'])('missing or malformed callback credentials return to login: %s', async query => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  show(query);
  expect(await screen.findByRole('heading', { name: 'Login failed' })).toBeInTheDocument();
  expect(mockLogin).not.toHaveBeenCalled();
});
test('failed session creation also returns to login', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockLogin.mockImplementation(() => { throw new Error('Session rejected'); });
  show(`?token=credential&user=${encodeURIComponent(JSON.stringify({ id: 'u' }))}`);
  expect(await screen.findByRole('heading', { name: 'Login failed' })).toBeInTheDocument();
});
