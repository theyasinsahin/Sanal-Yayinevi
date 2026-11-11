const key = 'betik:google-login-nonce';
export function googleLoginNonce() {
  let stored;
  try { stored = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { /* replace invalid browser state */ }
  if (stored?.nonce && Date.now() - stored.createdAt < 600000) return stored.nonce;
  const nonce = Array.from(window.crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(key, JSON.stringify({ nonce, createdAt: Date.now() })); }
  catch { return null; } // Email authentication remains available without tab storage.
  return nonce;
}
export function consumeGoogleLoginNonce(nonce) {
  let stored;
  try {
    stored = JSON.parse(sessionStorage.getItem(key) || 'null');
    sessionStorage.removeItem(key);
  } catch { return false; }
  return Boolean(stored && /^[a-f0-9]{64}$/.test(nonce || '') && nonce === stored.nonce && Date.now() - stored.createdAt < 600000 && stored.createdAt <= Date.now());
}
