import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { print } from 'graphql';
import { START_READING_SESSION, REPORT_READING_TIME } from '../graphql/mutations/score';
import { ReadingTracker } from '../utils/readingTracker';
import { API_URL } from '../config/api';
import { notifyScoreChanged } from '../utils/scoreUpdates';
const closingSessions = new Map();

async function withTimeout(operation) {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10000);
  try { return await operation(abort.signal); }
  finally { clearTimeout(timeout); }
}
const requestWithTimeout = (mutate, variables) => withTimeout(signal => mutate({ variables, context: { fetchOptions: { signal } } }));

function readingError(error) {
  const code = error.graphQLErrors?.[0]?.extensions?.code || error.extensions?.code;
  error.terminal = ['READING_SESSION_EXPIRED', 'READING_SESSION_REPLACED', 'BAD_USER_INPUT', 'UNAUTHENTICATED'].includes(code);
  error.replaced = code === 'READING_SESSION_REPLACED';
  return error;
}

export const useReadingTracker = ({ isActive, userId, bookId, chapterId, onIdleWarning, onIdleResume }) => {
  const [startSession] = useMutation(START_READING_SESSION);
  const [reportTime] = useMutation(REPORT_READING_TIME);
  const [status, setStatus] = useState('inactive');
  const callbacks = useRef({});
  callbacks.current = { chapterId, onIdleWarning, onIdleResume };
  useEffect(() => {
    if (!isActive || !userId || !bookId) { setStatus('inactive'); return undefined; }
    let mounted = true;
    let ready = false;
    const controller = new ReadingTracker({ userId, bookId, chapter: () => callbacks.current.chapterId,
      storage: { get length() { try { return localStorage.length; } catch { return 0; } }, key: i => localStorage.key(i), getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) },
      onStatus: value => { if (mounted) setStatus(value); },
      start: async (id, chapter) => (await requestWithTimeout(startSession, { bookId: id, chapterId: chapter })).data.startReadingSession.sessionId,
      report: async (variables, keepalive) => {
        try {
          let result;
          if (keepalive) {
            result = await withTimeout(async signal => {
              const response = await fetch(API_URL, { method: 'POST', keepalive: true, signal,
                headers: { 'Content-Type': 'application/json', authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: JSON.stringify({ query: print(REPORT_READING_TIME), variables }),
              });
              if (!response.ok) throw new Error('Okuma kaydı gönderilemedi.');
              return response.json();
            });
            if (result.errors?.length) throw Object.assign(new Error(result.errors[0].message), result.errors[0]);
          } else result = await requestWithTimeout(reportTime, variables);
          if (!result.data?.reportReadingTime) throw new Error('Okuma kaydı doğrulanamadı.');
          if (result.data.reportReadingTime.earnedPoints) notifyScoreChanged();
          return result.data.reportReadingTime;
        } catch (error) { throw readingError(error); }
      },
    });
    let warned = false;
    const activity = () => {
      controller.activity();
      if (warned) { warned = false; callbacks.current.onIdleResume?.(); }
    };
    const timer = setInterval(() => {
      const visible = document.visibilityState !== 'hidden';
      controller.tick(visible);
      if (visible && !warned && Date.now() - controller.lastActivity >= 90000) { warned = true; callbacks.current.onIdleWarning?.(); }
    }, 1000);
    const saver = setInterval(() => { if (ready && document.visibilityState !== 'hidden') controller.flush(); }, 15000);
    const visibility = () => {
      controller.tick(false);
      if (document.visibilityState === 'hidden') controller.flush(true);
      else { activity(); if (ready) controller.flush(); }
    };
    const leave = () => { controller.tick(false); controller.flush(true); };
    const online = () => { if (ready && document.visibilityState !== 'hidden') controller.flush(); };
    const events = ['scroll', 'click', 'touchstart', 'keydown', 'pointerdown'];
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', leave); window.addEventListener('online', online);
    const starter = setTimeout(async () => {
      await closingSessions.get(userId);
      if (!mounted) return;
      ready = true;
      if (document.visibilityState !== 'hidden') controller.flush();
    }, 0);
    return () => {
      mounted = false;
      clearTimeout(starter);
      clearInterval(timer); clearInterval(saver);
      events.forEach(event => window.removeEventListener(event, activity));
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave); window.removeEventListener('online', online);
      closingSessions.set(userId, controller.stop().catch(() => {}));
    };
  }, [isActive, userId, bookId, startSession, reportTime]);
  return status;
};
