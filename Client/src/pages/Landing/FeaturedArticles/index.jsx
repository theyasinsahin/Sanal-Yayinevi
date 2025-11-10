import React from 'react';
import './FeaturedArticles.css';
import BookCard from '../../../components/BookCard'

// Apollo Client ve GraphQL sorgusu import
import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../../../graphql/queries/book';

import { Link } from 'react-router-dom';

const FeaturedArticles = () => {
 const { loading, error, data } = useQuery(GET_BOOKS);

  // Yüklenme durumunu yönetin
  if (loading) return <p>Yazılar yükleniyor...</p>;

  // Hata durumunu yönetin
  if (error) return <p>Bir hata oluştu: {error.message}</p>;

  const featuredBooks = data ? data.getAllBooks.slice(0, 3) : [];

  return (
    <section className="featured-articles">
      <div className="section-header">
        <h2 className="section-title">Öne Çıkan Yazılar</h2>
        <Link to="/feed" className="secondary-cta">
          Tümünü Gör
        </Link>
      </div>

      <div className="articles-grid">
        {featuredBooks.map((book) => (
          <BookCard
            key={book.id}
            book={book}
          />
        ))}
      </div>
    </section>
  );
};

export default FeaturedArticles;