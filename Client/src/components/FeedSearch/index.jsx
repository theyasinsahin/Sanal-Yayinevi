import React from 'react';
import { Search } from '@mui/icons-material';
import { useFilters } from '../../context/FiltersContext';
import './FeedSearch.css'; // Birazdan oluşturacağız

const FeedSearch = () => {
  const { filters, updateFilters } = useFilters();

  const handleSearchChange = (e) => {
    // Context'teki searchQuery değerini güncelle
    updateFilters('searchQuery', e.target.value);
  };

  return (
    <div className="feed-search-container">
      <div className="search-wrapper">
        <Search className="search-icon" />
        <input
          type="text"
          placeholder="Kitap, yazar veya etiket ara..."
          value={filters.searchQuery || ''}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>
    </div>
  );
};

export default FeedSearch;