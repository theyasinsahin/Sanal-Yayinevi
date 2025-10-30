import React from 'react';

import './BookGrid.css';
import BookCard from '../BookCard'; 


const BookGrid = ({ bookIds }) => {

  console.log("BookGrid received bookIds:", bookIds);
  return (
    <div className="book-grid">
      {bookIds.map(bookId => (
          <BookCard
            bookId={bookId}
            key={bookId}
          />
      ))}
    </div>
  );
};

export default BookGrid;