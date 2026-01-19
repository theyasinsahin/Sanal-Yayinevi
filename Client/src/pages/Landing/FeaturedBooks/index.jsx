import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../../../graphql/queries/book';

// --- UI KIT IMPORTS ---
import { Typography } from '../../../components/UI/Typography';
import { Button } from '../../../components/UI/Button';
import { Container } from '../../../components/UI/Container';

// --- BUSINESS COMPONENTS ---
import BookCard from '../../../components/Books/BookCard'; 

import './FeaturedBooks.css';

const FeaturedBooks = () => {
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
      <Container maxWidth="6xl">
        {/* Header Kısmı */}
        <div className="section-header">
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

export default FeaturedBooks;