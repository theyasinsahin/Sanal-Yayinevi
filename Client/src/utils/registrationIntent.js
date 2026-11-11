import { progressStorageKey } from './readerProgress';

const KEY = 'betik:registration-intent';
export const REGISTRATION_PROMPT = 'betik:registration-prompt';
const TTL = 30 * 60 * 1000;
const actions = new Set(['read', 'save', 'follow', 'like', 'comment-like', 'comment', 'reply', 'paragraph-comment', 'quote', 'quote-comment', 'repost', 'bookmark', 'recommendations', 'printed-reading']);

export function safeReturnTo(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || /[\\\s]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32) || value.startsWith('//')) return null;
  const pathname = value.split(/[?#]/)[0];
  if (/^\/(?:login|register|auth|reset-password|sifremi-unuttum|forgot-password)(?:\/|$)/.test(pathname)) return null;
  if (!/^\/(?:$|(?:feed|kitap|book-reader|book-detail|quotes|profile|yazar|user|sessions|oturum|printed-books|messages|settings|create-book|dashboard|donate|print|funding-history|publisher|leaderboard|authors)(?:\/|$))/.test(pathname)) return null;
  return value;
}

function validDraft(draft) {
  if (draft === undefined) return true;
  if (typeof draft === 'string') return draft.length <= 20000;
  return draft && typeof draft === 'object' && !Array.isArray(draft) &&
    ['text', 'note', 'page', 'visibility'].every(key => draft[key] === undefined || (typeof draft[key] === 'string' && draft[key].length <= 20000)) &&
    (draft.spoiler === undefined || typeof draft.spoiler === 'boolean');
}

function validSelection(selection) {
  return selection === undefined || Boolean(selection && typeof selection === 'object' && typeof selection.text === 'string' &&
    selection.text.length >= 10 && selection.text.length <= 1000 && selection.source && typeof selection.source.chapterId === 'string');
}

export function readRegistrationIntent() {
  try {
    const intent = JSON.parse(sessionStorage.getItem(KEY));
    if (!intent || !actions.has(intent.action) || !safeReturnTo(intent.returnTo) || !validDraft(intent.draft) || !validSelection(intent.selection) ||
      (intent.paragraphIndex !== undefined && (!Number.isInteger(intent.paragraphIndex) || intent.paragraphIndex < 0)) ||
      !Number.isFinite(intent.createdAt) || intent.createdAt > Date.now() || Date.now() - intent.createdAt >= TTL) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return intent;
  } catch {
    try { sessionStorage.removeItem(KEY); } catch { /* Storage may be unavailable. */ }
    return null;
  }
}

export function saveRegistrationIntent(intent) {
  // Only explicitly allowed fields are persisted; credentials never belong here.
  const next = { action: actions.has(intent.action) ? intent.action : 'read', returnTo: safeReturnTo(intent.returnTo) || '/', createdAt: Date.now(), ready: false };
  for (const key of ['bookId', 'chapterId', 'quoteId', 'commentId', 'paragraphIndex', 'bookTitle', 'draft', 'selection']) {
    if (intent[key] !== undefined) next[key] = intent[key];
  }
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* URL fallback still carries the destination. */ }
  return next;
}

export function registrationUrl(page, intent) {
  const target = safeReturnTo(intent?.returnTo);
  return target && target !== '/profile' ? `/${page}?returnTo=${encodeURIComponent(target)}` : `/${page}`;
}

export function authReturnTo(search = '') {
  const fromUrl = safeReturnTo(new URLSearchParams(search).get('returnTo'));
  return fromUrl || readRegistrationIntent()?.returnTo || '/profile';
}

export function rememberAuthReturnTo(search = '') {
  const target = safeReturnTo(new URLSearchParams(search).get('returnTo'));
  if (target && readRegistrationIntent()?.returnTo !== target) saveRegistrationIntent({ action: 'read', returnTo: target });
}

export function finishRegistrationIntent({ userId, isNewAccount = false, search = '' } = {}) {
  const target = authReturnTo(search);
  const intent = readRegistrationIntent();
  if (intent?.ready && intent.ownerId !== userId) {
    try { sessionStorage.removeItem(KEY); } catch { /* Never restore another account's draft. */ }
    return target;
  }
  if (intent && intent.returnTo === target) {
    if (isNewAccount && intent.bookId && userId) {
      try {
        const guest = JSON.parse(localStorage.getItem(progressStorageKey(intent.bookId)));
        const key = progressStorageKey(intent.bookId, userId);
        if (guest && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ ...guest, pending: true, updatedAt: new Date().toISOString() }));
      } catch { /* Progress transfer is optional; it never blocks authentication. */ }
    }
    try { sessionStorage.setItem(KEY, JSON.stringify({ ...intent, ready: true, ownerId: userId })); } catch { /* Continue to the destination. */ }
  }
  return target;
}

export function consumeRegistrationIntent(action, matches = () => true, userId) {
  const intent = readRegistrationIntent();
  if (!intent?.ready || (userId && intent.ownerId !== userId) || intent.action !== action || !matches(intent)) return null;
  try { sessionStorage.removeItem(KEY); } catch { /* In-memory state still works. */ }
  return intent;
}

export function requestRegistration(intent) {
  window.dispatchEvent(new CustomEvent(REGISTRATION_PROMPT, { detail: intent }));
}
