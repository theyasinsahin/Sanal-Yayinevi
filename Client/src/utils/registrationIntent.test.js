import { authReturnTo, consumeRegistrationIntent, finishRegistrationIntent, readRegistrationIntent, registrationUrl, safeReturnTo, saveRegistrationIntent } from './registrationIntent';
import { progressStorageKey } from './readerProgress';

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());
test.each(['https://outside.example', '//outside.example', '/\\outside.example', '/login', '/auth/callback', '/register?returnTo=/feed', '/feed\n'])('rejects unsafe or recursive destinations: %s', target => {
  expect(safeReturnTo(target)).toBeNull();
  expect(authReturnTo(`?returnTo=${encodeURIComponent(target)}`)).toBe('/profile');
});
test('stores only allowed intent fields and restores a draft once for the authenticated account', () => {
  const intent = { action: 'comment', returnTo: '/book-detail/book#comments', bookId: 'book', draft: 'My unfinished comment', password: 'never-store', token: 'never-store' };
  saveRegistrationIntent(intent);
  expect(JSON.stringify(readRegistrationIntent())).not.toContain('never-store');
  expect(consumeRegistrationIntent('comment')).toBeNull();
  expect(finishRegistrationIntent({ userId: 'reader' })).toBe(intent.returnTo);
  expect(consumeRegistrationIntent('comment', () => true, 'other')).toBeNull();
  expect(consumeRegistrationIntent('comment', () => true, 'reader').draft).toBe(intent.draft);
  expect(consumeRegistrationIntent('comment')).toBeNull();
});
test('expires the context after thirty minutes and rejects corrupt state', () => {
  saveRegistrationIntent({ action: 'read', returnTo: '/feed' });
  const now = Date.now(); jest.spyOn(Date, 'now').mockReturnValue(now + 30 * 60000);
  expect(readRegistrationIntent()).toBeNull();
  sessionStorage.setItem('betik:registration-intent', '{bad json');
  expect(readRegistrationIntent()).toBeNull();
});
test('a new intent replaces the previous one and URL fallback survives disabled storage', () => {
  saveRegistrationIntent({ action: 'read', returnTo: '/feed' });
  const intent = saveRegistrationIntent({ action: 'like', returnTo: '/quotes/quote' });
  expect(readRegistrationIntent().action).toBe('like');
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => saveRegistrationIntent(intent)).not.toThrow();
  expect(authReturnTo(registrationUrl('register', intent).split('?')[1])).toBe('/quotes/quote');
});
test.each([true, false])('only a newly registered account inherits this book guest progress: %s', isNewAccount => {
  const guest = { lastChapterId: 'first', completedChapterIds: ['first'], updatedAt: new Date().toISOString() };
  localStorage.setItem(progressStorageKey('book'), JSON.stringify(guest));
  saveRegistrationIntent({ action: 'read', bookId: 'book', returnTo: '/book-reader/book?chapter=second' });
  finishRegistrationIntent({ userId: 'reader', isNewAccount });
  const result = localStorage.getItem(progressStorageKey('book', 'reader'));
  if (isNewAccount) expect(JSON.parse(result)).toMatchObject({ ...guest, updatedAt: expect.any(String), pending: true });
  else expect(result).toBeNull();
});

test('a draft completed under another account is discarded instead of reassigned on login', () => {
  saveRegistrationIntent({ action: 'comment', returnTo: '/book-detail/book', draft: 'Previous account draft' });
  finishRegistrationIntent({ userId: 'first' });
  finishRegistrationIntent({ userId: 'second' });
  expect(readRegistrationIntent()).toBeNull();
});

test('corrupt quotation selections are discarded before reaching the quote editor', () => {
  saveRegistrationIntent({ action: 'quote', returnTo: '/book-reader/book', selection: { text: null } });
  expect(readRegistrationIntent()).toBeNull();
});
