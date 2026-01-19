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
        placeholder="Kitap veya yazar ara..."
        value={filters.search || ''}
        onChange={handleSearch}
        icon={<Search fontSize="small" />}
      />
    </div>
  );
};

export default FeedSearch;