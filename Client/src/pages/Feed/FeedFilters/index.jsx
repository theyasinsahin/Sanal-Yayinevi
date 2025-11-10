// src/components/Feed/FeedFilters/index.js
import React from 'react';
import { useFilters } from '../../../context/FiltersContext';
import { genres } from '../../../Data/genresData';
import './FeedFilters.css';

const FeedFilters = () => {
  const { filters, updateFilters } = useFilters();
  console.log("Current filters in FeedFilters:", filters);
  return (
    <div className="feed-filters">
      {/* Kategori Filtreleri */}
      <div className="filter-section">
        <h3>Kategoriler</h3>
        <div className="categories-grid">
          {Object.values(genres).map(genre => (
            <button
              key={genre.id}
              className={`category-pill ${
                filters.genres.includes(genre.slug) ? 'active' : ''
              }`}
              onClick={() => {
                const newGenres = filters.genres.includes(genre.slug)
                  ? filters.genres.filter(name => name !== genre.slug)
                  : [...filters.genres, genre.slug];
                updateFilters('genres', newGenres);
              }}
            >
              <span className="category-icon">{genre.icon}</span>
              {genre.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sıralama */}
      <div className="filter-section">
        <h3>Sırala</h3>
        <div className="sort-options">
          {[
            { value: 'newest', label: 'En Yeni' },
            { value: 'popular', label: 'En Popüler' },
          ].map(option => (
            <label key={option.value} className="sort-option">
              <input
                type="radio"
                name="sort"
                value={option.value}
                checked={filters.sortBy === option.value}
                onChange={e => updateFilters('sortBy', e.target.value)}
              />
              <span className="radio-custom"></span>
              {option.label}
            </label>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default FeedFilters;