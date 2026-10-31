import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import DangerZone from './index';
import { DELETE_ACCOUNT_MUTATION, DEACTIVATE_ACCOUNT_MUTATION } from '../../../graphql/mutations/user';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

const mockLogout = jest.fn(), toast = jest.fn();
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ logout: mockLogout }) }));
beforeEach(() => { mockLogout.mockReset(); toast.mockReset(); });
const show = mocks => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={['/settings']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/settings" element={<DangerZone profile={{ id: 'reader' }} showToast={toast} />} /><Route path="/" element={<h1>Home destination</h1>} /><Route path="/login" element={<h1>Login destination</h1>} /></Routes></MemoryRouter></MockedProvider>);
const openDelete = () => fireEvent.click(screen.getByRole('button', { name: 'Hesabı Sil' }));

test('permanent deletion requires an explicit Turkish confirmation phrase and cancel clears it', () => {
  show([]); openDelete();
  expect(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('hesabımı sil'), { target: { value: 'wrong' } });
  expect(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('hesabımı sil'), { target: { value: '  HESABIMI SİL  ' } });
  expect(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));
  openDelete();
  expect(screen.getByPlaceholderText('hesabımı sil')).toHaveValue('');
  expect(mockLogout).not.toHaveBeenCalled();
});
test('confirmed deletion logs out only after successful server completion', async () => {
  const remove = jest.fn(() => ({ data: { deleteAccount: { __typename: 'Status', code: 200, message: 'Deleted' } } }));
  show([{ request: { query: DELETE_ACCOUNT_MUTATION }, result: remove }]);
  openDelete(); fireEvent.change(screen.getByPlaceholderText('hesabımı sil'), { target: { value: 'hesabımı sil' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' }));
  expect(await screen.findByRole('heading', { name: 'Home destination' })).toBeInTheDocument();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
test('failed permanent deletion preserves the login and shows feedback for retry', async () => {
  show([{ request: { query: DELETE_ACCOUNT_MUTATION }, error: new Error('Account operation failed') }]);
  openDelete(); fireEvent.change(screen.getByPlaceholderText('hesabımı sil'), { target: { value: 'hesabımı sil' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' }));
  await waitFor(() => expect(toast).toHaveBeenCalledWith('Account operation failed', 'error'));
  expect(mockLogout).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Kalıcı Olarak Sil' })).toBeEnabled();
});
test('deactivation requires confirmation then ends the session and returns to login', async () => {
  show([{ request: { query: DEACTIVATE_ACCOUNT_MUTATION }, result: { data: { deactivateAccount: { __typename: 'Status', code: 200, message: 'Deactivated' } } } }]);
  fireEvent.click(screen.getByRole('button', { name: 'Devre Dışı Bırak' }));
  expect(mockLogout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Evet, Devre Dışı Bırak' }));
  expect(await screen.findByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
