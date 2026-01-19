import React from 'react';
import BookCard from '../BookCard'; 
import { Typography } from '../../UI/Typography';
import './BookGrid.css';

const BookGrid = ({ books }) => {

  if (!Array.isArray(books) || books.length === 0) {
    return (
      <div className="book-grid-empty">
        <Typography variant="body" color="muted">
          Gösterilecek kitap bulunamadı.
        </Typography>
      </div>
    );
  }

  // İlk elemana bakarak ID listesi mi yoksa Obje listesi mi geldiğini anla
  const firstElement = books[0];
  const isIdArray = typeof firstElement === 'string' || typeof firstElement === 'number';

  return (
    <div className="book-grid">
      {isIdArray ? (
        // ID Listesi geldiyse (örn: Favorilerim sayfası)
        books.map(bookId => (
          <BookCard
            bookId={bookId} 
            key={bookId}
          />
        ))
      ) : (
        // Obje Listesi geldiyse (örn: Feed sayfası)
        books.map(book => (
          <BookCard
            book={book}  
            key={book.id || book._id}  
          />
        ))
      )}
    </div>
  );
};

export default BookGrid;