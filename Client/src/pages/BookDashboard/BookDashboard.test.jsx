import React from 'react';
import 'whatwg-fetch';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import BookDashboard from './index';
import { UPDATE_BOOK_STATUS_MUTATION } from '../../graphql/mutations/book';
import { CREATE_CHAPTER_MUTATION, UPDATE_CHAPTER_MUTATION, SET_CHAPTER_VISIBILITY } from '../../graphql/mutations/chapter';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: jest.fn(), useMutation: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
jest.mock('@mui/icons-material', () => {
  const icon = () => null;
  return Object.fromEntries(['Add', 'Save', 'FolderOpen', 'MenuOpen', 'Close', 'Visibility', 'Delete', 'ArrowBack', 'CheckCircle', 'Error', 'Info', 'Warning'].map(name => [name, icon]));
});
jest.mock('react-quill', () => function Editor({ value, onChange, readOnly }) {
  return <textarea aria-label="Editor" value={value} readOnly={readOnly} onChange={event => onChange(event.target.value, {}, 'user')} />;
});
jest.mock('../../utils/htmlPageSplitter', () => ({ parseContentToPages: content => Array(content ? 3 : 0).fill('page') }));
jest.mock('../../components/Books/CostCalculatorModal', () => ({ CostCalculatorModal: ({ pageCount }) => <div data-testid="cost-pages">{pageCount}</div> }));

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { await act(async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); }); };
const edit = value => fireEvent.change(screen.getByLabelText('Editor'), { target: { value } });

