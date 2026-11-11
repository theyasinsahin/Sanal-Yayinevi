import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import { LOGIN, SEND_REGISTRATION_CODE, REGISTER_AND_LOGIN } from '../../graphql/mutations/user';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

const mockLogin = jest.fn();
let mockUser;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin, user: mockUser }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));
beforeEach(() => { mockLogin.mockReset(); mockUser = null; sessionStorage.clear(); localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());
const show = (element, mocks = [], initial = '/auth') => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth" element={element} /><Route path="/profile" element={<h1>Profile destination</h1>} /><Route path="/login" element={<h1>Login destination</h1>} /><Route path="/book-reader/book" element={<h1>Reader destination</h1>} /></Routes></MemoryRouter></MockedProvider>);
const fields = { fullName: 'Reader Name', username: 'reader', email: 'reader@test.com', password: 'GoodPass1!' };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillRegistration = (password = fields.password) => {
  change(/^Tam Adınız/, fields.fullName); change(/^Kullanıcı Adı/, fields.username); change(/^E-Posta/, fields.email); change(/^Şifre/, password);
  fireEvent.click(screen.getByRole('checkbox'));
};
const codeMock = (code = 200, message = 'Code sent') => ({ request: { query: SEND_REGISTRATION_CODE, variables: { email: fields.email, username: fields.username } }, result: { data: { sendRegistrationCode: { __typename: 'Status', code, message } } } });

test('successful login forwards the server token and public user to the auth context', async () => {
  const user = { __typename: 'User', id: 'reader', username: 'reader', fullName: 'Reader Name', email: fields.email, role: 'USER' };
  show(<Login />, [{ request: { query: LOGIN, variables: { email: fields.email, password: fields.password } }, result: { data: { login: { __typename: 'AuthPayload', token: 'token', user } } } }]);
  change(/^E-Posta/, fields.email); change(/^Şifre/, fields.password);
  fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('token', 'reader', expect.objectContaining({ id: 'reader', username: 'reader' })));
});
test('login failures show a generic hint and never create a session', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  show(<Login />, [{ request: { query: LOGIN, variables: { email: fields.email, password: 'wrong' } }, error: new Error('Bad password details') }]);
  change(/^E-Posta/, fields.email); change(/^Şifre/, 'wrong');
  fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Bilgilerinizi kontrol edin');
  expect(mockLogin).not.toHaveBeenCalled();
});
test('an already signed-in user leaves the login form for their profile', async () => {
  mockUser = { id: 'reader' }; show(<Login />);
  expect(await screen.findByRole('heading', { name: 'Profile destination' })).toBeInTheDocument();
});
test('Google redirect failures are displayed on the login form', () => {
  show(<Login />, [], '/auth?error=google_auth_failed');
  expect(screen.getByRole('alert')).toHaveTextContent('Google ile giriş yapılamadı');
});
test('registration validates password rules before sending an email code', () => {
  show(<Register />); fillRegistration('weak');
  fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Şifreniz gereken koşulları sağlamıyor');
  expect(screen.queryByLabelText(/^Doğrulama Kodu/)).not.toBeInTheDocument();
});
test('a rejected registration code request stays on the account form with the server message', async () => {
  show(<Register />, [codeMock(400, 'Username is taken')]); fillRegistration();
  fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Username is taken');
  expect(screen.getByLabelText(/^Kullanıcı Adı/)).toHaveValue('reader');
});
test('a failed email delivery keeps registration details and permits a successful retry', async () => {
  const message = 'E-posta şu anda gönderilemiyor. Lütfen biraz sonra tekrar deneyin.';
  show(<Register />, [codeMock(400, message), codeMock()]); fillRegistration();
  fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.getByLabelText(/^E-Posta/)).toHaveValue(fields.email);
  fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  expect(await screen.findByLabelText(/^Doğrulama Kodu/)).toHaveAttribute('autocomplete', 'one-time-code');
  expect(screen.getByRole('button', { name: /Kodu yeniden gönder/ })).toBeDisabled();
});
test('registration sends email verification first, then submits account data together with the entered code', async () => {
  const register = jest.fn(() => ({ data: { registerAndLogin: { __typename: 'RegistrationPayload', code: 400, message: 'Verification expired', token: null, user: null } } }));
  show(<Register />, [codeMock(), { request: { query: REGISTER_AND_LOGIN, variables: { ...fields, code: '123456' } }, result: register }]);
  fillRegistration(); fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  const codeInput = await screen.findByLabelText(/^Doğrulama Kodu/);
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kayıt İşlemini Tamamla' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Verification expired');
  expect(register).toHaveBeenCalledTimes(1);
  expect(mockLogin).not.toHaveBeenCalled();
});

test('verified registration logs in immediately and returns to the requested chapter', async () => {
  const user = { __typename: 'User', id: 'new-reader', username: fields.username, fullName: fields.fullName, email: fields.email, role: 'USER' };
  show(<Register />, [codeMock(), {
    request: { query: REGISTER_AND_LOGIN, variables: { ...fields, code: '123456' } },
    result: { data: { registerAndLogin: { __typename: 'RegistrationPayload', code: 200, message: 'Registered', token: 'new-token', user } } },
  }], '/auth?returnTo=%2Fbook-reader%2Fbook%3Fchapter%3Dsecond');
  fillRegistration(); fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  fireEvent.change(await screen.findByLabelText(/^Doğrulama Kodu/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kayıt İşlemini Tamamla' }));
  expect(await screen.findByRole('heading', { name: 'Reader destination' })).toBeInTheDocument();
  expect(mockLogin).toHaveBeenCalledWith('new-token', 'new-reader', expect.objectContaining({ id: 'new-reader' }));
  expect(mockLogin).toHaveBeenCalledTimes(1);
});

test('account creation without a token offers login instead of creating the account again', async () => {
  show(<Register />, [codeMock(), {
    request: { query: REGISTER_AND_LOGIN, variables: { ...fields, code: '123456' } },
    result: { data: { registerAndLogin: { __typename: 'RegistrationPayload', code: 200, message: 'Account created', token: null, user: null } } },
  }]);
  fillRegistration(); fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  fireEvent.change(await screen.findByLabelText(/^Doğrulama Kodu/), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kayıt İşlemini Tamamla' }));
  expect(await screen.findByRole('link', { name: 'Hesabın oluşturuldu — Giriş yaparak devam et' })).toHaveAttribute('href', '/login');
  expect(mockLogin).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Kayıt İşlemini Tamamla' })).toBeDisabled();
});

test('blocked browser storage leaves email registration usable and explains why Google is unavailable', async () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  show(<Register />, [codeMock()], '/auth?returnTo=%2Fbook-reader%2Fbook');
  expect(screen.getByRole('status')).toHaveTextContent('E-posta ile devam edebilirsiniz.');
  fillRegistration(); fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  expect(await screen.findByLabelText(/^Doğrulama Kodu/)).toBeInTheDocument();
});
