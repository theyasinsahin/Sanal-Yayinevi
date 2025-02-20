import React, { useState, useContext } from 'react';
import { useFilters } from '../../context/FiltersContext';
import FeedFilters from './FeedFilters';
import ArticleGrid from './ArticleGrid';
import { filterArticles } from '../../utils/FilterArticles';
import { sampleArticles } from '../../Data/sampleArticles';
const FeedPage = () => {
  const [articles] = useState(sampleArticles);
  const { filters } = useFilters(); // Context'ten filtreleri al

  // Filtrelenmiş makaleleri hesapla
  const filteredArticles = filterArticles(articles, filters);

  return (
    <div className="feed-page-container">
      <aside className="filters-sidebar">
        <FeedFilters />
      </aside>
      
      <main className="articles-main">
        <ArticleGrid articles={filteredArticles} /> {/* Filtrelenmiş makaleleri gönder */}
      </main>
    </div>
  );
};

// FiltersProvider'ı App.js seviyesine taşı
export default FeedPage;