import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createChapterAutosave } from '../utils/chapterAutosave';

export default function useChapterAutosave({ bookId, save }) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const session = useMemo(() => ({
    bookId,
    manager: createChapterAutosave({ save: chapter => saveRef.current(chapter) }),
  }), [bookId]);
  const { manager } = session;
  const state = useSyncExternalStore(manager.subscribe, manager.getSnapshot);

  useEffect(() => {
    const flush = () => { manager.flush().catch(() => {}); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const beforeUnload = event => {
      if (!manager.hasUnsaved()) return;
      flush();
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      manager.stop();
      flush();
    };
  }, [manager]);

  return { ...state, manager };
}
