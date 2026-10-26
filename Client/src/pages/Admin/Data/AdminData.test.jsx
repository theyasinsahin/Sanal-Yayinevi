import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { InMemoryCache } from '@apollo/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { GraphQLError } from 'graphql';
import AdminData from './index';
import { GET_ADMIN_RESOURCES, GET_ADMIN_RECORDS, GET_ADMIN_RECORD, SAVE_ADMIN_RECORD } from '../../../graphql/admin';
import { GET_ALL_GENRES } from '../../../graphql/queries/genre';

jest.mock('../../../components/Admin/AdminLayout', () => ({ __esModule: true, default: ({ children, title }) => <main><h1>{title}</h1>{children}</main> }));
const field = (name, options = {}) => ({ name, label: name, type: 'String', required: false, editable: true, enumValues: [], reference: null, sensitive: false, maxLength: null, ...options });
const genre = { name: 'Genre', label: 'Kitap türleri', description: 'Tür yönetimi', canCreate: true, indexes: [], fields: [field('name', { label: 'Ad', required: true }), field('slug', { label: 'URL adı', required: true }), field('description', { label: 'Açıklama' }), field('hexColor', { label: 'Renk' }), field('isActive', { label: 'Aktif', type: 'Boolean' })] };
const user = { name: 'User', label: 'Kullanıcılar', description: 'Hesap yönetimi', canCreate: false, indexes: [], fields: [field('username'), field('email'), field('role', { enumValues: ['ADMIN', 'USER'] }), field('isActive', { type: 'Boolean' }), field('password', { sensitive: true, editable: false })] };
const record = { id: 'genre-1', title: 'Roman', revision: 'v1', values: { name: 'Roman', slug: 'roman', description: '', hexColor: '#6366f1', isActive: true }, references: [] };
const variables = (name = 'Genre', extra = {}) => ({ resource: name, page: 1, limit: 25, search: '', state: 'ALL', ...extra });
const meta = { request: { query: GET_ADMIN_RESOURCES }, result: { data: { getAdminResources: [genre, user] } } };
const list = (items = [record], options = {}) => ({ request: { query: GET_ADMIN_RECORDS, variables: variables(options.resource || 'Genre', options.variables || {}) }, result: { data: { getAdminRecords: { total: options.total ?? items.length, page: options.page || 1, totalPages: options.pages ?? (items.length ? 1 : 0), items } } } });
const detail = (value = record, name = 'Genre') => ({ request: { query: GET_ADMIN_RECORD, variables: { resource: name, id: value.id } }, result: { data: { getAdminRecord: value } } });
function show(path, mocks = [], props = { resource: 'Genre' }) {
  const router = createMemoryRouter([{ path: '/admin/genres', element: <AdminData {...props} /> }, { path: '/admin/data/:resource', element: <AdminData {...props} /> }, { path: '/admin/schemas', element: <AdminData schema /> }], { initialEntries: [path] });
  return render(<MockedProvider mocks={[meta, ...mocks]} cache={new InMemoryCache({ typePolicies: { AdminRecord: { keyFields: false } } })}><RouterProvider router={router} /></MockedProvider>);
}
test('genre list exposes a working creation form without icon or emoji fields', async () => {
  const created = { ...record, id: 'genre-2', title: 'Öykü', values: { ...record.values, name: 'Öykü', slug: 'oyku' } };
  const save = jest.fn(() => ({ data: { saveAdminRecord: created } }));
  show('/admin/genres', [list([]), {
    request: { query: SAVE_ADMIN_RECORD, variables: { resource: 'Genre', id: null, revision: null, changes: { name: 'Öykü' }, reason: 'Yeni tür ekleniyor.' } }, result: save,
  }, { request: { query: GET_ALL_GENRES }, result: { data: { getAllGenres: [] } } }, list([created])]);
  fireEvent.click(await screen.findByRole('button', { name: 'Yeni tür ekle' }));
  expect(screen.queryByLabelText(/ikon|emoji/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText('URL adı')).not.toBeRequired();
  expect(screen.getByLabelText('Aktif')).toBeChecked();
  fireEvent.change(screen.getByLabelText('Ad'), { target: { value: 'Öykü' } });
  fireEvent.change(screen.getByLabelText('İşlem gerekçesi *'), { target: { value: 'Yeni tür ekleniyor.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Oluştur' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Yeni kayıt oluşturuldu.')).toBeInTheDocument();
});

test('record changes send only edited fields and a revision, then refresh the stored values', async () => {
  const changed = { ...record, revision: 'v2', values: { ...record.values, description: 'Yeni açıklama' } };
  const save = jest.fn(() => ({ data: { saveAdminRecord: changed } }));
  show('/admin/genres?record=genre-1', [list(), detail(), { request: { query: SAVE_ADMIN_RECORD, variables: { resource: 'Genre', id: 'genre-1', revision: 'v1', changes: { description: 'Yeni açıklama' }, reason: 'Açıklama düzenlendi.' } }, result: save }, { request: { query: GET_ALL_GENRES }, result: { data: { getAllGenres: [] } } }, detail(changed), list([changed])]);
  fireEvent.change(await screen.findByLabelText('Açıklama'), { target: { value: 'Yeni açıklama' } });
  fireEvent.change(screen.getByLabelText('İşlem gerekçesi *'), { target: { value: 'Açıklama düzenlendi.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Değişiklikleri kaydet' }));
  expect(await screen.findByText('Değişiklikler kaydedildi.', { selector: 'p[role="status"]' })).toBeInTheDocument();
  expect(save).toHaveBeenCalledTimes(1);
});

test('a conflict keeps the draft visible and offers a deliberate reload instead of overwriting', async () => {
  show('/admin/genres?record=genre-1', [list(), detail(), { request: { query: SAVE_ADMIN_RECORD, variables: { resource: 'Genre', id: 'genre-1', revision: 'v1', changes: { name: 'Yeni ad' }, reason: 'Adı değiştirme.' } }, result: { errors: [new GraphQLError('Bu kayıt başka bir işlemde değişti.', { extensions: { code: 'CONFLICT' } })] } }]);
  fireEvent.change(await screen.findByLabelText('Ad'), { target: { value: 'Yeni ad' } });
  fireEvent.change(screen.getByLabelText('İşlem gerekçesi *'), { target: { value: 'Adı değiştirme.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Değişiklikleri kaydet' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('başka bir işlemde');
  expect(screen.getByLabelText('Ad')).toHaveValue('Yeni ad');
  expect(screen.getByRole('button', { name: 'Değişiklikleri kaydet' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Güncel kaydı yükle' })).toBeEnabled();
});

test('search and state filters issue bounded server requests and reset the page', async () => {
  show('/admin/genres', [list(), list([], { variables: { search: 'bilim' } }), list([], { variables: { search: 'bilim', state: 'INACTIVE' } })]);
  await screen.findByText('Roman', { selector: 'td' });
  fireEvent.change(screen.getByLabelText('Kayıt ara'), { target: { value: 'bilim' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ara' }));
  await screen.findByText('0 kayıt · Sayfa 1 / 1');
  fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'INACTIVE' } });
  await waitFor(() => expect(screen.getByLabelText('Durum')).toHaveValue('INACTIVE'));
});

test('schema view displays permission metadata without fetching private record lists', async () => {
  show('/admin/schemas?resource=User');
  expect(await screen.findByText('password', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText('Gizli')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Yeni kayıt ekle' })).not.toBeInTheDocument();
});

test('user editing never exposes a password value and can deactivate the account', async () => {
  const account = { id: 'user-1', title: 'okur', revision: 'v1', references: [], values: { username: 'okur', email: 'okur@test', role: 'USER', isActive: true, password: 'must-not-appear' } };
  const changed = { ...account, revision: 'v2', values: { ...account.values, isActive: false } };
  const save = jest.fn(() => ({ data: { saveAdminRecord: changed } }));
  show('/admin/data/User?record=user-1', [list([account], { resource: 'User' }), detail(account, 'User'), { request: { query: SAVE_ADMIN_RECORD, variables: { resource: 'User', id: 'user-1', revision: 'v1', changes: { isActive: false }, reason: 'Hesap kapatma talebi.' } }, result: save }, detail(changed, 'User'), list([changed], { resource: 'User' })], { resource: 'User' });
  fireEvent.click(await screen.findByLabelText('isActive'));
  expect(screen.queryByText('must-not-appear')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('İşlem gerekçesi *'), { target: { value: 'Hesap kapatma talebi.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Değişiklikleri kaydet' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});

test('unsaved edits survive when the administrator cancels navigation', async () => {
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  show('/admin/genres?record=genre-1', [list(), detail()]);
  fireEvent.change(await screen.findByLabelText('Ad'), { target: { value: 'Kaydedilmeyen ad' } });
  fireEvent.click(screen.getByRole('button', { name: 'Şema ve alanlar' }));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText('Ad')).toHaveValue('Kaydedilmeyen ad');
  confirm.mockRestore();
});
