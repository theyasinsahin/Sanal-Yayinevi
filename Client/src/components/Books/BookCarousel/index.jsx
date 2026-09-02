import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import BookCard from '../BookCard';
import './BookCarousel.css';

const BookCarousel = ({ books, loading, skeletonCount = 3 }) => {
  const trackRef = useRef(null);

  // En son güncellenen kitaplar önce
  const sorted = useMemo(() => {
  if (!books || books.length === 0) return [];
  return [...books].sort((a, b) => 
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}, [books]);

  const scroll = (direction) => {
    if (!trackRef.current) return;
    // Kart sayısı breakpoint'e göre değiştiği için (4 / 3 / peek) sabit bir
    // çarpan yerine görünür track genişliği kadar kaydırıyoruz — böylece
    // her zaman "bir ekran" ileri/geri gidiyoruz, kaç kart göründüğünden
    // bağımsız olarak doğru çalışıyor.
    const amount = trackRef.current.clientWidth;
    trackRef.current.scrollBy({
      left: direction === 'next' ? amount : -amount,
      behavior: 'smooth'
    });
  };

  if (loading) {
    return (
      <div className="book-carousel">
        <div className="carousel-track">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={`skeleton-${i}`} className="carousel-item">
              <BookCard skeleton />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="carousel-empty">
        Henüz yayınlanmış kitap yok.
      </div>
    );
  }

  

  return (
    <div className="book-carousel">
      {books.length > 4 && (
        <button className="carousel-btn prev" onClick={() => scroll('prev')}>
          <ChevronLeft />
        </button>
      )}

      <div className="carousel-track" ref={trackRef}>
        {sorted.map(book => (
          <div key={book.id || book._id} className="carousel-item">
            <BookCard book={book} />
          </div>
        ))}
      </div>

      {books.length > 4 && (
        <button className="carousel-btn next" onClick={() => scroll('next')}>
          <ChevronRight />
        </button>
      )}
    </div>
  );
};

export default BookCarousel;