describe('book editor autosave integration', () => {
  let book, save, add, remove, status, visibility, router;
  beforeEach(() => {
    jest.useFakeTimers();
    window.scrollTo = jest.fn();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    book = { id: 'book', title: 'Book', status: 'DRAFT', chapters: [
      { id: 'a', title: 'First', content: 'original', pageCount: 1 },
      { id: 'b', title: 'Second', content: 'other', pageCount: 2 },
    ] };
    save = jest.fn().mockResolvedValue({ data: { updateChapter: { id: 'a', pageCount: 3 } } });
    add = jest.fn().mockResolvedValue({ data: {} });
    remove = jest.fn().mockResolvedValue({ data: {} });
    status = jest.fn().mockResolvedValue({ data: {} });
    visibility = jest.fn().mockImplementation(async ({ variables }) => {
      book = { ...book, chapters: book.chapters.map(chapter => chapter.id === variables.chapterId ? { ...chapter, isHidden: variables.isHidden } : chapter) };
      return { data: { updateChapter: { id: variables.chapterId, isHidden: variables.isHidden } } };
    });
    useQuery.mockImplementation(() => ({ data: { getBookById: book }, loading: false }));
    useMutation.mockImplementation(document => [document === SET_CHAPTER_VISIBILITY ? visibility : document === UPDATE_CHAPTER_MUTATION ? save : document === UPDATE_BOOK_STATUS_MUTATION ? status : document === CREATE_CHAPTER_MUTATION ? add : remove, { loading: false }]);
    router = createMemoryRouter([
      { path: '/write/:bookId', element: <BookDashboard /> },
      { path: '/profile', element: <div>Profile destination</div> },
      { path: '/book-reader/:bookId', element: <div>Reader destination</div> },
      { path: '/print/:bookId', element: <div>Print application destination</div> },
    ], { initialEntries: ['/write/book'] });
  });
  afterEach(async () => { cleanup(); await settle(); router.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

  test('hiding a chapter waits for pending text to save and preserves the editor draft', async () => {
    const pending = deferred(); save.mockReturnValueOnce(pending.promise);
    render(<RouterProvider router={router} />);
    edit('private draft');
    fireEvent.click(screen.getByRole('button', { name: 'Okuyuculardan gizle' }));
    expect(save).toHaveBeenCalled();
    expect(visibility).not.toHaveBeenCalled();
    pending.resolve({ data: { updateChapter: { id: 'a', pageCount: 3 } } });
    await settle();
    expect(visibility).toHaveBeenCalledWith({ variables: { chapterId: 'a', isHidden: true } });
    expect(screen.getByLabelText('Editor')).toHaveValue('private draft');
    expect(screen.getByRole('button', { name: 'Okuyuculara aç' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('new chapters can be created hidden before any content is written', async () => {
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByPlaceholderText('Yeni Bölüm...'), { target: { value: 'Private chapter' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Yeni bölümü gizli oluştur' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));
    await settle();
    expect(add).toHaveBeenCalledWith({ variables: { bookId: 'book', title: 'Private chapter', content: '', userId: 'owner', isHidden: true } });
  });

  test('first user change autosaves and the manual button retains its layout class', async () => {
    render(<RouterProvider router={router} />);
    const button = screen.getByRole('button', { name: 'Bölümü kaydet' });
    expect(button).toHaveClass('dashboard-save-button');
    expect(button).toBeDisabled();
    edit('new text');
    expect(button).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Otomatik kayıt');
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(save).toHaveBeenCalledWith({ variables: { chapterId: 'a', content: 'new text', pageCount: 3 } });
    expect(screen.getByRole('status')).toHaveTextContent('Kaydedildi');
  });

  test('manual save bypasses the debounce', async () => {
    render(<RouterProvider router={router} />);
    edit('manual');
    fireEvent.click(screen.getByRole('button', { name: 'Bölümü kaydet' }));
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].variables.content).toBe('manual');
  });

  test('switching chapters waits for the previous text to finish saving', async () => {
    const pending = deferred(); save.mockReturnValueOnce(pending.promise);
    render(<RouterProvider router={router} />);
    edit('first draft'); fireEvent.click(screen.getByText('Second'));
    expect(screen.getByLabelText('Editor')).toHaveValue('first draft');
    expect(screen.getByLabelText('Editor')).toHaveAttribute('readonly');
    await act(async () => pending.resolve({ data: { updateChapter: { pageCount: 3 } } }));
    expect(screen.getByLabelText('Editor')).toHaveValue('other');
    edit('second draft');
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(save.mock.calls.map(([call]) => call.variables.chapterId)).toEqual(['a', 'b']);
  });

  test('failed autosave preserves the text, blocks chapter switching and permits retry', async () => {
    save.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    render(<RouterProvider router={router} />);
    edit('keep me');
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilemedi');
    fireEvent.click(screen.getByText('Second')); await settle();
    expect(screen.getByLabelText('Editor')).toHaveValue('keep me');
    fireEvent.click(screen.getByRole('button', { name: 'Bölümü kaydet' })); await settle();
    expect(screen.getByRole('status')).toHaveTextContent('Kaydedildi');
  });

  test('publishing happens only after the current chapter is saved', async () => {
    const pending = deferred(); save.mockReturnValueOnce(pending.promise);
    render(<RouterProvider router={router} />);
    edit('publish text'); fireEvent.click(screen.getByRole('button', { name: /Yayınla/ }));
    expect(status).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ data: { updateChapter: { pageCount: 3 } } }));
    expect(status).toHaveBeenCalledWith({ variables: { bookId: 'book', status: 'WRITING' } });
  });

  test('adding a chapter saves first and stale query text does not replace the editor draft', async () => {
    render(<RouterProvider router={router} />);
    edit('retained text');
    fireEvent.change(screen.getByPlaceholderText('Yeni Bölüm...'), { target: { value: 'Third' } });
    fireEvent.click(screen.getByRole('button', { name: /Ekle/ })); await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledTimes(1);
    book = { ...book, chapters: [...book.chapters, { id: 'c', title: 'Third', content: '', pageCount: 0 }] };
    edit('retained newer text'); await settle();
    expect(screen.getByLabelText('Editor')).toHaveValue('retained newer text');
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  test('deleting a chapter waits for the pending save and removes the editor', async () => {
    const pending = deferred(); save.mockReturnValueOnce(pending.promise);
    render(<RouterProvider router={router} />);
    edit('last text'); fireEvent.click(screen.getByRole('button', { name: 'First bölümünü sil' }));
    expect(remove).not.toHaveBeenCalled();
    await act(async () => pending.resolve({ data: { updateChapter: { pageCount: 3 } } }));
    expect(remove).toHaveBeenCalledWith({ variables: { id: 'a' } });
    expect(screen.queryByLabelText('Editor')).not.toBeInTheDocument();
  });

  test('internal navigation waits for saving before leaving the editor', async () => {
    const pending = deferred(); save.mockReturnValueOnce(pending.promise);
    render(<RouterProvider router={router} />);
    edit('before leaving'); fireEvent.click(screen.getByRole('link', { name: /Okuyucu Modu/ }));
    expect(screen.queryByText('Reader destination')).not.toBeInTheDocument();
    await act(async () => pending.resolve({ data: { updateChapter: { pageCount: 3 } } }));
    expect(screen.getByText('Reader destination')).toBeInTheDocument();
  });

  test('failed navigation can be cancelled without losing the draft', async () => {
    window.confirm.mockReturnValue(false);
    save.mockRejectedValue(new Error('offline'));
    render(<RouterProvider router={router} />);
    edit('stay here'); fireEvent.click(screen.getByRole('link', { name: /Okuyucu Modu/ })); await settle();
    expect(screen.getByLabelText('Editor')).toHaveValue('stay here');
    expect(screen.getByLabelText('Editor')).not.toHaveAttribute('readonly');
    expect(screen.queryByText('Reader destination')).not.toBeInTheDocument();
    save.mockResolvedValue({ data: { updateChapter: { pageCount: 3 } } });
  });

  test('print application navigation flushes the final manuscript and never opens funding', async () => {
    book.status = 'COMPLETED';
    render(<RouterProvider router={router} />);
    edit('longer text'); fireEvent.click(screen.getByRole('button', { name: /Basım İçin Başvur/ })); await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Print application destination')).toBeInTheDocument();
    expect(status).not.toHaveBeenCalled();
  });
});
