import React from 'react';
import { Apps } from '@mui/icons-material';
import { genres } from '../../../Data/genresData'; // Data klasörünün yeri değişmediyse
import { useFilters } from '../../../context/FiltersContext';

// UI Kit
import { Typography } from '../../UI/Typography';

import './FeedFilters.css';

const FeedFilters = () => {
  const { filters, updateFilters } = useFilters();

  return (
    <div className="feed-filters">  
      
      {/* --- KATEGORİLER --- */}
      <div className="filter-section">
        <Typography variant="h6" weight="bold" className="filter-title">
          Kategoriler
        </Typography>
        
        <div className="categories-grid">
          {/* Tümü Butonu */}
          <button
            className={`category-pill ${filters.genre === 'Tümü' ? 'active' : ''}`}
            onClick={() => updateFilters('genre', 'Tümü')}
          >
            <span className="category-icon"><Apps fontSize="small"/></span>
            <span className="category-text">Tümü</span>
          </button>

          {/* Diğer Kategoriler */}
          {Object.values(genres).map(genre => (
            <button
              key={genre.id}
              className={`category-pill ${filters.genre === genre.slug ? 'active' : ''}`}
              onClick={() => {
                const nextGenre = filters.genre === genre.slug ? 'Tümü' : genre.slug;
                updateFilters('genre', nextGenre);
              }}
            >
              <span className="category-icon">{genre.icon}</span>
              <span className="category-text">{genre.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- SIRALAMA --- */}
      <div className="filter-section">
        <Typography variant="h6" weight="bold" className="filter-title">
          Sırala
        </Typography>
        
        <div className="sort-options">
          {[
            { value: 'newest', label: 'En Yeni' },
            { value: 'popular', label: 'En Popüler' },
            { value: 'oldest', label: 'En Eski' },
          ].map(option => (
            <label key={option.value} className="sort-option">
              <input
                type="radio"
                name="sort"
                value={option.value}
                checked={filters.sortBy === option.value}
                onChange={e => updateFilters('sortBy', e.target.value)}
              />
              <span className="radio-label">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default FeedFilters;