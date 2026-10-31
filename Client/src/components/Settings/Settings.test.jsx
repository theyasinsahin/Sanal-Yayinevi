import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import UserSettings from './UserSettings';
import { ReadingPreferencesProvider } from '../../context/ReadingPreferencesContext';
import { UPDATE_PRIVACY_SETTINGS_MUTATION, UPDATE_NOTIFICATION_SETTINGS_MUTATION, UPDATE_AUTHOR_SETTINGS_MUTATION } from '../../graphql/mutations/user';
import { GET_ALL_GENRES } from '../../graphql/queries/genre';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ logout: jest.fn() }) }));
jest.mock('@mui/icons-material', () => Object.fromEntries(
  ['Save', 'ManageAccounts', 'Lock', 'Notifications', 'AutoStories', 'Palette', 'DeleteForever', 'VisibilityOff'].map(name => [name, () => null]),
));
const showToast = jest.fn();
const profile = {
  id: 'user-1', email: 'reader@example.test', weeklyWritingWords: 40,
  privacySettings: { __typename: 'PrivacySettings', isProfilePublic: true, isLibraryPublic: false,
    isFollowListPublic: false, allowMessages: 'followers', showInSearchEngines: false },
  notificationSettings: { __typename: 'NotificationSettings', newFollower: true, mentionInSession: true,
    bookComment: true, bookLike: false, quoteLike: true, sessionReply: true },
  authorSettings: { __typename: 'AuthorSettings', copyrightNote: 'Telif notum', weeklyWordGoal: 100, preferredGenres: ['Roman'] },
};
const show = (mocks = [], onUpdate = jest.fn()) => render(
  <MockedProvider mocks={mocks} addTypename={false}><MemoryRouter><ReadingPreferencesProvider>
    <UserSettings profile={profile} onUpdate={onUpdate} showToast={showToast} />
  </ReadingPreferencesProvider></MemoryRouter></MockedProvider>,
);
beforeEach(() => { localStorage.clear(); showToast.mockClear(); });

test('saved privacy values reload and save without Apollo metadata in the input', async () => {
  const privacySettings = { ...profile.privacySettings, isLibraryPublic: true };
  delete privacySettings.__typename;
  const updated = jest.fn();
  show([{ request: { query: UPDATE_PRIVACY_SETTINGS_MUTATION, variables: { privacySettings } },
    result: { data: { updatePrivacySettings: { id: profile.id, privacySettings } } } }], updated);
  fireEvent.click(screen.getByRole('button', { name: 'Gizlilik' }));
  expect(screen.getByLabelText('Kitaplığı Göster')).not.toBeChecked();
  expect(screen.getByLabelText('Takip Listesini Göster')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Kitaplığı Göster'));
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
  expect(showToast).toHaveBeenCalledWith('Gizlilik ayarları kaydedildi.', 'success');
});

test('only supported event notifications remain and saved disabled preferences are respected', async () => {
  const notificationSettings = { ...profile.notificationSettings, bookLike: true };
  delete notificationSettings.__typename;
  const updated = jest.fn();
  show([{ request: { query: UPDATE_NOTIFICATION_SETTINGS_MUTATION, variables: { notificationSettings } },
    result: { data: { updateNotificationSettings: { id: profile.id, notificationSettings } } } }], updated);
  fireEvent.click(screen.getByRole('button', { name: 'Bildirimler' }));
  expect(screen.queryByText('Haftalık Özet')).not.toBeInTheDocument();
  expect(screen.queryByText('Yayınevi Teklifi')).not.toBeInTheDocument();
  expect(screen.queryByText('Teklif Güncellemesi')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Kitaba Beğeni')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Kitaba Beğeni'));
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
});

test('reading size persists across remounts; theme and language controls are absent', async () => {
  const view = show();
  fireEvent.click(screen.getByRole('button', { name: 'Görünüm' }));
  expect(screen.queryByText('Tema')).not.toBeInTheDocument();
  expect(screen.queryByText('Uygulama Dili')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Büyük'));
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  expect(localStorage.getItem('app_font_size')).toBe('lg');
  await waitFor(() => expect(document.documentElement.style.getPropertyValue('--reading-font-size')).toBe('20px'));
  view.unmount(); show();
  fireEvent.click(screen.getByRole('button', { name: 'Görünüm' }));
  expect(screen.getByLabelText('Büyük')).toBeChecked();
});

test('author settings use real genres and send only supported fields', async () => {
  const genre = { id: 'genre-1', name: 'Roman', isActive: true, slug: 'roman', group: 'FICTION', sortOrder: 0, description: '', iconUrl: '', hexColor: '#000', createdAt: '', updatedAt: '' };
  const authorSettings = { copyrightNote: 'Telif notum', weeklyWordGoal: 200, preferredGenres: ['Roman'] };
  const updated = jest.fn();
  show([
    { request: { query: GET_ALL_GENRES }, result: { data: { getAllGenres: [genre] } } },
    { request: { query: UPDATE_AUTHOR_SETTINGS_MUTATION, variables: { authorSettings } }, result: { data: { updateAuthorSettings: { id: profile.id, authorSettings } } } },
  ], updated);
  fireEvent.click(screen.getByRole('button', { name: 'Yazar' }));
  expect(screen.queryByText('Yayınevlerine Görün')).not.toBeInTheDocument();
  expect(screen.queryByText('Varsayılan Kitap Dili')).not.toBeInTheDocument();
  expect(await screen.findByLabelText('Roman')).toBeChecked();
  expect(screen.getByRole('progressbar', { name: 'Haftalık yazma hedefi' })).toHaveAttribute('value', '40');
  fireEvent.change(screen.getByLabelText('Haftalık Kelime Hedefi'), { target: { value: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));
  await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
});
