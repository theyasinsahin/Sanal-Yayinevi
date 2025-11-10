import React from 'react';

import './BookGrid.css';
import BookCard from '../BookCard'; 


const BookGrid = ({ books }) => {

  return (
    <div className="book-grid">
      {books.map(book => (
          <BookCard
            book={book}
            key={book.id}
          />
      ))}
    </div>
  );
};

export default BookGrid;