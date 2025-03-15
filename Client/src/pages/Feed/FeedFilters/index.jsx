// src/components/Feed/FeedFilters/index.js
import React from 'react';
import { useFilters } from '../../../context/FiltersContext';
import { categories } from '../../../Data/categoriesData';
import RangeInput from '../../../components/Common/RangeInput'
import './FeedFilters.css';

const FeedFilters = () => {
  const { filters, updateFilters } = useFilters();
  
  return (
    <div className="feed-filters">
      {/* Kategori Filtreleri */}
      <div className="filter-section">
        <h3>Kategoriler</h3>
        <div className="categories-grid">
          {categories.map(category => (
            <button
              key={category.id}
              className={`category-pill ${
                filters.categories.includes(category.id) ? 'active' : ''
              }`}
              onClick={() => {
                const newCategories = filters.categories.includes(category.id)
                  ? filters.categories.filter(id => id !== category.id)
                  : [...filters.categories, category.id];
                updateFilters('categories', newCategories);
              }}
            >
              <span className="category-icon">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bağış Aralığı */}
      <div className="filter-section">
        <h3>Bağış Hedefi</h3>
        <RangeInput
          min={0}
          max={100000}
          value={filters.donationRange}
          onChange={value => updateFilters('donationRange', value)}
          formatLabel={value => `${value.toLocaleString()} TL`}
        />
      </div>

      {/* Sıralama */}
      <div className="filter-section">
        <h3>Sırala</h3>
        <div className="sort-options">
          {[
            { value: 'newest', label: 'En Yeni' },
            { value: 'popular', label: 'En Popüler' },
            { value: 'closesttl', label: 'Hedefe Yakın (TL olarak)' },
            { value: 'closestpercent', label: 'Hedefe Yakın (% olarak)' },
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