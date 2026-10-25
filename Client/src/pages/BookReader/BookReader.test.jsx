import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookReader from './index';
import { GET_BOOK_READER_DATA } from '../../graphql/queries/book';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';

jest.mock('@mui/icons-material', () => Object.fromEntries(['ArrowBack', 'Check', 'AutoStories', 'ChevronLeft', 'ChevronRight', 'MenuBook'].map(name => [name, () => null])));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../hooks/useReadingTracker', () => ({ useReadingTracker: () => {} }));
jest.mock('../../components/ParagraphComment/ParagraphRenderer', () => ({ __esModule: true, default: ({ content }) => <article>{content}</article> }));
jest.mock('../../components/Quote/QuotePopup', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/Sharing/SocialShareButton', () => ({ __esModule: true, default: ({ id }) => <button data-chapter={id}>Bölümü paylaş</button> }));
jest.mock('../../utils/htmlPageSplitter', () => ({ parseContentToPages: content => [{ content }] }));

const book = { id: 'book', title: 'Kitap', authorId: null, genre: null, chapters: [
  { id: 'first', title: 'İlk Bölüm', content: 'İlk bölümün metni.' },
  { id: 'second', title: 'İkinci Bölüm', content: 'İkinci bölümün metni.' },
] };
const show = path => render(<MockedProvider mocks={[
  { request: { query: GET_BOOK_READER_DATA, variables: { id: 'book' } }, result: { data: { getBookById: book } } },
  { request: { query: INCREMENT_BOOK_VIEW_MUTATION, variables: { id: 'book' } }, result: { data: { incrementBookViews: { id: 'book', stats: { views: 1 } } } } },
]} addTypename={false}><MemoryRouter initialEntries={[path]}><Routes><Route path="/book-reader/:bookId" element={<BookReader />} /></Routes></MemoryRouter></MockedProvider>);
beforeEach(() => { window.scrollTo = jest.fn(); localStorage.clear(); });

test('a shared chapter takes precedence over saved reading progress and remains navigable', async () => {
  localStorage.setItem('book-progress-book', JSON.stringify({ lastChapter: 0, completed: [] }));
  show('/book-reader/book?chapter=second');
  expect(await screen.findByRole('heading', { name: 'İkinci Bölüm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bölümü paylaş' })).toHaveAttribute('data-chapter', 'second');
  fireEvent.click(screen.getByText('İlk Bölüm', { selector: '.chapter-title' }));
  expect(await screen.findByRole('heading', { name: 'İlk Bölüm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bölümü paylaş' })).toHaveAttribute('data-chapter', 'first');
});

test('a removed shared chapter produces a visible explanation and keeps other chapters usable', async () => {
  show('/book-reader/book?chapter=removed');
  expect(await screen.findByRole('status')).toHaveTextContent('Paylaşılan bölüm bulunamadı');
  expect(screen.getByRole('heading', { name: 'İlk Bölüm' })).toBeInTheDocument();
});

test('ordinary reading links continue from saved progress', async () => {
  localStorage.setItem('book-progress-book', JSON.stringify({ lastChapter: 1, completed: [0] }));
  show('/book-reader/book');
  expect(await screen.findByRole('heading', { name: 'İkinci Bölüm' })).toBeInTheDocument();
  await waitFor(() => expect(JSON.parse(localStorage.getItem('book-progress-book')).lastChapter).toBe(1));
});
