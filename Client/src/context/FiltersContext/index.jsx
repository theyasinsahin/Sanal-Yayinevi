import { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    classification: null,
    sortBy: 'newest',
    funding: 'ALL',
    
    // 2. ARAMA: Arama çubuğu için gerekli alan
    search: ''
  });

  // Filtre güncelleme fonksiyonu
  const updateFilters = (type, value) => {
    setFilters(prev => ({
      ...prev,
      [type]: value,
      ...(type === 'sortBy' && value === 'closestToTarget' ? { funding: 'ACTIVE' } : {}),
      ...(type === 'funding' && value !== 'ACTIVE' && prev.sortBy === 'closestToTarget' ? { sortBy: 'newest' } : {}),
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
