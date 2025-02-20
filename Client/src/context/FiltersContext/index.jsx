import { createContext, useContext, useState } from 'react';

const FiltersContext = createContext();

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    categories: [],
    donationRange: [0, 100000],
    sortBy: 'newest',
    searchQuery: ''
  });

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
