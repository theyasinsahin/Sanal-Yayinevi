import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../../../graphql/queries/book';

// --- UI KIT IMPORTS ---
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import { Container } from '../../UI/Container';

// --- BUSINESS COMPONENTS ---
import BookCard from '../../Books/BookCard'; 

import './FeaturedBooks.css';

// Grid artık daha dar kartlarla daha fazla sütuna sığdığı için (bkz.
// FeaturedBooks.css) 3 yerine 6 kitap gösteriyoruz; aksi halde geniş
// ekranlarda grid'in kullanmadığı boş alan kalırdı. Tek bir yerden
// değiştirilebilsin diye sabit olarak tanımlandı.
const FEATURED_BOOK_COUNT = 4;

const FeaturedBooks = () => {
  const { loading, error, data } = useQuery(GET_BOOKS);

  // Loading durumu için UI Kit kullanımı
  // Loading durumu — skeleton kartlar göster
if (loading) return (
  <section className="featured-books-section">
    <Container maxWidth="6xl">
      <div className="section-header">
        <Typography variant="h2" weight="bold" color="default">
          Öne Çıkan Yazılar
        </Typography>
        <Link to="/feed" style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="small">
            Tümünü Gör
          </Button>
        </Link>
      </div>
      <div className="books-grid">
        {Array.from({ length: FEATURED_BOOK_COUNT }).map((_, i) => (
          <BookCard key={`skeleton-${i}`} skeleton />
        ))}
      </div>
    </Container>
  </section>
);

  // Hata durumu için UI Kit kullanımı
 if (error) return (
  <section className="featured-books-section">
    <Container maxWidth="6xl">
      <div className="section-header">
        <Typography variant="h2" weight="bold" color="default">
          Öne Çıkan Yazılar
        </Typography>
        <Link to="/feed" style={{ textDecoration: 'none' }}>
          <Button variant="outline" size="small">Tümünü Gör</Button>
        </Link>
      </div>
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <Typography variant="h5" weight="bold" color="default">
          İçerikler şu an yüklenemiyor
        </Typography>
        <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
          Bağlantınızı kontrol edip tekrar deneyin.
        </Typography>
        <div style={{ marginTop: '1.5rem' }}>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Yenile
          </Button>
        </div>
      </div>
    </Container>
  </section>
);

  const featuredBooks = data ? data.getAllBooks.slice(0, FEATURED_BOOK_COUNT) : [];

  return (
    <section className="featured-books-section">
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
        <div className="books-grid">
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