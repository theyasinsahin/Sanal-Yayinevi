import React, { useState } from 'react';
import { useFilters } from '../../context/FiltersContext';
import FeedFilters from './FeedFilters';
import BookGrid from '../../components/BookGrid';
import { filterBooks } from '../../utils/FilterArticles';

import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../../graphql/queries/book';
import { GET_USER_BY_ID } from '../../graphql/queries/user';

const FeedPage = () => {

  const { filters } = useFilters(); // Context'ten filtreleri al

  const { loading, error, data } = useQuery(GET_BOOKS);
  const books = data ? data.getAllBooks : [];
      
  if (loading) return <p>Yükleniyor...</p>;
  
  // 4. HATA DURUMU
  if (error) return <p>Kitap yüklenirken hata oluştu: {error.message}</p>;

  // Filtrelenmiş makaleleri hesapla
  const filteredBooks = filterBooks(books, filters);

  return (
    <div className="feed-page-container">
      <aside className="filters-sidebar">
        <FeedFilters />
      </aside>
      
      <main className="articles-main">
        <BookGrid books={filteredBooks} /> {/* Filtrelenmiş makaleleri gönder */}
      </main>
    </div>
  );
};

export default FeedPage;