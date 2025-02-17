import React, { useState } from 'react';
import './SearchBar.css';

const SearchBar = ({ onSearch }) => {
  const [searchType, setSearchType] = useState('author'); // Varsayılan arama tipi
  const [searchTerm, setSearchTerm] = useState('');

  // searchTerm değiştiğinde handleSearch çağrılır
  const handleSearch = (term) => {
    onSearch(searchType, term);
  };

  const handleInputChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    handleSearch(term); // Burada her input değişikliğinde handleSearch tetiklenir
  };

  return (
    <div className="search-bar">
      <select
        value={searchType}
        onChange={(e) => setSearchType(e.target.value)}
        className="search-select"
      >
        <option value="author">Yazar ara</option>
        <option value="title">Kitap İsmi ara</option>
        <option value="genre">Tür ara</option>
      </select>
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        placeholder="Aramak istediğinizi yazın..."
        className="search-input"
      />
    </div>
  );
};

export default SearchBar;
