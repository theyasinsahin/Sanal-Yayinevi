import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../../../graphql/queries/book';

// --- UI KIT IMPORTS (Yeni Temel Taşlarımız) ---
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import { Container } from '../../UI/Container';

// --- BUSINESS COMPONENTS ---
// Not: BookCard'ı components/Books altına taşıdığını varsayıyorum.
// Eğer henüz taşımadıysan eski yolu kullanabilirsin.
import BookCard from '../../Books/BookCard'; 

import './FeaturedArticles.css';

const FeaturedArticles = () => {
  const { loading, error, data } = useQuery(GET_BOOKS);

  // Loading durumu için UI Kit kullanımı
  if (loading) return (
    <Container className="py-10 text-center">
        <Typography variant="body" color="muted">Yazılar yükleniyor...</Typography>
    </Container>
  );

  // Hata durumu için UI Kit kullanımı
  if (error) return (
    <Container className="py-10 text-center">
        <Typography variant="body" color="danger">Bir hata oluştu: {error.message}</Typography>
    </Container>
  );

  const featuredBooks = data ? data.getAllBooks.slice(0, 3) : [];

  return (
    <section className="featured-articles-section">
      <Container>
        {/* Header Kısmı */}
        <div className="section-header">
          {/* h2 yerine Typography h2 kullanıyoruz */}
          <Typography variant="h2" weight="bold" color="default">
            Öne Çıkan Yazılar
          </Typography>

          {/* Link içine Button bileşenimizi koyuyoruz */}
          <Link to="/feed" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="small">
              Tümünü Gör
            </Button>
          </Link>
        </div>

        {/* Grid Kısmı */}
        <div className="articles-grid">
          {featuredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
            />
          ))}
        </div>
      </Container>
    </section>
  );
};

export default FeaturedArticles;