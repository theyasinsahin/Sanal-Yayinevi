import { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    // 1. GÜNCELLEME: 'genres: []' yerine 'genre' string'i kullanıyoruz.
    // Çünkü FilterArticles.js'de tek bir kategoriye göre (filters.genre) işlem yapıyoruz.
    genre: 'Tümü', 
    
    // Sıralama varsayılanı
    sortBy: 'newest',
    
    // 2. ARAMA: Arama çubuğu için gerekli alan
    searchQuery: ''
  });

  // Filtre güncelleme fonksiyonu
  // Kullanımı: updateFilters('searchQuery', 'yeni değer') veya updateFilters('genre', 'Roman')
  const updateFilters = (type, value) => {
    setFilters(prev => ({
      ...prev,
      [type]: value
    }));
  };

  return (
    <FiltersContext.Provider value={{ filters, updateFilters }}>
      {children}
    </FiltersContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error("useFilters must be used within a FiltersProvider");
  }
  return context;
};