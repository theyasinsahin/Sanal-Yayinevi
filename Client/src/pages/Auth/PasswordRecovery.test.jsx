import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { FORGOT_PASSWORD_MUTATION, RESET_PASSWORD_MUTATION } from '../../graphql/mutations/user';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
const show = (page, mocks = []) => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={['/reset-password/reset-token']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/reset-password/:token" element={page} /><Route path="/login" element={<h1>Login destination</h1>} /></Routes></MemoryRouter></MockedProvider>);
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const fillReset = (password, confirm = password) => {
  fireEvent.change(screen.getByLabelText(/^Yeni Şifre/), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/^Şifre Tekrar/), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Şifremi Güncelle' }));
};

test('password recovery sends the provided email and replaces the form with confirmation', async () => {
  const sent = jest.fn(() => ({ data: { forgotPassword: { code: 200, message: 'Sent', __typename: 'Status' } } }));
  show(<ForgotPassword />, [{ request: { query: FORGOT_PASSWORD_MUTATION, variables: { email: 'reader@example.test' } }, result: sent }]);
  fireEvent.change(screen.getByLabelText(/^E-Posta Adresi/), { target: { value: 'reader@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }));
  expect(await screen.findByRole('status')).toHaveTextContent('E-postanızı kontrol edin');
  expect(sent).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Giriş sayfasına dön' })).toHaveAttribute('href', '/login');
});

test('password recovery keeps the form usable when the server fails', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  show(<ForgotPassword />, [{ request: { query: FORGOT_PASSWORD_MUTATION, variables: { email: 'reader@example.test' } }, error: new Error('Offline') }]);
  fireEvent.change(screen.getByLabelText(/^E-Posta Adresi/), { target: { value: 'reader@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı gönderilemedi');
  expect(screen.getByRole('textbox')).toHaveValue('reader@example.test');
  expect(screen.getByRole('button', { name: 'Sıfırlama Bağlantısı Gönder' })).toBeEnabled();
});

test.each([['weak', 'weak', 'gereken koşulları sağlamıyor'], ['GoodPass1!', 'OtherPass1!', 'eşleşmiyor']])('reset validates passwords before sending a request: %s', (password, confirm, error) => {
  show(<ResetPassword />);
  fillReset(password, confirm);
  expect(screen.getByRole('alert')).toHaveTextContent(error);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('reset sends the URL token and password, confirms success and redirects to login', async () => {
  jest.useFakeTimers();
  const reset = jest.fn(() => ({ data: { resetPassword: { code: 200, message: 'Updated', __typename: 'Status' } } }));
  show(<ResetPassword />, [{ request: { query: RESET_PASSWORD_MUTATION, variables: { token: 'reset-token', newPassword: 'GoodPass1!' } }, result: reset }]);
  fillReset('GoodPass1!');
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(screen.getByRole('status')).toHaveTextContent('Şifreniz güncellendi');
  expect(reset).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(3000));
  expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
});

test('expired reset tokens show the server error and preserve the form for correction', async () => {
  show(<ResetPassword />, [{ request: { query: RESET_PASSWORD_MUTATION, variables: { token: 'reset-token', newPassword: 'GoodPass1!' } }, error: new Error('Reset token expired') }]);
  fillReset('GoodPass1!');
  expect(await screen.findByRole('alert')).toHaveTextContent('Reset token expired');
  expect(screen.getByRole('button', { name: 'Şifremi Güncelle' })).toBeEnabled();
});
