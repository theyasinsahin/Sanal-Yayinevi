import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client';
import { ME_QUERY } from '../../graphql/queries/user';
import { AUTH_SESSION_CHANGED, clearSession, invalidateSession, readSession, tokenExpiresAt } from '../../utils/authSession';
import { isAuthenticationError } from '../../utils/authLink';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const client = useApolloClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const current = useRef(null);
  const validation = useRef(null);
  const observedToken = useRef(null);

  const updateUser = useCallback(next => {
    const previous = current.current;
    current.current = next;
    setUser(next);
    if (previous && previous.token !== next?.token) {
      // Clear private data without refetching with the next account's credentials.
      client.clearStore().catch(() => {});
    }
  }, [client]);

  const syncSession = useCallback(() => {
    const stored = readSession();
    if (!stored) {
      observedToken.current = null;
      if (current.current || ['token', 'userId', 'user'].some(key => localStorage.getItem(key))) {
        updateUser(null);
        clearSession();
      }
      setLoading(false);
      return null;
    }
    if (current.current && stored.token !== current.current.token) updateUser(null);
    return stored;
  }, [updateUser]);

  const validateSession = useCallback(async () => {
    const session = syncSession();
    if (!session) return;
    observedToken.current = session.token;
    if (validation.current?.token === session.token) return validation.current.promise;
    const promise = (async () => {
      try {
        const { data } = await client.query({ query: ME_QUERY, fetchPolicy: 'no-cache', context: { queryDeduplication: false } });
        if (readSession()?.token !== session.token) return;
        if (!data?.me || data.me.id !== session.id) {
          invalidateSession(session.token);
          return;
        }
        updateUser(session);
      } catch (error) {
        if (isAuthenticationError(error)) invalidateSession(session.token);
        // A temporary network/server error does not invalidate an existing login.
      } finally {
        if (validation.current?.token === session.token) validation.current = null;
        setLoading(false);
      }
    })();
    validation.current = { token: session.token, promise };
    return promise;
  }, [client, syncSession, updateUser]);

  useEffect(() => {
    const synchronize = () => {
      const stored = syncSession();
      if (stored && stored.token !== observedToken.current) validateSession();
    };
    const resume = () => {
      if (document.visibilityState !== 'hidden') validateSession();
    };
    const storageChanged = event => {
      if (event.key === null || ['token', 'userId', 'user'].includes(event.key)) synchronize();
    };
    validateSession();
    window.addEventListener(AUTH_SESSION_CHANGED, synchronize);
    window.addEventListener('storage', storageChanged);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume);
    // Same-tab localStorage changes do not emit a storage event.
    document.addEventListener('pointerdown', synchronize, true);
    document.addEventListener('keydown', synchronize, true);
    const localCheck = window.setInterval(synchronize, 1000);
    const serverCheck = window.setInterval(resume, 60000);
    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGED, synchronize);
      window.removeEventListener('storage', storageChanged);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('pointerdown', synchronize, true);
      document.removeEventListener('keydown', synchronize, true);
      window.clearInterval(localCheck);
      window.clearInterval(serverCheck);
    };
  }, [syncSession, validateSession]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(syncSession, Math.min(tokenExpiresAt(user.token) - Date.now(), 2147483647));
    return () => window.clearTimeout(timer);
  }, [user, syncSession]);

  const login = (newToken, userId, userData = {}) => {
    const next = { ...userData, id: userId };
    localStorage.setItem('token', newToken);
    localStorage.setItem('userId', userId);
    localStorage.setItem('user', JSON.stringify(next));
    observedToken.current = newToken;
    updateUser({ ...next, token: newToken });
    setLoading(false);
    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED));
  };

  const logout = () => {
    clearSession();
    window.location.href = '/login';
  };

  const ensureSession = () => {
    const stored = syncSession();
    return stored?.token === current.current?.token ? stored : null;
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading, ensureSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
