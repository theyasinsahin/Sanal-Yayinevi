import { act, renderHook } from '@testing-library/react';
import useChapterAutosave from './useChapterAutosave';

const settle = async () => { await act(async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); }); };

describe('autosave browser lifecycle', () => {
  let save;
  beforeEach(() => { jest.useFakeTimers(); save = jest.fn().mockResolvedValue({ pageCount: 1 }); });
  afterEach(() => jest.useRealTimers());
  const start = () => {
    const utils = renderHook(() => useChapterAutosave({ bookId: 'book', save }));
    act(() => utils.result.current.manager.load([{ id: 'chapter', title: 'Title', content: 'original' }]));
    return utils;
  };

  test('online retries failed drafts and clears the error', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    const { result, unmount } = start();
    act(() => result.current.manager.edit('draft'));
    await act(async () => { jest.advanceTimersByTime(1500); });
    expect(result.current.status).toBe('error');
    act(() => window.dispatchEvent(new Event('online'))); await settle();
    expect(result.current.status).toBe('saved');
    expect(save).toHaveBeenCalledTimes(2);
    unmount();
  });

  test('closing with pending edits requests browser confirmation and starts saving', async () => {
    const { result, unmount } = start();
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    act(() => result.current.manager.edit('draft'));
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    act(() => window.dispatchEvent(dirtyEvent));
    expect(dirtyEvent.defaultPrevented).toBe(true);
    await settle();
    expect(save.mock.calls[0][0].content).toBe('draft');
    unmount();
  });

  test('hiding the page saves immediately and unmount removes browser listeners', async () => {
    const { result, unmount } = start();
    act(() => result.current.manager.edit('draft'));
    const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await settle();
    expect(save).toHaveBeenCalledTimes(1);
    unmount();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    visibility.mockRestore();
  });

  test('unmount flushes pending text instead of silently cancelling the debounce', async () => {
    const { result, unmount } = start();
    act(() => result.current.manager.edit('last draft'));
    unmount(); await settle();
    expect(save.mock.calls[0][0].content).toBe('last draft');
  });
});
