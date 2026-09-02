import React from 'react';
import { Apps } from '@mui/icons-material';
import { useFilters } from '../../../context/FiltersContext';

// UI Kit
import { Typography } from '../../UI/Typography';

import './FeedFilters.css';

// Props olarak 'genres' listesini FeedPage'den alıyoruz
const FeedFilters = ({ genres = [] }) => {
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

          {/* Dinamik Kategoriler (Veritabanından Gelen) */}
          {genres.map(genre => (
            <button
              key={genre.id || genre._id}
              className={`category-pill ${filters.genre === genre.slug ? 'active' : ''}`}
              style={filters.genre === genre.slug ? { borderColor: genre.hexColor, backgroundColor: `${genre.hexColor}15` } : {}}
              onClick={() => {
                // Eğer zaten seçiliyse 'Tümü'ne dön, değilse bu türün slug'ını seç
                const nextGenre = filters.genre === genre.slug ? 'Tümü' : genre.slug;
                updateFilters('genre', nextGenre);
              }}
            >
              {/* Varsa iconUrl kullanılabilir, yoksa direkt text */}
              {genre.iconUrl && (
                <img src={genre.iconUrl} alt="" className="category-custom-icon" style={{ width: 16, height: 16, marginRight: 8 }} />
              )}
              <span className="category-text" style={{ color: filters.genre === genre.slug ? genre.hexColor : 'inherit' }}>
                {genre.name}
              </span>
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
            { value: 'lastUpdated', label: 'En Son Güncellenen' },
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
      </div>
      
    </div>
  );
};

export default FeedFilters;