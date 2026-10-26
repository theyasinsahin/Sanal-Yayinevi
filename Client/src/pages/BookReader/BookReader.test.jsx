import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookReader from './index';
import { GET_BOOK_READER_DATA, GET_READING_CHAPTER, GET_BOOK_READER_FULL } from '../../graphql/queries/book';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { useAuth } from '../../context/AuthContext';
import { GET_BOOKMARK } from '../../graphql/queries/bookmark';
import { GET_READING_PROGRESS, SAVE_READING_PROGRESS } from '../../graphql/readingProgress';
import { progressStorageKey } from '../../utils/readerProgress';

jest.mock('@mui/icons-material', () => Object.fromEntries(['ArrowBack', 'Check', 'AutoStories', 'ChevronLeft', 'ChevronRight', 'MenuBook'].map(name => [name, () => null])));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useReadingTracker', () => ({ useReadingTracker: () => {} }));
jest.mock('../../components/ParagraphComment/ParagraphRenderer', () => ({ __esModule: true, default: ({ content, restoreParagraphIndex }) => <article data-restore-paragraph={restoreParagraphIndex}>{content}</article> }));
jest.mock('../../components/Quote/QuotePopup', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/Sharing/SocialShareButton', () => ({ __esModule: true, default: ({ id }) => <button data-chapter={id}>Bölümü paylaş</button> }));
jest.mock('../../utils/htmlPageSplitter', () => ({ parseContentToPages: content => [{ content }] }));

const book = { id: 'book', kind: 'DIGITAL', status: 'WRITING', publicationStatus: null, publicPath: '/kitap/roman-deniz', title: 'Kitap', authorId: null, author: null, genre: null, chapters: [
  { id: 'first', title: 'İlk Bölüm', content: 'İlk bölümün metni.' },
  { id: 'second', title: 'İkinci Bölüm', content: 'İkinci bölümün metni.' },
] };
const show = (path, options = {}) => render(<MockedProvider mocks={[
  { request: { query: GET_BOOK_READER_DATA, variables: { id: 'book' } }, result: { data: { getBookById: { ...(options.book || book), chapters: (options.book || book).chapters.map(({ content, ...chapter }) => chapter) } } } },
  ...(options.book || book).chapters.map(chapter => ({
    request: { query: GET_READING_CHAPTER, variables: { bookId: 'book', chapterId: chapter.id } },
    maxUsageCount: 10, result: options.chapterResult || { data: { getReadingChapter: chapter } },
  })),
  { request: { query: GET_BOOK_READER_FULL, variables: { id: 'book' } }, result: { data: { getBookById: options.book || book } } },
  { request: { query: INCREMENT_BOOK_VIEW_MUTATION, variables: { id: 'book' } }, result: { data: { incrementBookViews: { id: 'book', stats: { views: 1 } } } } },
  { request: { query: GET_BOOKMARK, variables: { bookId: 'book' } }, delay: options.delay || 0, result: { data: { getBookmark: options.bookmark || null } } },
  { request: { query: GET_READING_PROGRESS, variables: { bookId: 'book' } }, delay: options.delay || 0, result: { data: { getReadingProgress: options.progress || null } } },
  { request: { query: SAVE_READING_PROGRESS }, variableMatcher: () => true, maxUsageCount: 20,
    result: variables => ({ data: { saveReadingProgress: { id: 'progress', lastChapterId: variables.chapterId, completedChapters: variables.completedChapterIds, isCompleted: false, lastReadAt: new Date().toISOString() } } }) },
]} addTypename={false}><MemoryRouter initialEntries={[path]}><Routes><Route path="/book-reader/:bookId" element={<BookReader />} /><Route path="/kitap/:slug/bolum/:chapterSlug" element={<BookReader resolvedId="book" resolvedChapterId="second" />} /></Routes></MemoryRouter></MockedProvider>);
beforeEach(() => { window.scrollTo = jest.fn(); localStorage.clear(); useAuth.mockReturnValue({ user: null }); });

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
  await waitFor(() => expect(JSON.parse(localStorage.getItem(progressStorageKey('book'))).lastChapterId).toBe('second'));
});

test('a readable chapter address uses database IDs for chapter selection and saved progress', async () => {
  localStorage.setItem('book-progress-book', JSON.stringify({ lastChapter: 0, completed: [] }));
  show('/kitap/roman-deniz/bolum/ikinci-bolum');
  expect(await screen.findByRole('heading', { name: 'İkinci Bölüm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Bölümü paylaş' })).toHaveAttribute('data-chapter', 'second');
  await waitFor(() => expect(JSON.parse(localStorage.getItem(progressStorageKey('book'))).lastChapterId).toBe('second'));
  expect(localStorage.getItem('book-progress-roman-deniz')).toBeNull();
});

