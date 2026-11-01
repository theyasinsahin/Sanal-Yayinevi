export const progressStorageKey = (bookId, userId) => `book-progress-${userId || 'guest'}-${bookId}`;

export function readLocalProgress(storage, bookId, userId) {
  try {
    const scoped = storage.getItem(progressStorageKey(bookId, userId));
    if (scoped) return JSON.parse(scoped);
    const key = `book-progress-${bookId}`;
    const legacy = JSON.parse(storage.getItem(key) || 'null');
    if (!legacy || (legacy.ownerId && legacy.ownerId !== (userId || 'guest'))) return null;
    // The old format has no account identity. Adopt it once into the current
    // scope, then remove the shared key so another account cannot inherit it.
    try {
      storage.setItem(progressStorageKey(bookId, userId), JSON.stringify(legacy));
      storage.removeItem(key);
    } catch { /* A readable legacy record still works when writes are disabled. */ }
    return legacy;
  } catch { return null; }
}

function normalizeProgress(record, chapters) {
  if (!record) return null;
  const ids = chapters.map(chapter => chapter.id);
  const completed = record.completedChapterIds || record.completedChapters ||
    (Array.isArray(record.completed) ? record.completed.filter(Number.isInteger).map(index => ids[index]) : []);
  const completedIds = new Set(Array.isArray(completed) ? completed : []);
  let chapterId = record.lastChapterId;
  if (!chapterId && Number.isInteger(record.lastChapter) && record.lastChapter >= 0) chapterId = ids[Math.min(record.lastChapter, ids.length - 1)];
  return {
    chapterId: ids.includes(chapterId) ? chapterId : null,
    completed: ids.filter(id => completedIds.has(id)),
    timestamp: Date.parse(record.updatedAt || record.lastReadAt || record.timestamp || '') || 0,
    pending: record.pending === true,
  };
}

export function resolveReaderProgress({ chapters, bookmark, local, server, requestedChapterId }) {
  const ids = chapters.map(chapter => chapter.id);
  const candidates = [normalizeProgress(local, chapters), normalizeProgress(server, chapters)].filter(Boolean).sort((a, b) => Number(b.pending) - Number(a.pending) || b.timestamp - a.timestamp);
  const saved = candidates[0];
  const completed = new Set(saved?.completed || []);
  const requestedIndex = ids.indexOf(requestedChapterId);
  const bookmarkIndex = ids.indexOf(bookmark?.chapterId);
  let index = 0, paragraphIndex = null, source = 'default';
  if (requestedIndex >= 0) { index = requestedIndex; source = 'link'; }
  else if (bookmarkIndex >= 0) {
    index = bookmarkIndex; source = 'bookmark';
    paragraphIndex = Number.isInteger(bookmark.paragraphIndex) && bookmark.paragraphIndex >= 0 ? bookmark.paragraphIndex : null;
  } else if (saved) {
    index = saved.chapterId ? ids.indexOf(saved.chapterId) : Math.max(0, ids.findIndex(id => !completed.has(id)));
    if (!saved.chapterId && ids.length && ids.every(id => completed.has(id))) index = ids.length - 1;
    source = 'progress';
  }
  if (source === 'bookmark' || source === 'progress') ids.slice(0, index).forEach(id => completed.add(id));
  return { chapterId: ids[index] || null, completedChapterIds: ids.filter(id => completed.has(id) && chapters.find(chapter => chapter.id === id)?.canReadContent !== false), paragraphIndex, source,
    missingSharedChapter: Boolean(requestedChapterId && requestedIndex < 0) };
}

// Serialize writes so a slow response cannot replace a newer local selection.
export class ProgressWriter {
  constructor({ save, onStatus = () => {} }) { this.save = save; this.onStatus = onStatus; this.latest = null; this.saved = ''; }
  enqueue(variables) { this.latest = variables; }
  async flush(keepalive = false) {
    if (this.sending) { await this.sending; return this.flush(keepalive); }
    if (!this.latest || JSON.stringify(this.latest) === this.saved) return;
    const variables = this.latest;
    const signature = JSON.stringify(variables);
    this.sending = (async () => {
      this.onStatus('saving');
      try { await this.save(variables, keepalive); this.saved = signature; this.onStatus('saved'); }
      catch { this.onStatus('error'); }
    })();
    await this.sending; this.sending = null;
    if (this.latest && JSON.stringify(this.latest) !== signature) return this.flush(keepalive);
  }
}
