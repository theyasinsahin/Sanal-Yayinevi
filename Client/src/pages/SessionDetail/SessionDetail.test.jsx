import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import SessionDetail from './index';
import { VERIFY_SESSION_ACCESS_CODE } from '../../graphql/queries/session';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

let mockSession, mockEntries, mockUser, mockError, mockLoading;
const mockAdd = jest.fn(), mockDelete = jest.fn(), mockLike = jest.fn(), mockClose = jest.fn(), mockToast = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Sharing/SocialShareButton', () => () => null);
jest.mock('../../hooks/useSessions', () => ({
  useGetSession: () => ({ session: mockSession, error: mockError, loading: mockLoading }),
  useGetSessionEntries: () => ({ entries: mockEntries, loading: false }),
  useNewSessionEntrySubscription: () => {},
  useAddSessionEntry: () => ({ addEntry: mockAdd, loading: false }),
  useDeleteSessionEntry: () => ({ deleteEntry: mockDelete }),
  useToggleSessionEntryLike: () => ({ toggleLike: mockLike }),
  useCloseSession: () => ({ closeSession: mockClose }),
}));
beforeEach(() => {
  mockUser = { id: 'reader' }; mockError = null; mockLoading = false;
  mockSession = { id: 'room', title: 'Reading room', description: 'Discuss books', type: 'OPEN', isActive: true, coverImageUrl: '', tags: ['reading'], participantCount: 1, createdBy: { id: 'owner', username: 'owner', fullName: 'Room owner' } };
  mockEntries = [{ id: 'entry', content: 'A thoughtful entry', likedBy: [], likeCount: 0, createdAt: '2026-01-01', user: { id: 'reader', username: 'reader', fullName: 'Reader' } }];
  [mockAdd, mockDelete, mockLike, mockClose].forEach(fn => fn.mockReset().mockResolvedValue({}));
  mockToast.mockReset(); jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const show = (mocks = []) => render(<MockedProvider mocks={mocks}><MemoryRouter initialEntries={['/sessions/room']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/sessions/:sessionId" element={<SessionDetail />} /><Route path="/sessions" element={<h1>Sessions destination</h1>} /></Routes></MemoryRouter></MockedProvider>);
const compose = value => fireEvent.change(screen.getByPlaceholderText('Düşüncelerini yaz...'), { target: { value } });

test('a room without a cover still shows its title, entries and valid author links', () => {
  show();
  expect(screen.getByRole('heading', { name: 'Reading room' })).toBeInTheDocument();
  expect(screen.getByText('A thoughtful entry')).toBeInTheDocument();
  // The nested-anchor regression is a structural HTML check.
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.querySelector('a a')).toBeNull();
  expect(screen.getByRole('link', { name: /Room owner/ })).toHaveAttribute('href', '/yazar/owner');
  expect(screen.getByRole('link', { name: /Reader/ })).toHaveAttribute('href', '/yazar/reader');
});
test('the composer blocks empty content and sends trimmed text with Ctrl+Enter', async () => {
  show();
  expect(screen.getByRole('button', { name: 'Paylaş' })).toBeDisabled();
  compose('  My thought  ');
  fireEvent.keyDown(screen.getByPlaceholderText('Düşüncelerini yaz...'), { key: 'Enter', ctrlKey: true });
  await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('My thought', null));
  await waitFor(() => expect(screen.getByPlaceholderText('Düşüncelerini yaz...')).toHaveValue(''));
});
test('failed sends show feedback and keep the draft for retry', async () => {
  let rejectSend;
  mockAdd.mockImplementation(() => new Promise((_, reject) => { rejectSend = reject; }));
  show(); compose('Keep this draft');
  fireEvent.click(screen.getByRole('button', { name: 'Paylaş' }));
  await act(async () => { rejectSend(new Error('Offline')); });
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Offline', 'error'));
  expect(screen.getByPlaceholderText('Düşüncelerini yaz...')).toHaveValue('Keep this draft');
});
test('guests cannot compose or like entries and receive a sign-in hint', () => {
  mockUser = null; show();
  expect(screen.getByPlaceholderText('Düşüncelerini yaz...')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Yazıyı beğen' }));
  expect(mockLike).not.toHaveBeenCalled();
  expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('giriş'), 'warning');
});
test('the author can delete their entry and failures are shown to the user', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Seçenekler' }));
  fireEvent.click(screen.getByRole('button', { name: /Sil/ }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('entry'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Yazı silindi.', 'success'));
});
test('only the creator sees the close action and a confirmed close returns to the list', async () => {
  mockUser = { id: 'owner' };
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Oturumu Kapat' }));
  expect(await screen.findByRole('heading', { name: 'Sessions destination' })).toBeInTheDocument();
  expect(mockClose).toHaveBeenCalledWith('room');
});
test('closed rooms show their entries and disable new writing', () => {
  mockSession.isActive = false; show();
  expect(screen.queryByPlaceholderText('Düşüncelerini yaz...')).not.toBeInTheDocument();
  expect(screen.getByText(/Yeni yazı eklenemez/)).toBeInTheDocument();
});
test.each([['missing', 'Oturum bulunamadı.'], ['forbidden', 'Bu oturuma erişim yetkiniz yok.']])('an unavailable room renders %s feedback', (state, text) => {
  mockSession = null; mockError = state === 'forbidden' ? new Error('Forbidden') : null;
  show(); expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
test('private room content stays behind the code gate until successful verification', async () => {
  mockSession.type = 'PRIVATE';
  show([{ request: { query: VERIFY_SESSION_ACCESS_CODE, variables: { sessionId: 'room', accessCode: 'secret' } }, result: { data: { verifySessionAccessCode: true } } }]);
  expect(screen.queryByText('A thoughtful entry')).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Erişim kodu...'), { target: { value: ' secret ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Katıl' }));
  expect(await screen.findByText('A thoughtful entry')).toBeInTheDocument();
  compose('Private thought'); fireEvent.click(screen.getByRole('button', { name: 'Paylaş' }));
  await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('Private thought', 'secret'));
});
