export const AUTH_SESSION_CHANGED = 'betik:auth-session-changed';

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
  ['token', 'userId', 'user'].forEach(key => localStorage.removeItem(key));
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED));
}

export function readSession() {
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
  if (localStorage.getItem('token') === token) clearSession();
}
