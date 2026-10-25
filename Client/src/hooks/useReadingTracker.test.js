import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useMutation } from '@apollo/client';
import { useReadingTracker } from './useReadingTracker';
import { START_READING_SESSION, REPORT_READING_TIME } from '../graphql/mutations/score';

jest.mock('@apollo/client', () => ({ ...jest.requireActual('@apollo/client'), useMutation: jest.fn() }));
let start, report;
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  start = jest.fn().mockResolvedValue({ data: { startReadingSession: { sessionId: 'token' } } });
  report = jest.fn().mockResolvedValue({ data: { reportReadingTime: { sequence: 1, acceptedSeconds: 15, earnedPoints: 0, score: { id: 'score', totalPoints: 0 } } } });
  useMutation.mockImplementation(query => [query === START_READING_SESSION ? start : report]);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { reportReadingTime: { sequence: 1, acceptedSeconds: 10, earnedPoints: 0 } } }) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const advance = async ms => { await act(async () => { jest.advanceTimersByTime(ms); for (let i = 0; i < 10; i++) await Promise.resolve(); }); };
const show = (active = true, wrapper) => renderHook(() => useReadingTracker({ isActive: active, userId: 'reader', bookId: 'book', chapterId: 'chapter', onIdleWarning: () => {}, onIdleResume: () => {} }), { wrapper });

test('React rerenders with inline callbacks do not cancel the heartbeat', async () => {
  const hook = show(); await advance(0); await advance(5000); hook.rerender(); await advance(10000);
  expect(start).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ variables: { sessionId: 'token', sequence: 1, seconds: 15, chapterId: 'chapter' } }));
  hook.unmount();
});

test('Strict Mode does not create two competing sessions', async () => {
  const hook = show(true, ({ children }) => <React.StrictMode>{children}</React.StrictMode>);
  await advance(0); await advance(15000);
  expect(start).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledTimes(1);
  hook.unmount();
});

test('a hidden tab does not submit reading seconds', async () => {
  const hook = show(); await advance(0);
  jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await advance(60000);
  expect(report).not.toHaveBeenCalled();
  hook.unmount();
});

test('inactive readers do not start sessions', async () => {
  const hook = show(false); await advance(60000);
  expect(start).not.toHaveBeenCalled(); expect(report).not.toHaveBeenCalled();
  hook.unmount();
});

test('leaving the reader saves a partial minute with an authenticated keepalive request', async () => {
  localStorage.setItem('token', 'test-token');
  const hook = show(); await advance(0); await advance(10000); hook.unmount(); await advance(0);
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ keepalive: true, headers: expect.objectContaining({ authorization: 'Bearer test-token' }) }));
  expect(JSON.parse(fetch.mock.calls[0][1].body).variables).toMatchObject({ seconds: 10, sequence: 1 });
});

test('changing chapters keeps the session and sends the new chapter ID', async () => {
  const hook = renderHook(({ chapterId }) => useReadingTracker({ isActive: true, userId: 'reader', bookId: 'book', chapterId }), { initialProps: { chapterId: 'first' } });
  await advance(0); await advance(15000);
  hook.rerender({ chapterId: 'second' }); await advance(15000);
  expect(start).toHaveBeenCalledTimes(1);
  expect(report.mock.calls.map(([request]) => [request.variables.sequence, request.variables.chapterId])).toEqual([[1, 'first'], [2, 'second']]);
  hook.unmount();
});
