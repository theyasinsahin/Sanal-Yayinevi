import { AUTH_SESSION_CHANGED, tokenExpiresAt, readSession, clearSession, invalidateSession } from './authSession';

const token = payload => `header.${btoa(JSON.stringify(payload))}.signature`;
beforeEach(() => { localStorage.clear(); jest.spyOn(Date, 'now').mockReturnValue(100000); });
afterEach(() => jest.restoreAllMocks());

test.each([undefined, null, '', 'not-a-token', 'a.b.c', 'a.e30=.c', token({ exp: '123' }), token({})])('malformed or non-expiring credentials are rejected: %s', value => {
  expect(tokenExpiresAt(value)).toBe(0);
});
test('expiry uses milliseconds and rejects expired sessions even when cached user data exists', () => {
  localStorage.setItem('user', JSON.stringify({ id: 'u', username: 'reader' }));
  localStorage.setItem('token', token({ exp: 100 }));
  expect(readSession()).toBeNull();
  const valid = token({ exp: 200 });
  localStorage.setItem('token', valid);
  expect(tokenExpiresAt(valid)).toBe(200000);
  expect(readSession()).toEqual({ id: 'u', username: 'reader', token: valid });
});
test.each(['null', '{}', 'broken json'])('invalid stored user is not authenticated: %s', user => {
  localStorage.setItem('token', token({ exp: 200 }));
  localStorage.setItem('user', user);
  expect(readSession()).toBeNull();
});
test('storage failures do not crash session reads', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
  expect(readSession()).toBeNull();
});
test('clearing credentials preserves other preferences and broadcasts the session change', () => {
  ['token', 'userId', 'user', 'reader-theme'].forEach(key => localStorage.setItem(key, 'value'));
  const listener = jest.fn();
  window.addEventListener(AUTH_SESSION_CHANGED, listener);
  try {
    clearSession();
    expect(['token', 'userId', 'user'].map(key => localStorage.getItem(key))).toEqual([null, null, null]);
    expect(localStorage.getItem('reader-theme')).toBe('value');
    expect(listener).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener(AUTH_SESSION_CHANGED, listener); }
});
test('a response for an old token cannot clear a newer login', () => {
  localStorage.setItem('token', 'new-token');
  invalidateSession('old-token');
  expect(localStorage.getItem('token')).toBe('new-token');
  invalidateSession('new-token');
  expect(localStorage.getItem('token')).toBeNull();
});
