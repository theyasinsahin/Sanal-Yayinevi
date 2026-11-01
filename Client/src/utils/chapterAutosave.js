export const AUTOSAVE_DELAY = 1500;
export const AUTOSAVE_MAX_WAIT = 10000;

// One editor session owns its drafts. Refetches may refresh metadata and add
// chapters, but must not replace text already edited in this session.
export function createChapterAutosave({ save, delay = AUTOSAVE_DELAY, maxWait = AUTOSAVE_MAX_WAIT }) {
  const records = new Map();
  const deleted = new Set();
  const listeners = new Set();
  let order = [];
  let selectedId = null;
  let timer = null;
  let running = null;
  let snapshot;
  const dirty = record => record.uncertain || record.content !== record.savedContent;
  const hasUnsaved = () => [...records.values()].some(record => dirty(record) || record.saving);
  const stop = () => { if (timer !== null) clearTimeout(timer); timer = null; };

  function notify() {
    const selected = records.get(selectedId);
    const pending = [...records.values()].filter(dirty);
    const saving = [...records.values()].some(record => record.saving);
    const error = pending.find(record => record.error)?.error || null;
    snapshot = {
      chapters: order.map(id => records.get(id)).filter(Boolean).map(({ savedContent, touched, saving, error, uncertain, firstDirtyAt, changedAt, ...chapter }) => chapter),
      selectedChapter: selectedId,
      content: selected?.content || '',
      hasUnsaved: pending.length > 0 || saving,
      status: saving ? 'saving' : error ? 'error' : pending.length ? 'pending' : 'saved',
      error,
    };
    listeners.forEach(listener => listener());
  }

  function schedule() {
    stop();
    const pending = [...records.values()].filter(record => dirty(record) && !record.error);
    if (!pending.length) return;
    const due = Math.min(...pending.map(record => Math.min(record.changedAt + delay, record.firstDirtyAt + maxWait)));
    timer = setTimeout(() => { timer = null; flush(false).catch(() => {}); }, Math.max(0, due - Date.now()));
  }

  async function persist(drain) {
    do {
      const pending = [...records.values()].filter(dirty);
      if (!pending.length) break;
      for (const record of pending) {
        if (deleted.has(record.id) || !dirty(record)) continue;
        const content = record.content;
        record.saving = true; record.error = null;
        notify();
        try {
          const saved = await save({ chapterId: record.id, title: record.title, content });
          record.savedContent = content;
          record.uncertain = false;
          record.pageCount = saved.pageCount ?? record.pageCount;
          record.saving = false;
          if (dirty(record)) record.firstDirtyAt = record.changedAt;
        } catch (error) {
          record.saving = false;
          record.error = error;
          record.uncertain = true;
          record.firstDirtyAt = Date.now();
          notify();
          throw error;
        }
        notify();
      }
    } while (drain && hasUnsaved());
  }

  function flush(drain = true) {
    stop();
    if (running) return running.then(() => drain && hasUnsaved() ? flush(true) : undefined);
    if (!hasUnsaved()) return Promise.resolve();
    running = persist(drain).finally(() => { running = null; schedule(); });
    return running;
  }

  function load(chapters) {
    const wasEmpty = order.length === 0;
    order = chapters.filter(chapter => !deleted.has(chapter.id)).map(chapter => chapter.id);
    for (const chapter of chapters) {
      if (deleted.has(chapter.id)) continue;
      const existing = records.get(chapter.id);
      if (!existing) records.set(chapter.id, { ...chapter, content: chapter.content || '', savedContent: chapter.content || '', touched: false, saving: false, error: null });
      else if (!existing.touched) Object.assign(existing, chapter, { content: chapter.content || '', savedContent: chapter.content || '' });
      else Object.assign(existing, { title: chapter.title, isHidden: chapter.isHidden, canReadContent: chapter.canReadContent, wordCount: chapter.wordCount });
    }
    // Retain an unsaved draft even if a concurrent refetch omitted its chapter.
    for (const record of records.values()) if (dirty(record) && !order.includes(record.id)) order.push(record.id);
    if (selectedId && !order.includes(selectedId)) selectedId = null;
    if (!selectedId && wasEmpty && order.length) selectedId = order[0];
    notify();
  }

  function edit(content) {
    const record = records.get(selectedId);
    if (!record || content === record.content) return;
    const wasDirty = dirty(record);
    record.content = content; record.touched = true; record.error = null;
    record.changedAt = Date.now();
    if (!wasDirty) record.firstDirtyAt = record.changedAt;
    notify(); schedule();
  }

  function select(id) {
    if (!records.has(id) || deleted.has(id)) return;
    selectedId = id; notify();
  }

  function remove(id) {
    deleted.add(id); records.delete(id); order = order.filter(value => value !== id);
    if (selectedId === id) selectedId = null;
    notify(); schedule();
  }

  notify();
  return { load, edit, select, remove, flush, stop, hasUnsaved,
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
