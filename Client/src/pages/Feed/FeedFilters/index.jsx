// src/components/Feed/FeedFilters/index.js
import React from 'react';
import { useFilters } from '../../../context/FiltersContext';
import { genres } from '../../../Data/genresData';
import './FeedFilters.css';
import { Apps } from '@mui/icons-material'; // Tümü ikonu için

const FeedFilters = () => {
  // Context'ten 'genre' (tekil string) ve güncelleme fonksiyonunu alıyoruz
  const { filters, updateFilters } = useFilters();

  return (
    <div className="feed-filters">
      
      {/* Kategori Filtreleri */}
      <div className="filter-section">
        <h3>Kategoriler</h3>
        <div className="categories-grid">
          
          {/* 1. TÜMÜ BUTONU: Filtreyi sıfırlamak için */}
          <button
            className={`category-pill ${filters.genre === 'Tümü' ? 'active' : ''}`}
            onClick={() => updateFilters('genre', 'Tümü')}
          >
            <span className="category-icon"><Apps fontSize="small"/></span>
            Tümü
          </button>

          {/* 2. DİNAMİK KATEGORİLER */}
          {Object.values(genres).map(genre => (
            <button
              key={genre.id}
              // Active kontrolü: Şu anki filtre bu slug'a eşit mi?
              className={`category-pill ${
                filters.genre === genre.slug ? 'active' : ''
              }`}
              onClick={() => {
                // TOGGLE MANTIĞI:
                // Eğer zaten bu kategori seçiliyse -> 'Tümü' yap (seçimi kaldır)
                // Değilse -> Bu kategoriyi seç
                const nextGenre = filters.genre === genre.slug ? 'Tümü' : genre.slug;
                updateFilters('genre', nextGenre);
              }}
            >
              <span className="category-icon">{genre.icon}</span>
              {genre.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sıralama (Burada değişiklik yok, mantık aynı) */}
      <div className="filter-section">
        <h3>Sırala</h3>
        <div className="sort-options">
          {[
            { value: 'newest', label: 'En Yeni' },
            { value: 'popular', label: 'En Popüler' }, // filterBooks'ta buna göre logic kurmuştuk
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