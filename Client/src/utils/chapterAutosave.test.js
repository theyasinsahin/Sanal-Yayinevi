import { createChapterAutosave, AUTOSAVE_DELAY, AUTOSAVE_MAX_WAIT } from './chapterAutosave';

const chapters = [
  { id: 'a', title: 'First', content: 'original', pageCount: 1 },
  { id: 'b', title: 'Second', content: 'other', pageCount: 2 },
];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('chapter autosave data safety', () => {
  let manager, save;
  beforeEach(() => {
    jest.useFakeTimers();
    save = jest.fn().mockResolvedValue({ pageCount: 3 });
    manager = createChapterAutosave({ save });
    manager.load(chapters);
  });
  afterEach(() => { manager.stop(); jest.useRealTimers(); });

  test('loading does not write; the first edit saves after typing pauses', async () => {
    jest.advanceTimersByTime(AUTOSAVE_MAX_WAIT);
    expect(save).not.toHaveBeenCalled();
    manager.edit('first edit');
    jest.advanceTimersByTime(AUTOSAVE_DELAY - 1);
    expect(save).not.toHaveBeenCalled();
    manager.edit('latest edit');
    jest.advanceTimersByTime(AUTOSAVE_DELAY);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ chapterId: 'a', title: 'First', content: 'latest edit' });
    expect(manager.getSnapshot().status).toBe('saved');
  });

  test('continuous typing still saves within the maximum wait', async () => {
    manager.edit('0');
    for (let i = 1; i < 10; i++) { jest.advanceTimersByTime(1000); manager.edit(String(i)); }
    jest.advanceTimersByTime(1000);
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].content).toBe('9');
  });

  test('edits during a request are retained and manual flush serially drains them', async () => {
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    manager.edit('sent');
    jest.advanceTimersByTime(AUTOSAVE_DELAY);
    manager.edit('newer');
    const flush = manager.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve({ pageCount: 4 });
    await flush;
    expect(save.mock.calls.map(([input]) => input.content)).toEqual(['sent', 'newer']);
    expect(manager.getSnapshot()).toMatchObject({ content: 'newer', status: 'saved' });
  });

  test('automatic saves debounce edits made during a request', async () => {
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    manager.edit('sent');
    jest.advanceTimersByTime(AUTOSAVE_DELAY);
    manager.edit('newer');
    first.resolve({ pageCount: 4 });
    await settle();
    expect(manager.getSnapshot().status).toBe('pending');
    expect(save).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(AUTOSAVE_DELAY);
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
  });

  test('reverting before a request avoids a write; reverting during a request restores the server', async () => {
    manager.edit('temporary'); manager.edit('original');
    await manager.flush();
    expect(save).not.toHaveBeenCalled();
    const first = deferred();
    save.mockImplementationOnce(() => first.promise);
    manager.edit('sent');
    const flushing = manager.flush();
    manager.edit('original');
    expect(manager.hasUnsaved()).toBe(true);
    first.resolve({ pageCount: 2 });
    await flushing;
    expect(save.mock.calls.map(([input]) => input.content)).toEqual(['sent', 'original']);
    expect(manager.hasUnsaved()).toBe(false);
  });

  test('failure retains the draft without retry flooding; manual retry saves it', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    manager.edit('draft');
    await expect(manager.flush()).rejects.toThrow('offline');
    jest.advanceTimersByTime(AUTOSAVE_MAX_WAIT * 2);
    expect(save).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot()).toMatchObject({ content: 'draft', status: 'error', hasUnsaved: true });
    await manager.flush();
    expect(manager.getSnapshot().status).toBe('saved');
  });

  test('an ambiguous network failure still saves a subsequent revert to the original', async () => {
    save.mockRejectedValueOnce(new Error('response lost'));
    manager.edit('possibly persisted');
    await expect(manager.flush()).rejects.toThrow();
    manager.edit('original');
    expect(manager.hasUnsaved()).toBe(true);
    await manager.flush();
    expect(save.mock.calls[1][0].content).toBe('original');
  });

  test('stale refetches cannot overwrite drafts or acknowledged text and page counts', async () => {
    manager.edit('draft');
    manager.load(chapters);
    expect(manager.getSnapshot().content).toBe('draft');
    await manager.flush();
    manager.load(chapters);
    expect(manager.getSnapshot()).toMatchObject({ content: 'draft', status: 'saved' });
    expect(manager.getSnapshot().chapters[0].pageCount).toBe(3);
  });

  test('chapter changes retain separate drafts and never save text to the wrong chapter', async () => {
    manager.edit('first draft'); manager.select('b'); manager.edit('second draft');
    await manager.flush();
    expect(save.mock.calls.map(([input]) => [input.chapterId, input.content])).toEqual([
      ['a', 'first draft'], ['b', 'second draft'],
    ]);
    expect(manager.getSnapshot().content).toBe('second draft');
  });

  test('deleted chapters do not reappear on refetch or get saved again', async () => {
    manager.edit('draft'); await manager.flush(); manager.remove('a'); manager.load(chapters);
    jest.advanceTimersByTime(AUTOSAVE_MAX_WAIT); await settle();
    expect(manager.getSnapshot().chapters.map(chapter => chapter.id)).toEqual(['b']);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('clearing all text persists an empty string', async () => {
    manager.edit(''); await manager.flush();
    expect(save.mock.calls[0][0].content).toBe('');
  });
});
