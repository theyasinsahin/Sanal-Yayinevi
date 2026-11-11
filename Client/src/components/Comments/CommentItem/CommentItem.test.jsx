import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommentItem from './index';
import UserProfileLink from '../../UI/UserProfileLink';
import { REPLY_TO_COMMENT_MUTATION } from '../../../graphql/mutations/comment';
import { GET_COMMENTS_BY_BOOK_ID } from '../../../graphql/queries/comment';

const comment = { id: 'comment', content: 'Kitap yorumu', userId: { id: 'reader', username: 'okur', profilePicture: '' }, likedBy: [], replies: [{ id: 'reply', content: 'Yanıt', userId: { id: 'writer', username: 'yazar', profilePicture: '' }, likedBy: [] }] };

test.each([[0, 'okur', 'comment'], [1, 'yazar', 'reply']])('replying to target %s prefills its author and submits a single mention', async (index, username, parentCommentId) => {
  const content = `@${username} Merhaba, yanıtım burada.`;
  const result = jest.fn(() => ({ data: { replyToComment: { id: 'new-reply', content, date: '2026-11-06T00:00:00.000Z', userId: { id: 'viewer', username: 'cevaplayan', profilePicture: '' } } } }));
  const mocks = [
    { request: { query: REPLY_TO_COMMENT_MUTATION, variables: { bookId: 'book', content, parentCommentId } }, result },
    { request: { query: GET_COMMENTS_BY_BOOK_ID, variables: { bookId: 'book' } }, result: { data: { getCommentsByBookId: [] } } },
  ];
  render(<MockedProvider mocks={mocks}><MemoryRouter><CommentItem comment={comment} currentUserId="viewer" bookId="book" /></MemoryRouter></MockedProvider>);
  fireEvent.click(screen.getAllByRole('button', { name: 'Yanıtla' })[index]);
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue(`@${username} `);
  expect(input).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
  fireEvent.change(input, { target: { value: content } });
  fireEvent.click(screen.getByRole('button', { name: 'Gönder' }));
  await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
});

test('closing and reopening a reply preserves its draft without adding another mention', () => {
  render(<MockedProvider><MemoryRouter><CommentItem comment={{ ...comment, replies: [] }} bookId="book" /></MemoryRouter></MockedProvider>);
  const toggle = screen.getByRole('button', { name: 'Yanıtla' });
  fireEvent.click(toggle);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '@okur Yazdığım taslak' } });
  fireEvent.click(toggle);
  fireEvent.click(toggle);
  expect(screen.getByRole('textbox')).toHaveValue('@okur Yazdığım taslak');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
  expect(screen.getByRole('button', { name: 'Gönder' })).toBeDisabled();
});

test('a missing author never inserts a placeholder username into the reply', () => {
  render(<MockedProvider><MemoryRouter><CommentItem comment={{ ...comment, userId: null, replies: [] }} bookId="book" /></MemoryRouter></MockedProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Yanıtla' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
});
test('comment and reply author names link to the matching public profile', () => {
  render(<MockedProvider><MemoryRouter><Routes><Route path="/" element={<CommentItem comment={comment} bookId="book" />} /><Route path="/yazar/okur" element={<h1>Okurun profili</h1>} /></Routes></MemoryRouter></MockedProvider>);
  expect(screen.getByRole('link', { name: 'okur' })).toHaveAttribute('href', '/yazar/okur');
  expect(screen.getByRole('link', { name: 'yazar' })).toHaveAttribute('href', '/yazar/yazar');
  fireEvent.click(screen.getByRole('link', { name: 'okur' }));
  expect(screen.getByRole('heading', { name: 'Okurun profili' })).toBeInTheDocument();
});
test('profile navigation inside a clickable card does not trigger the card action and missing users have no broken link', () => {
  const openBook = jest.fn();
  render(<MemoryRouter><div onClick={openBook}><UserProfileLink user={{ id: 'reader' }}>Okur</UserProfileLink><UserProfileLink user={null}>Silinen kullanıcı</UserProfileLink></div></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Okur' })).toHaveAttribute('href', '/user/reader');
  expect(screen.queryByRole('link', { name: 'Silinen kullanıcı' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Okur' }));
  expect(openBook).not.toHaveBeenCalled();
});
