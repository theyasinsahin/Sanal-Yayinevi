// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('app_theme') || 'system'
  );

  // Sistem teması değişirse yeniden hesapla
  const getEffective = (t) => {
    if (t !== 'system') return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  useEffect(() => {
    const effective = getEffective(theme);
    document.documentElement.setAttribute('data-theme', effective);
  }, [theme]);

  // Sistem tercihini dinle (sadece 'system' modundayken)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        document.documentElement.setAttribute(
          'data-theme', mq.matches ? 'dark' : 'light'
        );
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setAndSave = (val) => {
    localStorage.setItem('app_theme', val);
    setTheme(val);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setAndSave }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);