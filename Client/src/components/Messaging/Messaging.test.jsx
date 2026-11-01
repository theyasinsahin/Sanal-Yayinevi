import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatWindow from './ChatWindow';
import ConversationList from './ConversationList';
jest.mock('@mui/icons-material', () => require('../../../test-support/icons.cjs'));

let mockMessages, mockLoading, mockError;
const mockSend = jest.fn(), mockRead = jest.fn(), mockOlder = jest.fn();
const participants = [{ id: 'reader', username: 'reader' }, { id: 'other', username: 'author', fullName: 'Other Reader' }];
const mockConversations = [
  { id: 'conversation', participants, unreadCount: 2, lastMessage: { content: 'Latest message', type: 'TEXT', sender: participants[1], createdAt: '2026-01-01' } },
  { id: 'second', participants: [participants[0], { id: 'third', username: 'third', fullName: 'Third Person' }], unreadCount: 0, lastMessage: null },
];
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'reader' } }) }));
jest.mock('../../hooks/useMessages', () => ({
  useGetConversations: () => ({ conversations: mockConversations, loading: false, error: null }),
  useGetMessages: () => ({ messages: mockMessages, loading: mockLoading, error: mockError, hasMore: true, loadOlderMessages: mockOlder }),
  useSendMessage: () => ({ sendMessage: mockSend, sending: false }),
  useMarkAsRead: () => mockRead,
  useNewMessageSubscription: () => {},
  useDeleteMessage: () => ({ deleteMessage: jest.fn(), deleting: false }),
}));
const show = element => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}</MemoryRouter>);
beforeEach(() => { mockMessages = []; mockLoading = false; mockError = null; mockSend.mockReset().mockResolvedValue({}); mockRead.mockReset(); mockOlder.mockReset(); });

test('conversation selection identifies the other participant and filters by username or full name', () => {
  const select = jest.fn();
  show(<ConversationList activeConversationId="conversation" onSelect={select} />);
  expect(screen.getByText('Other Reader')).toBeInTheDocument();
  expect(screen.getByText('Latest message')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Other Reader'));
  expect(select).toHaveBeenCalledWith('conversation');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'THIRD' } });
  expect(screen.getByText('Third Person')).toBeInTheDocument();
  expect(screen.queryByText('Other Reader')).not.toBeInTheDocument();
});
test('chat marks the selected conversation read and exposes the other participant profile', () => {
  show(<ChatWindow conversationId="conversation" onBack={jest.fn()} />);
  expect(mockRead).toHaveBeenCalledWith('conversation');
  expect(screen.getByRole('link', { name: /Other Reader/ })).toHaveAttribute('href', '/yazar/author');
  expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Daha eski mesajlar' }));
  expect(mockOlder).toHaveBeenCalledTimes(1);
});
test('Enter sends trimmed text and clears the composer; Shift+Enter does not submit', async () => {
  show(<ChatWindow conversationId="conversation" onBack={jest.fn()} />);
  const input = screen.getByPlaceholderText('Mesaj yaz...');
  fireEvent.change(input, { target: { value: '  Hello  ' } });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(mockSend).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(mockSend).toHaveBeenCalledWith({ conversationId: 'conversation', content: 'Hello', type: 'TEXT' }));
  expect(input).toHaveValue('');
});
test('failed chat sends retain text for retry and show the service error', async () => {
  mockSend.mockRejectedValue(new Error('Messaging unavailable'));
  show(<ChatWindow conversationId="conversation" onBack={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('Mesaj yaz...'), { target: { value: 'Retry me' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Messaging unavailable');
  expect(screen.getByPlaceholderText('Mesaj yaz...')).toHaveValue('Retry me');
});
test('failed message queries show feedback and do not show a composer for an inaccessible conversation', () => {
  mockError = new Error('Forbidden');
  show(<ChatWindow conversationId="conversation" onBack={jest.fn()} />);
  expect(screen.getByText('Mesajlar yüklenemedi.')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Mesaj yaz...')).not.toBeInTheDocument();
});
