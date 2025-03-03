import React, { useState, useContext } from 'react';
import { useFilters } from '../../context/FiltersContext';
import FeedFilters from './FeedFilters';
import ArticleGrid from './ArticleGrid';
import { filterArticles } from '../../utils/FilterArticles';
import { sampleBooks } from '../../Data/sampleBooks';
const FeedPage = () => {
  const [books] = useState(sampleBooks);
  const { filters } = useFilters(); // Context'ten filtreleri al

  // Filtrelenmiş makaleleri hesapla
  const filteredBooks = filterArticles(books, filters);

  return (
    <div className="feed-page-container">
      <aside className="filters-sidebar">
        <FeedFilters />
      </aside>
      
      <main className="articles-main">
        <ArticleGrid articles={filteredBooks} /> {/* Filtrelenmiş makaleleri gönder */}
      </main>
    </div>
  );
};

// FiltersProvider'ı App.js seviyesine taşı
export default FeedPage;