import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import RecordEditor from './RecordEditor';
import { GET_ADMIN_RECORDS, SAVE_ADMIN_RECORD } from '../../../graphql/admin';

const reference = (type = 'ObjectId', required = true) => ({ name: 'ownerId', label: 'İlişkili kullanıcı', type, required, editable: true, sensitive: false, reference: 'User', enumValues: [] });
const request = { query: GET_ADMIN_RECORDS, variables: { resource: 'User', page: 1, limit: 25, search: '', state: 'ACTIVE' } };
const account = { id: 'user-1', title: 'Örnek kullanıcı', revision: 'v1', values: { username: 'example' } };
const choices = (items = [account], extra = {}) => ({ request, result: { data: { getAdminRecords: { total: items.length, page: 1, totalPages: items.length ? 1 : 0, items } } }, ...extra });
function show(mocks, field = reference()) {
  const resource = { name: 'Example', label: 'Örnek', description: '', fields: [field] };
  const router = createMemoryRouter([{ path: '/', element: <RecordEditor resource={resource} id="new" onClose={jest.fn()} onSaved={jest.fn()} /> }]);
  render(<MockedProvider mocks={mocks}><RouterProvider router={router} /></MockedProvider>);
  return screen.getByRole('button', { name: 'Oluştur' });
}

test('required reference waits for loading and forwards native required validation', async () => {
  const save = show([choices([account], { delay: 50 })]);
  expect(screen.getByRole('status')).toHaveTextContent('İlişkili kayıtlar yükleniyor');
  expect(save).toBeDisabled();
  const select = screen.getByLabelText('İlişkili kullanıcı *');
  expect(select).toBeRequired();
  expect(select).toBeDisabled();
  await waitFor(() => expect(select).toBeEnabled());
  expect(select.checkValidity()).toBe(false);
  fireEvent.change(select, { target: { value: account.id } });
  expect(select.checkValidity()).toBe(true);
  expect(select).toBeRequired();
});

test('empty references explain how to proceed and can be retried', async () => {
  const save = show([choices([]), choices()]);
  expect(await screen.findByText(/Seçilebilecek ilişkili kayıt yok/)).toBeInTheDocument();
  expect(save).toBeDisabled();
  expect(screen.getByLabelText('İlişkili kullanıcı *')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  await waitFor(() => expect(screen.getByLabelText('İlişkili kullanıcı *')).toBeEnabled());
  await waitFor(() => expect(save).toBeEnabled());
});

test('reference errors block required submission and recover on retry', async () => {
  const save = show([{ request, error: new Error('offline') }, choices()]);
  expect(await screen.findByRole('alert')).toHaveTextContent('İlişkili kayıtlar yüklenemedi');
  expect(save).toBeDisabled();
  // Submit the form directly to exercise the handler independently of native validation.
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.submit(save.closest('form'));
  fireEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
  await waitFor(() => expect(save).toBeEnabled());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each(['ObjectId', 'Array'])('required %s reference rejects empty submission and saves a real selection', async type => {
  const value = type === 'Array' ? [account.id] : account.id;
  const result = jest.fn(() => ({ data: { saveAdminRecord: { id: 'new-record', title: 'Örnek', revision: 'v1', values: { ownerId: value } } } }));
  const save = show([choices(), {
    request: { query: SAVE_ADMIN_RECORD, variables: { resource: 'Example', id: null, revision: null, changes: { ownerId: value }, reason: 'İlişki oluşturuluyor.' } }, result,
  }], reference(type));
  const select = screen.getByLabelText('İlişkili kullanıcı *');
  await waitFor(() => expect(select).toBeEnabled());
  expect(select).toBeRequired();
  await waitFor(() => expect(save).toBeEnabled());
  // Submit the form directly to exercise the handler independently of native validation.
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.submit(save.closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Zorunlu ilişkili kayıt seçimlerini tamamlayın');
  expect(result).not.toHaveBeenCalled();
  fireEvent.change(select, { target: { value: account.id } });
  expect(select.checkValidity()).toBe(true);
  expect(select.required).toBe(type === 'ObjectId');
  fireEvent.change(screen.getByLabelText('İşlem gerekçesi *'), { target: { value: 'İlişki oluşturuluyor.' } });
  fireEvent.click(save);
  await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
});

test('removing the final required array reference restores validation', async () => {
  show([choices()], reference('Array'));
  const select = screen.getByLabelText('İlişkili kullanıcı *');
  await waitFor(() => expect(select).toBeEnabled());
  fireEvent.change(select, { target: { value: account.id } });
  expect(select).not.toBeRequired();
  fireEvent.click(screen.getByRole('button', { name: 'Örnek kullanıcı seçimini kaldır' }));
  expect(select).toBeRequired();
  expect(select.checkValidity()).toBe(false);
});

test('an unavailable optional reference does not block unrelated edits', async () => {
  const save = show([choices([])], reference('ObjectId', false));
  await screen.findByText(/Seçilebilecek ilişkili kayıt yok/);
  expect(screen.getByLabelText('İlişkili kullanıcı')).not.toBeRequired();
  expect(save).toBeEnabled();
});
