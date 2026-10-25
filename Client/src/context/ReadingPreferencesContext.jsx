import React, { createContext, useContext, useEffect, useState } from 'react';

export const READING_SIZES = { sm: 16, md: 18, lg: 20 };
const ReadingPreferencesContext = createContext();

export function ReadingPreferencesProvider({ children }) {
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = localStorage.getItem('app_font_size');
      return READING_SIZES[saved] ? saved : 'md';
    } catch { return 'md'; }
  });
  useEffect(() => {
    document.documentElement.style.setProperty('--reading-font-size', `${READING_SIZES[fontSize]}px`);
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.lang = 'tr';
  }, [fontSize]);
  const saveFontSize = size => {
    if (!READING_SIZES[size]) return;
    localStorage.setItem('app_font_size', size);
    setFontSize(size);
  };
  return <ReadingPreferencesContext.Provider value={{ fontSize, saveFontSize }}>
    {children}
  </ReadingPreferencesContext.Provider>;
}

export const useReadingPreferences = () => useContext(ReadingPreferencesContext);
