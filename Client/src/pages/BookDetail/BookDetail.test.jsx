import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { useQuery, useMutation } from '@apollo/client';
import { useAuth } from '../../context/AuthContext';
import BookDetail from './index';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';
import { GET_COMMENTS_BY_BOOK_ID } from '../../graphql/queries/comment';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { GET_QUOTES_BY_BOOK } from '../../graphql/queries/quote';
import { GET_SOCIAL_SHARE } from '../../graphql/socialShare';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../components/Layout/MainLayout', () => ({ MainLayout: ({ children }) => <main>{children}</main> }));
jest.mock('../../components/Books/BookFollowButton', () => () => null);
jest.mock('../../components/Books/BackersSection', () => () => null);
jest.mock('../../components/Comments/CommentList', () => () => null);
jest.mock('../../components/Quote/QuoteCard', () => () => null);
jest.mock('../../components/Messaging/ShareModal', () => ({ __esModule: true, default: ({ attachedBookId, currentUserId }) => <div role="dialog" aria-label="Betik mesajı">{attachedBookId} / {currentUserId}</div> }));
jest.mock('@mui/icons-material', () => Object.fromEntries(['ArrowBack', 'FavoriteBorder', 'Favorite', 'BookmarkBorder', 'Bookmark', 'MenuBook', 'Edit', 'Delete', 'CardGiftcard', 'Comment', 'CheckCircle', 'Error', 'Info', 'Close', 'Warning'].map(name => [name, () => null])));

const baseBook = { id: 'book-1', kind: 'DIGITAL', title: 'Paylaşılacak kitap', description: 'Kitabın tanıtım metni.', status: 'WRITING', authorId: 'author', author: { id: 'author', username: 'author', fullName: 'Yazar' }, chapters: [], likedBy: [], stats: { likes: 0 }, pageCount: 200, imageUrl: '', tags: [], commentCount: 0 };
let book;
beforeEach(() => {
  book = baseBook;
  localStorage.clear();
  window.scrollTo = jest.fn();
  useAuth.mockReturnValue({ user: null });
  useQuery.mockImplementation((document, options) => {
    if (document === GET_BOOK_BY_ID) return { data: { getBookById: book }, loading: false, refetch: jest.fn() };
    if (document === GET_COMMENTS_BY_BOOK_ID) return { data: { getCommentsByBookId: [] }, refetch: jest.fn() };
    if (document === GET_QUOTES_BY_BOOK) return { data: { getQuotesByBook: [] }, refetch: jest.fn() };
    if (document === GET_USER_BY_ID) return { data: { getUserById: { id: 'reader', role: 'USER', savedBooks: [] } } };
    return jest.requireActual('@apollo/client').useQuery(document, options);
  });
  useMutation.mockReturnValue([jest.fn().mockResolvedValue({ data: {} }), { loading: false }]);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo'], { type: 'image/jpeg' }) });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:book-share'); URL.revokeObjectURL = jest.fn();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});

const show = () => render(<MockedProvider addTypename={false} mocks={[{
  request: { query: GET_SOCIAL_SHARE, variables: { type: 'BOOK', id: 'book-1' } },
  result: { data: { getSocialShare: { type: 'BOOK', id: 'book-1', title: book.title, description: book.description, path: '/book-detail/book-1', imagePath: '/social-share/book.jpg', webOrigin: 'https://betik.example' } } },
}]}><MemoryRouter initialEntries={['/book-detail/book-1']}><Routes><Route path="/book-detail/:id" element={<BookDetail />} /></Routes></MemoryRouter></MockedProvider>);

test.each(['DIGITAL', 'PRINTED'])('%s book detail opens social/story options without copying a link on click', async kind => {
  book = { ...baseBook, kind, publicationStatus: 'APPROVED', printedAuthor: 'Yazar', publisher: 'Yayınevi', publicationYear: 2024 };
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Kitabı paylaş' }));
  expect(await screen.findByRole('dialog', { name: 'Paylaş' })).toBeInTheDocument();
  const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
  expect(new URL(whatsapp.href).searchParams.get('text')).toContain('/share/book/book-1');
  expect(screen.getByRole('link', { name: 'Telegram' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'X’te paylaş' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'Görseli indir' })).toHaveAttribute('download', 'betik-book-book-1.jpg');
  expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});

test('book detail copies only when the copy option is selected', async () => {
  show(); fireEvent.click(screen.getByRole('button', { name: 'Kitabı paylaş' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Bağlantıyı kopyala' }));
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/share/book/book-1')));
});

test('signed-in readers can continue from book detail to Betik messaging with the same book', async () => {
  localStorage.setItem('userId', 'reader');
  useAuth.mockReturnValue({ user: { id: 'reader' } });
  show(); fireEvent.click(screen.getByRole('button', { name: 'Kitabı paylaş' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Betik’te mesajla gönder' }));
  expect(screen.getByRole('dialog', { name: 'Betik mesajı' })).toHaveTextContent('book-1 / reader');
  expect(screen.queryByRole('dialog', { name: 'Paylaş' })).not.toBeInTheDocument();
});
