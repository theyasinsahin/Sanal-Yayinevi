import React, { createContext, useState, useEffect, useContext } from 'react';
import { useApolloClient } from '@apollo/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const client = useApolloClient();

  useEffect(() => {
    // Sayfa yüklendiğinde LocalStorage'ı kontrol et
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedUser = localStorage.getItem('user'); // Opsiyonel: Kullanıcı detaylarını da tutabiliriz

    if (token && storedUserId) {
      setUser({ 
        token, 
        id: storedUserId,
        ...(storedUser ? JSON.parse(storedUser) : {}) 
      });
    }
    setLoading(false);
  }, []);

  const login = (token, userId, userData = {}) => {
    console.log("Login Fonksiyonu Tetiklendi!");
    console.log("Kaydedilecek Token:", token);
    console.log("Kaydedilecek UserID:", userId);

    // 1. LocalStorage'a Kaydet
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('user', JSON.stringify(userData)); // Kullanıcı detaylarını da saklayalım

    // 2. State'i Güncelle
    setUser({ token, id: userId, ...userData });
  };

  const logout = () => {
    console.log("Çıkış Yapılıyor...");
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    
    client.clearStore();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);