export const AUTH_SESSION_CHANGED = 'betik:auth-session-changed';
let volatileSession = null;

export function sessionToken() {
  if (volatileSession) return volatileSession.token;
  try { return localStorage.getItem('token'); } catch { return null; }
}

export function hasSessionCredentials() {
  if (volatileSession) return true;
  try { return ['token', 'userId', 'user'].some(key => localStorage.getItem(key) !== null); } catch { return false; }
}

export function writeSession(token, user) {
  try {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', user.id);
    localStorage.setItem('user', JSON.stringify({ ...user, token: undefined }));
    volatileSession = null;
  } catch {
    // Storage-disabled browsers can still authenticate for this page lifetime.
    volatileSession = { ...user, token };
  }
}

export function tokenExpiresAt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function clearSession() {
  volatileSession = null;
  ['token', 'userId', 'user'].forEach(key => { try { localStorage.removeItem(key); } catch { /* Storage is optional. */ } });
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED));
}

export function readSession() {
  if (volatileSession) return tokenExpiresAt(volatileSession.token) > Date.now() ? volatileSession : null;
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user?.id || tokenExpiresAt(token) <= Date.now()) return null;
    return { ...user, token };
  } catch {
    return null;
  }
}

// An old request must not log out a user who has since signed in again.
export function invalidateSession(token) {
  if (sessionToken() === token) clearSession();
}
