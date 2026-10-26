import { act, renderHook } from '@testing-library/react';
import { useQuery } from '@apollo/client';
import { useReaderProgress } from './useReaderProgress';
import { progressStorageKey } from '../utils/readerProgress';
jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useQuery: jest.fn() }));
const chapters = ['first', 'second', 'third'].map(id => ({ id }));
let result;
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear(); localStorage.setItem('token', 'reader-token');
  result = { loading: false, data: { getReadingProgress: null }, refetch: jest.fn().mockResolvedValue({}) };
  useQuery.mockImplementation(() => result);
  global.fetch = jest.fn().mockImplementation(async (_, options) => {
    const variables = JSON.parse(options.body).variables;
    return { ok: true, json: async () => ({ data: { saveReadingProgress: { id: 'progress', lastChapterId: variables.chapterId, completedChapters: variables.completedChapterIds, lastReadAt: '2026-03-01T00:00:00Z', isCompleted: false } } }) };
  });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const show = extra => renderHook(() => useReaderProgress({ bookId: 'book', userId: 'reader', chapters, bookLoading: false, bookmarkLoading: false, ...extra }));
const settle = async (ms = 0) => { await act(async () => { jest.advanceTimersByTime(ms); for (let i = 0; i < 10; i++) await Promise.resolve(); }); };

test('hydration waits for the server and does not overwrite a valid local position with chapter zero', async () => {
  const original = { lastChapterId: 'second', completedChapterIds: [], updatedAt: '2026-01-01T00:00:00Z' };
  localStorage.setItem(progressStorageKey('book', 'reader'), JSON.stringify(original));
  result.loading = true;
  const hook = show(); await settle(1000);
  expect(hook.result.current.ready).toBe(false); expect(fetch).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader')))).toEqual(original);
  result = { ...result, loading: false, data: { getReadingProgress: { lastChapterId: 'third', completedChapters: [], lastReadAt: '2026-02-01T00:00:00Z' } } };
  hook.rerender(); await settle(250);
  expect(hook.result.current.currentChapterIndex).toBe(2);
  expect(JSON.parse(fetch.mock.calls[0][1].body).variables).toEqual({ bookId: 'book', chapterId: 'third', completedChapterIds: ['first', 'second'] });
  hook.unmount();
});

test('a failed initial query allows local reading without replacing an unknown server position', async () => {
  result.error = new Error('offline');
  const hook = show(); await settle(1000);
  expect(hook.result.current.ready).toBe(true); expect(hook.result.current.syncError).toBe(true);
  expect(fetch).not.toHaveBeenCalled(); expect(localStorage.getItem(progressStorageKey('book', 'reader'))).toBeNull();
  result = { ...result, error: null, data: { getReadingProgress: { lastChapterId: 'third', completedChapters: [], lastReadAt: '2026-02-01T00:00:00Z' } } };
  hook.rerender(); await settle(250);
  expect(hook.result.current.currentChapterIndex).toBe(2);
  expect(JSON.parse(fetch.mock.calls[0][1].body).variables.chapterId).toBe('third');
  hook.unmount();
});

test('failed writes remain pending locally and an explicit retry clears the pending flag', async () => {
  fetch.mockRejectedValueOnce(new Error('offline'));
  const hook = show(); await settle(250);
  expect(hook.result.current.syncError).toBe(true);
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader'))).pending).toBe(true);
  await act(async () => { await hook.result.current.retry(); });
  expect(hook.result.current.syncError).toBe(false);
  expect(JSON.parse(localStorage.getItem(progressStorageKey('book', 'reader'))).pending).toBe(false);
  hook.unmount();
});

test('an account switch cannot change the credentials of an outgoing progress save', async () => {
  const hook = show();
  act(() => hook.result.current.setCurrentChapterIndex(2));
  localStorage.setItem('token', 'other-account-token');
  hook.unmount(); await settle();
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ keepalive: true, headers: expect.objectContaining({ authorization: 'Bearer reader-token' }) }));
});
