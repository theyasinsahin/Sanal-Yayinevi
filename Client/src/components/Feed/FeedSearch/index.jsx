import React from 'react';
import { Search } from '@mui/icons-material';
import { useFilters } from '../../../context/FiltersContext';

// UI Kit
import { Input } from '../../UI/Input';

const FeedSearch = () => {
  const { filters, updateFilters } = useFilters();

  const handleSearch = (e) => {
    updateFilters('search', e.target.value);
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <Input
        name="search"
        type="search"
        maxLength={100}
        aria-label="Kitap, yazar veya alıntı ara"
        placeholder="Kitap, yazar veya alıntı ara..."
        value={filters.search || ''}
        onChange={handleSearch}
        icon={<Search fontSize="small" />}
      />
    </div>
  );
};

export default FeedSearch;
