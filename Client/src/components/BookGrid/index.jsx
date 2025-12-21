import React from 'react';

import './BookGrid.css';
import BookCard from '../BookCard'; 


const BookGrid = ({ books }) => {

  if (!Array.isArray(books) || books.length === 0) {
    // Varsa boş bir grid veya bir mesaj döndürebilirsiniz
    return (
      <div className="book-grid">
        <p>Gösterilecek kitap bulunamadı.</p>
      </div>
    );
  }

  const firstElement = books[0];

  const isIdArray = typeof firstElement === 'string' || typeof firstElement === 'number';
  return (
    <div className="book-grid">
      {isIdArray ? (
        books.map(bookId => (
          <BookCard
            bookId={bookId} 
            key={bookId}
          />
        ))
      ) : (
        books.map(book => (
          <BookCard
            book={book}  
            key={book.id}  
          />
        ))
      )}
    </div>
  );
};

export default BookGrid;