import { ReadingTracker } from './readingTracker';

let now, start, report, status;
beforeEach(() => {
  now = 1000000; localStorage.clear();
  start = jest.fn().mockResolvedValue('session-one');
  report = jest.fn().mockResolvedValue({ acceptedSeconds: 15 });
  status = jest.fn();
});
const make = (userId = 'reader') => new ReadingTracker({ userId, bookId: 'book', chapter: () => 'chapter', start, report, storage: localStorage, now: () => now, onStatus: status });
const tick = (tracker, seconds, visible = true) => { for (let i = 0; i < seconds; i++) { now += 1000; tracker.tick(visible); } };

test('fractional minutes are sent as seconds and retained on the server across navigation', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 29); await tracker.stop();
  expect(report).toHaveBeenCalledWith({ sessionId: 'session-one', sequence: 1, seconds: 29, chapterId: 'chapter' }, true);
});

test('a slow request never includes its already submitted seconds in the next packet', async () => {
  let complete;
  report.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const tracker = make(); await tracker.flush(); tick(tracker, 15);
  const first = tracker.flush(); tick(tracker, 15);
  const second = tracker.flush();
  expect(report).toHaveBeenCalledTimes(1);
  complete({ acceptedSeconds: 15 }); await Promise.all([first, second]);
  expect(report.mock.calls.map(([packet]) => [packet.sequence, packet.seconds])).toEqual([[1, 15], [2, 15]]);
});

test('failed packets keep the same sequence and are saved before a retry', async () => {
  report.mockRejectedValueOnce(new Error('offline'));
  const tracker = make(); await tracker.flush(); tick(tracker, 15); await tracker.flush();
  const saved = JSON.parse(localStorage.getItem(tracker.key()));
  expect(saved.pending).toMatchObject({ sequence: 1, seconds: 15 });
  tick(tracker, 10); await tracker.flush();
  expect(report.mock.calls.map(([packet]) => [packet.sequence, packet.seconds])).toEqual([[1, 15], [1, 15], [2, 10]]);
  expect(tracker.pending).toBeNull();
});

test('interrupted packets are recovered before a fresh session is opened', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 12);
  report.mockRejectedValueOnce(new Error('offline')); await tracker.flush();
  const recovered = make(); await recovered.flush();
  expect(report.mock.calls.map(([packet]) => packet)).toEqual([expect.objectContaining({ sequence: 1, seconds: 12 }), expect.objectContaining({ sequence: 1, seconds: 12 })]);
  expect(start).toHaveBeenCalledTimes(2);
  expect(report.mock.invocationCallOrder[1]).toBeLessThan(start.mock.invocationCallOrder[1]);
});

test('hidden tabs and suspended timers do not count as active reading', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 40, false);
  now += 60000; tracker.tick(true); await tracker.flush();
  expect(report).not.toHaveBeenCalled();
  tracker.activity(); tick(tracker, 15); await tracker.flush();
  expect(report.mock.calls[0][0].seconds).toBe(15);
});

test('idle reading stops at two minutes and user interaction resumes it', async () => {
  const tracker = make(); await tracker.flush();
  for (let i = 0; i < 12; i++) { tick(tracker, 15); await tracker.flush(); }
  expect(report.mock.calls.reduce((sum, [packet]) => sum + packet.seconds, 0)).toBe(120);
  tracker.activity(); tick(tracker, 10); await tracker.flush();
  expect(report.mock.calls.reduce((sum, [packet]) => sum + packet.seconds, 0)).toBe(130);
});

test('a replaced session stops instead of competing with another tab', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 15);
  report.mockRejectedValueOnce(Object.assign(new Error('replaced'), { terminal: true, replaced: true }));
  await tracker.flush(); tick(tracker, 30); await tracker.flush();
  expect(start).toHaveBeenCalledTimes(1);
  expect(status).toHaveBeenCalledWith('paused');
  expect(tracker.queueMs).toBe(0);
});

test('another user cannot recover a previous account reading packet', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 10);
  report.mockRejectedValueOnce(new Error('offline')); await tracker.flush(); report.mockClear();
  const other = make('other'); await other.flush();
  expect(report).not.toHaveBeenCalled();
});

test('page close replays the in-flight packet without assigning a new sequence', async () => {
  let complete;
  report.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const tracker = make(); await tracker.flush(); tick(tracker, 15);
  const first = tracker.flush(); const closing = tracker.stop();
  expect(report.mock.calls[1]).toEqual([report.mock.calls[0][0], true]);
  complete({ acceptedSeconds: 15 }); await Promise.all([first, closing]);
  expect(tracker.sequence).toBe(1);
});

test('returning after a long break renews an empty session before counting fresh reading', async () => {
  const tracker = make(); await tracker.flush(); tick(tracker, 15); await tracker.flush();
  tick(tracker, 180, false); tracker.activity();
  await Promise.resolve(); await Promise.resolve();
  expect(start).toHaveBeenCalledTimes(2);
  tick(tracker, 15); await tracker.flush();
  expect(report.mock.calls.at(-1)[0]).toMatchObject({ sequence: 1, seconds: 15 });
});

test('idle heartbeats do not renew the session and restart reading by themselves', async () => {
  const tracker = make(); await tracker.flush();
  for (let i = 0; i < 40; i++) { tick(tracker, 15); await tracker.flush(); }
  expect(start).toHaveBeenCalledTimes(1);
  expect(report.mock.calls.reduce((sum, [packet]) => sum + packet.seconds, 0)).toBe(120);
});
