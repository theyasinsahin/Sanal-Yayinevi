import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CommentItem from './index';
import UserProfileLink from '../../UI/UserProfileLink';

const comment = { id: 'comment', content: 'Kitap yorumu', userId: { id: 'reader', username: 'okur', profilePicture: '' }, likedBy: [], replies: [{ id: 'reply', content: 'Yanıt', userId: { id: 'writer', username: 'yazar', profilePicture: '' }, likedBy: [] }] };
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
