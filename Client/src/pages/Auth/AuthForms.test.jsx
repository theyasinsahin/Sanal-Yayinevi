import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import { LOGIN, SEND_REGISTRATION_CODE, REGISTER } from '../../graphql/mutations/user';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

const mockLogin = jest.fn();
let mockUser;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ login: mockLogin, user: mockUser }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));
beforeEach(() => { mockLogin.mockReset(); mockUser = null; });
afterEach(() => jest.restoreAllMocks());
const show = (element, mocks = [], initial = '/auth') => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={[initial]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/auth" element={element} /><Route path="/profile" element={<h1>Profile destination</h1>} /><Route path="/login" element={<h1>Login destination</h1>} /></Routes></MemoryRouter></MockedProvider>);
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
test('registration sends email verification first, then submits account data together with the entered code', async () => {
  const register = jest.fn(() => ({ data: { register: { __typename: 'Status', code: 400, message: 'Verification expired' } } }));
  show(<Register />, [codeMock(), { request: { query: REGISTER, variables: { ...fields, code: '123456' } }, result: register }]);
  fillRegistration(); fireEvent.click(screen.getByRole('button', { name: 'Doğrulama Kodu Gönder' }));
  const codeInput = await screen.findByLabelText(/^Doğrulama Kodu/);
  fireEvent.change(codeInput, { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kayıt İşlemini Tamamla' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Verification expired');
  expect(register).toHaveBeenCalledTimes(1);
  expect(mockLogin).not.toHaveBeenCalled();
});
