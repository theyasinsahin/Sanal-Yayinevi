import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import ConversationList from './index';
import { GET_CONVERSATIONS, GET_MESSAGE_RECIPIENTS, GET_OR_CREATE_CONVERSATION } from '../../../graphql/queries/message';

jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
const person = { __typename: 'User', id: 'followed', username: 'yazar', fullName: 'Takip Edilen Yazar', profilePicture: '' };
const me = { __typename: 'User', id: 'me', username: 'okur', fullName: 'Okur', profilePicture: '' };
const conversation = { __typename: 'Conversation', id: 'new-conversation', participants: [me, person], isGroup: false, unreadCount: 0, lastMessage: null, updatedAt: '2026-11-03T12:00:00Z' };
const peopleMock = (search = '', recipients = [person], offset = 0) => ({
  request: { query: GET_MESSAGE_RECIPIENTS, variables: { search, limit: 30, offset } },
  result: { data: { getMessageRecipients: recipients } },
});
const show = (extraMocks = [], conversations = [], recipients = [person]) => {
  const onSelect = jest.fn();
  render(<MockedProvider mocks={[
    { request: { query: GET_CONVERSATIONS }, result: { data: { getConversations: conversations } }, maxUsageCount: 3 },
    peopleMock('', recipients), ...extraMocks,
  ]}><ConversationList onSelect={onSelect} /></MockedProvider>);
  return onSelect;
};

test('an eligible followed person with no conversation can be selected for the first message', async () => {
  const create = jest.fn(() => ({ data: { getOrCreateConversation: conversation } }));
  const onSelect = show([{ request: { query: GET_OR_CREATE_CONVERSATION, variables: { recipientId: person.id } }, result: create }]);
  const button = await screen.findByRole('button', { name: /Takip Edilen Yazar/ });
  expect(create).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith('new-conversation'));
  expect(create).toHaveBeenCalledTimes(1);
});

test('recipient search reaches the server even if no conversation matches', async () => {
  const second = { ...person, id: 'second', fullName: 'Yeni Kişi', username: 'yenikisi' };
  show([peopleMock('yeni', [second])]);
  await screen.findByRole('button', { name: /Takip Edilen Yazar/ });
  fireEvent.change(screen.getByRole('textbox', { name: 'Mesaj göndereceğin kişiyi ara' }), { target: { value: 'yeni' } });
  expect(await screen.findByRole('button', { name: /Yeni Kişi/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Takip Edilen Yazar/ })).not.toBeInTheDocument();
});

test('existing conversations stay available and are not duplicated among recipients', async () => {
  const onSelect = show([], [conversation]);
  const button = await screen.findByRole('button', { name: /Takip Edilen Yazar/ });
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.getAllByRole('button', { name: /Takip Edilen Yazar/ })).toHaveLength(1);
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledWith(conversation.id);
});

test('a changed recipient permission displays an error without navigating', async () => {
  const onSelect = show([{ request: { query: GET_OR_CREATE_CONVERSATION, variables: { recipientId: person.id } }, error: new Error('Bu kullanıcı mesaj almayı sınırlandırmış.') }]);
  fireEvent.click(await screen.findByRole('button', { name: /Takip Edilen Yazar/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('mesaj almayı sınırlandırmış');
  expect(onSelect).not.toHaveBeenCalled();
});

test('all follows remain reachable by loading the next page', async () => {
  const firstPage = Array.from({ length: 30 }, (_, index) => ({ ...person, id: `person-${index}`, fullName: `Kişi ${index}` }));
  const last = { ...person, id: 'last', fullName: 'Son Kişi' };
  show([peopleMock('', [last], 30)], [], firstPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Daha fazla kişi göster' }));
  expect(await screen.findByRole('button', { name: /Son Kişi/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Kişi 0 / })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Daha fazla kişi göster' })).not.toBeInTheDocument();
});
