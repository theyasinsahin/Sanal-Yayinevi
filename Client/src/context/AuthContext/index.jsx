import React, { createContext, useState, useContext } from 'react';
import { useApolloClient } from '@apollo/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const client = useApolloClient();

  // Başlangıçta localStorage'dan user'ı oku
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...parsed, token };
      } catch {
        return null;
      }
    }
    return null;
  });

  const login = (newToken, userId, userData = {}) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('userId', userId);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser({ id: userId, ...userData, token: newToken });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    client.clearStore();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);