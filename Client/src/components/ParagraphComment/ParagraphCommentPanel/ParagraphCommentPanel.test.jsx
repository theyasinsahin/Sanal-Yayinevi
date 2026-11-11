import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter } from 'react-router-dom';
import ParagraphCommentPanel from './index';
import { GET_PARAGRAPH_COMMENTS } from '../../../graphql/queries/paragraphComment';
import { ADD_PARAGRAPH_COMMENT, DELETE_PARAGRAPH_COMMENT } from '../../../graphql/mutations/paragraphComment';
import RegistrationPrompt from '../../Registration/RegistrationPrompt';
import { finishRegistrationIntent, saveRegistrationIntent } from '../../../utils/registrationIntent';
jest.mock('@mui/icons-material', () => require('../../../../test-support/icons.cjs'));

let mockUser;
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
beforeEach(() => { mockUser = { id: 'reader' }; sessionStorage.clear(); });
const comment = { __typename: 'ParagraphComment', id: 'comment', content: 'A thought', likedBy: [], createdAt: String(Date.now()), user: { __typename: 'User', id: 'reader', username: 'reader', fullName: 'Reader', profilePicture: '' } };
const variables = { chapterId: 'chapter', paragraphIndex: 3 };
const list = comments => ({ request: { query: GET_PARAGRAPH_COMMENTS, variables }, result: { data: { getParagraphComments: comments } } });
const show = mocks => render(<MockedProvider mocks={mocks}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><RegistrationPrompt /><ParagraphCommentPanel bookId="book" {...variables} onClose={jest.fn()} /></MemoryRouter></MockedProvider>);

test('guests can read and draft a paragraph comment, but posting requests registration', async () => {
  mockUser = null; show([list([comment])]);
  expect(await screen.findByText('A thought')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '@reader' })).toHaveAttribute('href', '/yazar/reader');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
  expect(screen.getByRole('dialog', { name: 'Sohbete katıl' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('textbox')).toHaveValue('My draft');
  expect(screen.queryByRole('button', { name: 'Yorumu sil' })).not.toBeInTheDocument();
});

test('a restored paragraph draft is not automatically posted after authentication', async () => {
  saveRegistrationIntent({ action: 'paragraph-comment', returnTo: '/book-reader/book', bookId: 'book', ...variables, draft: 'Keep my draft' });
  finishRegistrationIntent({ userId: 'reader' });
  show([list([])]);
  expect(await screen.findByRole('textbox')).toHaveValue('Keep my draft');
  expect(screen.getByRole('button', { name: 'Gönder' })).toBeEnabled();
});
test('posting trims content, sends the selected paragraph and refreshes its comment list', async () => {
  const add = jest.fn(() => ({ data: { addParagraphComment: comment } }));
  show([list([]), { request: { query: ADD_PARAGRAPH_COMMENT, variables: { bookId: 'book', ...variables, content: 'A thought' } }, result: add }, list([comment])]);
  expect(await screen.findByText('Henüz yorum yok. İlk yorumu sen yap!')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
  fireEvent.change(screen.getByPlaceholderText('Yorumunuzu yazın...'), { target: { value: ' A thought ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
  await waitFor(() => expect(add).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole('link', { name: '@reader' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Yorumunuzu yazın...')).toHaveValue('');
});
test('the author can delete their own paragraph comment and refresh the list', async () => {
  const remove = jest.fn(() => ({ data: { deleteParagraphComment: { __typename: 'Status', code: 200, message: 'Deleted' } } }));
  show([list([comment]), { request: { query: DELETE_PARAGRAPH_COMMENT, variables: { id: 'comment' } }, result: remove }, list([])]);
  expect(await screen.findByText('A thought')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Yorumu sil' }));
  await waitFor(() => expect(screen.queryByText('A thought')).not.toBeInTheDocument());
  expect(remove).toHaveBeenCalledTimes(1);
});
