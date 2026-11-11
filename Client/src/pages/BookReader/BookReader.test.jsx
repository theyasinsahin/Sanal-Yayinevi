import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockedProvider } from '@apollo/client/testing';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookReader from './index';
import { GET_BOOK_READER_DATA, GET_READING_CHAPTER } from '../../graphql/queries/book';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { useAuth } from '../../context/AuthContext';
import { GET_BOOKMARK } from '../../graphql/queries/bookmark';
import { GET_READING_PROGRESS, SAVE_READING_PROGRESS } from '../../graphql/readingProgress';
import { progressStorageKey } from '../../utils/readerProgress';
import RegistrationPrompt from '../../components/Registration/RegistrationPrompt';

jest.mock('@mui/icons-material', () => Object.fromEntries(['ArrowBack', 'Check', 'AutoStories', 'ChevronLeft', 'ChevronRight', 'MenuBook'].map(name => [name, () => null])));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../hooks/useReadingTracker', () => ({ useReadingTracker: () => {} }));
jest.mock('../../components/ParagraphComment/ParagraphRenderer', () => ({ __esModule: true, default: ({ content, restoreParagraphIndex }) => <article data-restore-paragraph={restoreParagraphIndex}>{content}</article> }));
jest.mock('../../components/Quote/QuotePopup', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/Sharing/SocialShareButton', () => ({ __esModule: true, default: ({ id }) => <button data-chapter={id}>Bölümü paylaş</button> }));
jest.mock('../../utils/htmlPageSplitter', () => ({ parseContentToPages: content => [{ content }] }));

const book = { id: 'book', kind: 'DIGITAL', status: 'WRITING', publicationStatus: null, publicPath: '/kitap/roman-deniz', title: 'Kitap', authorId: null, author: null, classification: null, chapters: [
  { id: 'first', title: 'İlk Bölüm', content: 'İlk bölümün metni.' },
  { id: 'second', title: 'İkinci Bölüm', content: 'İkinci bölümün metni.' },
] };
const show = (path, options = {}) => render(<MockedProvider mocks={[
  { request: { query: GET_BOOK_READER_DATA, variables: { id: 'book' } }, result: { data: { getBookById: { ...(options.book || book), chapters: (options.book || book).chapters.map(({ content, ...chapter }) => chapter) } } } },
  ...(options.book || book).chapters.map(chapter => ({
    request: { query: GET_READING_CHAPTER, variables: { bookId: 'book', chapterId: chapter.id } },
    maxUsageCount: 10, result: options.chapterResult || { data: { getReadingChapter: chapter } },
  })),
  { request: { query: INCREMENT_BOOK_VIEW_MUTATION, variables: { id: 'book' } }, result: { data: { incrementBookViews: { id: 'book', stats: { views: 1 } } } } },
  { request: { query: GET_BOOKMARK, variables: { bookId: 'book' } }, delay: options.delay || 0, result: { data: { getBookmark: options.bookmark || null } } },
  { request: { query: GET_READING_PROGRESS, variables: { bookId: 'book' } }, delay: options.delay || 0, result: { data: { getReadingProgress: options.progress || null } } },
  { request: { query: SAVE_READING_PROGRESS }, variableMatcher: () => true, maxUsageCount: 20,
    result: variables => ({ data: { saveReadingProgress: { id: 'progress', lastChapterId: variables.chapterId, completedChapters: variables.completedChapterIds, isCompleted: false, lastReadAt: new Date().toISOString() } } }) },
]} addTypename={false}><MemoryRouter initialEntries={[path]}><RegistrationPrompt /><Routes><Route path="/book-reader/:bookId" element={<BookReader />} /><Route path="/kitap/:slug/oku" element={<BookReader resolvedId="book" />} /><Route path="/kitap/:slug/bolum/:chapterSlug" element={<BookReader resolvedId="book" resolvedChapterId="second" />} /></Routes></MemoryRouter></MockedProvider>);
beforeEach(() => { window.innerWidth = 1440; window.scrollTo = jest.fn(); localStorage.clear(); useAuth.mockReturnValue({ user: null }); });

const gatedBook = () => ({ ...book, chapters: book.chapters.map((chapter, index) => ({ ...chapter, content: index ? '' : chapter.content,
  canReadContent: index === 0, accessStatus: index ? 'REGISTRATION_REQUIRED' : 'READABLE' })) });
test('guest chapter navigation opens a dismissible registration prompt without leaving the first chapter', async () => {
  show('/book-reader/book', { book: gatedBook() });
  await screen.findByRole('heading', { name: 'İlk Bölüm' });
  fireEvent.click(screen.getByRole('button', { name: 'Tamamla ve Devam Et' }));
  expect(screen.getByRole('dialog', { name: 'Hikâyeye devam et' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ücretsiz hesap oluştur' })).toHaveAttribute('href', expect.stringContaining('chapter%3Dsecond'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'İlk Bölüm' })).toBeInTheDocument();
  expect(screen.queryByText('İkinci bölümün metni.')).not.toBeInTheDocument();
});
test('a direct locked chapter link shows an inline registration card and offers the open preview', async () => {
  show('/book-reader/book?chapter=second', { book: gatedBook() });
  expect(await screen.findByRole('heading', { name: 'Hikâyeye devam et' })).toBeInTheDocument();
  expect(screen.queryByText('Yazar bu bölümün içeriğini gizledi.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'İlk açık bölümü oku' }));
  expect(await screen.findByRole('heading', { name: 'İlk Bölüm' })).toBeInTheDocument();
});

test('mobile chapter navigation opens as a dialog, closes after selection and restores scrolling', async () => {
  window.innerWidth = 393;
  show('/book-reader/book');
  await screen.findByRole('heading', { name: 'İlk Bölüm' });
  expect(screen.queryByRole('dialog', { name: 'Kitap bölümleri' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bölümler (2)' }));
  expect(screen.getByRole('dialog', { name: 'Kitap bölümleri' })).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(screen.getByText('İkinci Bölüm', { selector: '.chapter-title' }));
  expect(await screen.findByRole('heading', { name: 'İkinci Bölüm' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog', { name: 'Kitap bölümleri' })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
});

test('the reader uses chapter navigation without a book-view control', async () => {
  window.innerWidth = 393;
  show('/book-reader/book');
  expect(await screen.findByRole('article')).toHaveTextContent('İlk bölümün metni.');
  expect(screen.queryByRole('button', { name: /Kitap görünümü/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tamamla ve Devam Et' }));
  expect(await screen.findByRole('heading', { name: 'İkinci Bölüm' })).toBeInTheDocument();
  expect(await screen.findByRole('article')).toHaveTextContent('İkinci bölümün metni.');
});

test('quote instructions explain touch selection and can be reopened after dismissal', async () => {
  show('/book-reader/book');
  expect(await screen.findByRole('complementary', { name: 'Alıntı ekleme ipucu' })).toHaveTextContent('basılı tutup');
  fireEvent.click(screen.getByRole('button', { name: 'Alıntı ipucunu kapat' }));
  expect(screen.queryByRole('complementary', { name: 'Alıntı ekleme ipucu' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Alıntı nasıl eklenir?' }));
  expect(screen.getByRole('complementary', { name: 'Alıntı ekleme ipucu' })).toBeInTheDocument();
});

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
  expect(screen.getByRole('button', { name: 'İlk Bölüm: okundu durumunu değiştir' })).toHaveClass('checked');
  expect(screen.getByRole('button', { name: 'İkinci Bölüm: okundu durumunu değiştir' })).not.toHaveClass('checked');
  expect(screen.getByText('2 bölümden 1 tanesi okundu')).toBeInTheDocument();
});

test('a shared chapter opens directly without declaring its preceding chapters read', async () => {
  show('/book-reader/book?chapter=second');
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(screen.getByRole('button', { name: 'İlk Bölüm: okundu durumunu değiştir' })).not.toHaveClass('checked');
});

test('a delayed bookmark wins over local progress and restores its paragraph without an initial overwrite', async () => {
  useAuth.mockReturnValue({ user: { id: 'reader' } });
  const original = { lastChapterId: 'first', completedChapterIds: [], updatedAt: '2026-01-01T00:00:00Z' };
  localStorage.setItem(progressStorageKey('book', 'reader'), JSON.stringify(original));
  show('/book-reader/book', { delay: 100, bookmark: { id: 'bookmark', chapterId: 'second', chapterIndex: 0, paragraphIndex: 3, chapterTitle: 'İkinci Bölüm', updatedAt: '2026-01-02T00:00:00Z' } });
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader')))).toEqual(original);
  await screen.findByRole('heading', { name: 'İkinci Bölüm' });
  expect(await screen.findByRole('article')).toHaveAttribute('data-restore-paragraph', '3');
  expect(screen.getByRole('button', { name: 'İlk Bölüm: okundu durumunu değiştir' })).toHaveClass('checked');
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
  const first = screen.getByRole('button', { name: 'İlk Bölüm: okundu durumunu değiştir' });
  fireEvent.click(first);
  expect(first).not.toHaveClass('checked');
  fireEvent.click(screen.getByRole('button', { name: 'Tamamla' }));
  expect(screen.getByRole('button', { name: 'İkinci Bölüm: okundu durumunu değiştir' })).toHaveClass('checked');
});

test('a different account does not inherit another readers scoped history', async () => {
  localStorage.setItem(progressStorageKey('book', 'reader-one'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: ['first'] }));
  useAuth.mockReturnValue({ user: { id: 'reader-two' } });
  show('/book-reader/book');
  await screen.findByRole('heading', { name: 'İlk Bölüm' });
  expect(screen.getByText('2 bölümden 0 tanesi okundu')).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader-one'))).lastChapterId).toBe('second');
});

test('chapter mode downloads only the selected chapter after restoring the saved position', async () => {
  localStorage.setItem(progressStorageKey('book'), JSON.stringify({ lastChapterId: 'second', completedChapterIds: [] }));
  const result = jest.fn(() => ({ data: { getReadingChapter: book.chapters[1] } }));
  show('/book-reader/book', { chapterResult: result });
  expect(await screen.findByRole('article')).toHaveTextContent(book.chapters[1].content);
  expect(result).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(book.chapters[0].content)).not.toBeInTheDocument();
});

test('a hidden chapter keeps its title and length but exposes no content, sharing or completion controls', async () => {
  const lockedBook = { ...book, chapters: [{ id: 'first', title: 'Gizli Bölüm', content: '', isHidden: true, canReadContent: false, wordCount: 1200, pageCount: 6 }] };
  show('/book-reader/book', { book: lockedBook });
  expect(await screen.findByRole('heading', { name: 'Gizli Bölüm' })).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Gizli bölüm' })).toHaveTextContent('1.200 kelime · 6 sayfa');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Bölümü paylaş' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Okuyuculara kapalı' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Kitaba destek ol' })).toHaveAttribute('href', '/donate/book');
  expect(screen.queryByText('İlk bölümün metni.')).not.toBeInTheDocument();
});