test('saved positions open the matching chapter and mark preceding chapters without marking the current one', async () => {
  localStorage.setItem(progressStorageKey('book'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: [] }));
  show('/book-reader/book');
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(screen.getByText('İlk Bölüm', { selector: '.chapter-title' }).closest('.chapter-item')).toHaveClass('completed');
  expect(screen.getByText('İkinci Bölüm', { selector: '.chapter-title' }).closest('.chapter-item')).not.toHaveClass('completed');
  expect(screen.getByText('2 bölümden 1 tanesi okundu')).toBeInTheDocument();
});

test('a shared chapter opens directly without declaring its preceding chapters read', async () => {
  show('/book-reader/book?chapter=second');
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(screen.getByText('İlk Bölüm', { selector: '.chapter-title' }).closest('.chapter-item')).not.toHaveClass('completed');
});

test('a delayed bookmark wins over local progress and restores its paragraph without an initial overwrite', async () => {
  useAuth.mockReturnValue({ user: { id: 'reader' } });
  const original = { lastChapterId: 'first', completedChapterIds: [], updatedAt: '2026-01-01T00:00:00Z' };
  localStorage.setItem(progressStorageKey('book', 'reader'), JSON.stringify(original));
  show('/book-reader/book', { delay: 100, bookmark: { id: 'bookmark', chapterId: 'second', chapterIndex: 0, paragraphIndex: 3, chapterTitle: 'İkinci Bölüm', updatedAt: '2026-01-02T00:00:00Z' } });
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader')))).toEqual(original);
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(await screen.findByRole('article')).toHaveAttribute('data-restore-paragraph', '3');
  expect(screen.getByText('İlk Bölüm', { selector: '.chapter-title' }).closest('.chapter-item')).toHaveClass('completed');
});

test('a signed-in reader resumes from the server on a device with no local history', async () => {
  useAuth.mockReturnValue({ user: { id: 'reader' } });
  show('/book-reader/book', { progress: { id: 'progress', lastChapterId: 'second', completedChapters: [], isCompleted: false, lastReadAt: '2026-01-02T00:00:00Z' } });
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(screen.getByText('2 bölümden 1 tanesi okundu')).toBeInTheDocument();
});

test('manual completion changes remain editable after restoring a saved position', async () => {
  localStorage.setItem(progressStorageKey('book'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: [] }));
  show('/book-reader/book'); await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  const first = screen.getByText('İlk Bölüm', { selector: '.chapter-title' }).closest('.chapter-item');
  fireEvent.click(first.querySelector('.chapter-checkbox'));
  expect(first).not.toHaveClass('completed');
  fireEvent.click(screen.getByRole('button', { name: 'Tamamla' }));
  expect(screen.getByText('İkinci Bölüm', { selector: '.chapter-title' }).closest('.chapter-item')).toHaveClass('completed');
});

test('a different account does not inherit another readers scoped history', async () => {
  localStorage.setItem(progressStorageKey('book', 'reader-one'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: ['first'] }));
  useAuth.mockReturnValue({ user: { id: 'reader-two' } });
  show('/book-reader/book');
  await screen.findByRole('heading', { name: 'İlk Bölüm' });
  expect(screen.getByText('2 bölümden 0 tanesi okundu')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader-one'))).lastChapterId).toBe('second');
});

test('book mode opens at the resumed chapter and page navigation updates the saved chapter', async () => {
  localStorage.setItem(progressStorageKey('book'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: [] }));
  const expanded = { ...book, chapters: [...book.chapters, { id: 'third', title: 'Üçüncü Bölüm', content: 'Üçüncü metin.' }, { id: 'fourth', title: 'Dördüncü Bölüm', content: 'Dördüncü metin.' }] };
  show('/book-reader/book', { book: expanded });
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  fireEvent.click(screen.getByRole('button', { name: 'Kitap görünümü' }));
  expect(await screen.findByText('İkinci bölümün metni.')).toBeInTheDocument();
  expect(screen.queryByText('İlk bölümün metni.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sonraki' }));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(progressStorageKey('book'))).lastChapterId).toBe('fourth'));
  fireEvent.click(screen.getByRole('button', { name: 'Kitap görünümü' }));
  expect(await screen.findByRole('heading', { name: 'Dördüncü Bölüm' })).toBeInTheDocument();
});


test('chapter mode downloads only the selected chapter after restoring the saved position', async () => {
  localStorage.setItem(progressStorageKey('book'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: [] }));
  const result = jest.fn(() => ({ data: { getReadingChapter: book.chapters[1] } }));
  show('/book-reader/book', { chapterResult: result });
  expect(await screen.findByRole('article')).toHaveTextContent(book.chapters[1].content);
  expect(result).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(book.chapters[0].content)).not.toBeInTheDocument();
});
