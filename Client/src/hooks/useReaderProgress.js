import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client';
import { print } from 'graphql';
import { GET_READING_PROGRESS, SAVE_READING_PROGRESS } from '../graphql/readingProgress';
import { progressStorageKey, ProgressWriter, readLocalProgress, resolveReaderProgress } from '../utils/readerProgress';
import { API_URL } from '../config/api';

export function useReaderProgress({ bookId, userId, chapters, bookLoading, bookmark, bookmarkLoading, bookmarkError, refetchBookmark, requestedChapterId }) {
  const scope = `${userId || 'guest'}:${bookId}`;
  const selectionKey = `${scope}:${requestedChapterId || ''}`;
  const { data, loading, error, refetch } = useQuery(GET_READING_PROGRESS, { variables: { bookId }, skip: !userId || !bookId, fetchPolicy: 'no-cache', context: { queryDeduplication: false } });
  const [state, setState] = useState({ key: null, completedChapterIds: [], chapterId: null });
  const [syncStatus, setSyncStatus] = useState('saved');
  const writerRef = useRef(null);
  const hasError = Boolean(error || bookmarkError);
  const ready = state.key === selectionKey;

  useEffect(() => {
    if (!bookId || bookLoading || (userId && (loading || bookmarkLoading))) return;
    if (state.key === selectionKey && !(state.fallback && !state.dirty && !hasError)) return;
    let local = null;
    try { local = readLocalProgress(localStorage, bookId, userId); } catch { /* Server progress still works without browser storage. */ }
    const resolved = resolveReaderProgress({ chapters, bookmark, local, server: data?.getReadingProgress, requestedChapterId });
    setState({ ...resolved, key: selectionKey, fallback: hasError, dirty: false });
  }, [bookId, userId, bookLoading, loading, bookmarkLoading, bookmark, chapters, data, requestedChapterId, selectionKey, state.key, state.fallback, state.dirty, hasError]);

  useEffect(() => {
    if (!userId || !bookId) return undefined;
    let mounted = true;
    let token = null;
    try { token = localStorage.getItem('token'); } catch { /* No browser credentials are available. */ }
    const writer = new ProgressWriter({ onStatus: status => { if (mounted) setSyncStatus(status); },
      save: async (variables, keepalive) => {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10000);
        try {
          const response = await fetch(API_URL, { method: 'POST', keepalive, signal: abort.signal,
            headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token || ''}` },
            body: JSON.stringify({ query: print(SAVE_READING_PROGRESS), variables }),
          });
          if (!response.ok) throw new Error('İlerleme kaydedilemedi.');
          const result = await response.json();
          if (result.errors?.length || !result.data?.saveReadingProgress) throw new Error('İlerleme kaydedilemedi.');
          const progress = result.data.saveReadingProgress;
          try {
            const key = progressStorageKey(bookId, userId);
            const local = JSON.parse(localStorage.getItem(key) || 'null');
            if (local?.lastChapterId === variables.chapterId && JSON.stringify(local.completedChapterIds) === JSON.stringify(variables.completedChapterIds)) {
              localStorage.setItem(key, JSON.stringify({ ...local, pending: false, updatedAt: progress.lastReadAt }));
            }
          } catch { /* Browser storage is optional. */ }
        } finally { clearTimeout(timeout); }
      },
    });
    writerRef.current = writer;
    const leave = () => writer.flush(true);
    window.addEventListener('pagehide', leave);
    return () => { mounted = false; window.removeEventListener('pagehide', leave); writer.flush(true); if (writerRef.current === writer) writerRef.current = null; };
  }, [userId, bookId]);

  useEffect(() => {
    if (!ready || !state.chapterId || (state.fallback && !state.dirty)) return undefined;
    const completedChapterIds = chapters.filter(chapter => chapter.canReadContent !== false && state.completedChapterIds.includes(chapter.id)).map(chapter => chapter.id);
    try { localStorage.setItem(progressStorageKey(bookId, userId), JSON.stringify({ version: 2, lastChapterId: state.chapterId, completedChapterIds, pending: Boolean(userId), updatedAt: new Date().toISOString() })); }
    catch { /* Server sync still works when browser storage is disabled. */ }
    if (!userId) return undefined;
    const writer = writerRef.current;
    writer?.enqueue({ bookId, chapterId: state.chapterId, completedChapterIds });
    if (hasError) return undefined;
    const timeout = setTimeout(() => writer?.flush(), 250);
    return () => clearTimeout(timeout);
  }, [ready, state.chapterId, state.completedChapterIds, state.fallback, state.dirty, chapters, bookId, userId, hasError]);

  useEffect(() => {
    if (!userId) return undefined;
    const retry = async () => {
      try { await Promise.all([refetch(), refetchBookmark?.()]); await writerRef.current?.flush(); } catch { /* Keep the local record until the next retry. */ }
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [userId, refetch, refetchBookmark]);

  const setCurrentChapterIndex = useCallback(index => {
    if (!chapters[index]) return;
    setState(previous => ({ ...previous, chapterId: chapters[index].id, paragraphIndex: null, dirty: true }));
  }, [chapters]);
  const setCompletedChapters = useCallback(update => {
    setState(previous => {
      const indices = chapters.map((chapter, index) => previous.completedChapterIds.includes(chapter.id) ? index : -1).filter(index => index >= 0);
      const next = typeof update === 'function' ? update(indices) : update;
      return { ...previous, completedChapterIds: chapters.filter((chapter, index) => chapter.canReadContent !== false && next.includes(index)).map(chapter => chapter.id), dirty: true };
    });
  }, [chapters]);
  return {
    ready, currentChapterIndex: Math.max(0, chapters.findIndex(chapter => chapter.id === state.chapterId)),
    completedChapters: chapters.map((chapter, index) => chapter.canReadContent !== false && state.completedChapterIds.includes(chapter.id) ? index : -1).filter(index => index >= 0),
    setCurrentChapterIndex, setCompletedChapters,
    clearParagraphRestore: () => setState(previous => ({ ...previous, paragraphIndex: null })),
    restoreParagraphIndex: ready ? state.paragraphIndex : null,
    missingSharedChapter: ready && state.missingSharedChapter,
    syncError: hasError || syncStatus === 'error',
    retry: async () => { await Promise.all([userId ? refetch() : Promise.resolve(), userId ? refetchBookmark?.() : Promise.resolve()]); await writerRef.current?.flush(); },
  };
}
