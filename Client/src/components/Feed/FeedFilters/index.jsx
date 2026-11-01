import React from 'react';
import ClassificationFilters from '../../Books/Classification/ClassificationFilters';
import { useFilters } from '../../../context/FiltersContext';

// UI Kit
import { Typography } from '../../UI/Typography';

import './FeedFilters.css';

// Props olarak 'genres' listesini FeedPage'den alıyoruz
const FeedFilters = () => {
  const { filters, updateFilters } = useFilters();

  return (
    <div className="feed-filters">  
      
      <ClassificationFilters value={filters.classification || {}} onChange={value => updateFilters('classification', value)} />

      <div className="filter-section">
        <Typography variant="h6" weight="bold" className="filter-title">Destek durumu</Typography>
        <div className="sort-options">
          {[
            { value: 'ALL', label: 'Tüm kitaplar' },
            { value: 'ACTIVE', label: 'Desteği açık kitaplar' },
            { value: 'FUNDED', label: 'Hedefini tamamlayan kitaplar' },
          ].map(option => <label key={option.value} className="sort-option">
            <input type="radio" name="funding" value={option.value} checked={(filters.funding || 'ALL') === option.value} onChange={event => updateFilters('funding', event.target.value)} />
            <span className="radio-label">{option.label}</span>
          </label>)}
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
            { value: 'lastUpdated', label: 'En Son Güncellenen' },
            { value: 'closestToTarget', label: 'Hedefe en yakın' },
          ].map(option => (
            <label key={option.value} className="sort-option">
              <input
                type="radio"
                name="sort"
                value={option.value}
                // Opsiyonel zincirleme ile 'undefined' hatasını engelliyoruz
                checked={filters?.sortBy === option.value}
                onChange={e => updateFilters('sortBy', e.target.value)}
              />
              <span className="radio-label">{option.label}</span>
            </label>
          ))}
        </div>
        {filters.sortBy === 'closestToTarget' && <p className="funding-sort-hint">Desteği açık kitaplar, hedefe kalan TL tutarı en az olandan başlayarak listelenir.</p>}
      </div>
      
    </div>
  );
};

export default FeedFilters;
