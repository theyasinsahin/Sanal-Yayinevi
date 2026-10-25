import { progressStorageKey, readLocalProgress, resolveReaderProgress, ProgressWriter } from './readerProgress';
const chapters = ['first', 'second', 'third', 'fourth'].map(id => ({ id }));
const resolve = options => resolveReaderProgress({ chapters, ...options });

test('a bookmark opens its actual chapter and adds all earlier chapters to completed IDs', () => {
  expect(resolve({ bookmark: { chapterId: 'third', chapterIndex: 0, paragraphIndex: 4 } })).toMatchObject({ chapterId: 'third', completedChapterIds: ['first', 'second'], paragraphIndex: 4, source: 'bookmark' });
});

test('explicit chapter links override bookmarks and do not imply reading the earlier chapters', () => {
  expect(resolve({ requestedChapterId: 'fourth', bookmark: { chapterId: 'third', paragraphIndex: 1 } })).toMatchObject({ chapterId: 'fourth', completedChapterIds: [], paragraphIndex: null, source: 'link' });
});

test('chapter IDs remain correct when chapters are reordered or removed', () => {
  const reordered = [chapters[2], chapters[0], chapters[3]];
  const result = resolveReaderProgress({ chapters: reordered, local: { lastChapterId: 'fourth', completedChapterIds: ['second'] } });
  expect(result.chapterId).toBe('fourth'); expect(result.completedChapterIds).toEqual(['third', 'first']);
});

test('a removed marker falls back to progress instead of trusting its obsolete index', () => {
  expect(resolve({ bookmark: { chapterId: 'deleted', chapterIndex: 3 }, server: { lastChapterId: 'second', completedChapters: [] } })).toMatchObject({ chapterId: 'second', source: 'progress', completedChapterIds: ['first'] });
});

test('newer server data wins over synchronized local data, but unsent local changes remain recoverable', () => {
  const local = { lastChapterId: 'third', completedChapterIds: [], updatedAt: '2026-01-01T00:00:00Z' };
  const server = { lastChapterId: 'second', completedChapters: [], lastReadAt: '2026-02-01T00:00:00Z' };
  expect(resolve({ local, server }).chapterId).toBe('second');
  expect(resolve({ local: { ...local, pending: true }, server }).chapterId).toBe('third');
});

test('legacy index positions migrate, and invalid completion indices are discarded', () => {
  expect(resolve({ local: { lastChapter: 2, completed: [0, 99, -1, 'bad'] } })).toMatchObject({ chapterId: 'third', completedChapterIds: ['first', 'second'] });
});

test('legacy server histories without a position continue from the first unfinished chapter', () => {
  expect(resolve({ server: { completedChapters: ['first', 'second'] } }).chapterId).toBe('third');
  expect(resolve({ server: { completedChapters: chapters.map(chapter => chapter.id) } }).chapterId).toBe('fourth');
});

test('missing shared chapters and an empty book have safe fallbacks', () => {
  expect(resolve({ requestedChapterId: 'deleted' })).toMatchObject({ chapterId: 'first', missingSharedChapter: true });
  expect(resolveReaderProgress({ chapters: [] })).toMatchObject({ chapterId: null, completedChapterIds: [] });
});

test('local records are scoped by account and legacy records are adopted only once', () => {
  localStorage.clear(); localStorage.setItem('book-progress-book', JSON.stringify({ lastChapter: 2 }));
  expect(readLocalProgress(localStorage, 'book', 'reader')).toEqual({ lastChapter: 2 });
  expect(localStorage.getItem('book-progress-book')).toBeNull();
  expect(readLocalProgress(localStorage, 'book', 'other')).toBeNull();
  expect(localStorage.getItem(progressStorageKey('book', 'reader'))).toBeTruthy();
});

test('malformed storage does not crash resume selection', () => {
  localStorage.clear(); localStorage.setItem(progressStorageKey('book'), '{invalid');
  expect(readLocalProgress(localStorage, 'book')).toBeNull();
});

test('slow progress writes are serialized so the final position stays the latest choice', async () => {
  let finish;
  const save = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({});
  const writer = new ProgressWriter({ save });
  writer.enqueue({ chapterId: 'first' }); const first = writer.flush();
  writer.enqueue({ chapterId: 'third' }); const latest = writer.flush();
  expect(save).toHaveBeenCalledTimes(1); finish(); await Promise.all([first, latest]);
  expect(save.mock.calls.map(([variables]) => variables.chapterId)).toEqual(['first', 'third']);
  await writer.flush(); expect(save).toHaveBeenCalledTimes(2);
});

test('a failed progress save keeps the latest snapshot available for an explicit retry', async () => {
  const save = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({});
  const status = jest.fn(); const writer = new ProgressWriter({ save, onStatus: status });
  writer.enqueue({ chapterId: 'third' }); await writer.flush();
  expect(status).toHaveBeenCalledWith('error');
  await writer.flush(true); expect(save.mock.calls[1]).toEqual([{ chapterId: 'third' }, true]);
  expect(status).toHaveBeenLastCalledWith('saved');
});
