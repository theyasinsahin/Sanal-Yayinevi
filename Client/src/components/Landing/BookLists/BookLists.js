import React, { useState } from 'react';
import BookCard from './BookCard';
import './BookLists.css';

const BookLists = ({ bookList, bookListTitle }) => {
  const [starredBooks, setStarredBooks] = useState([]);

  const handleToggleStar = (bookId) => {
    setStarredBooks(prev => 
      prev.includes(bookId) 
        ? prev.filter(id => id !== bookId) 
        : [...prev, bookId]
    );
  };

  return (
    <section className="book-list-section">
      <h2 className="section-title">{bookListTitle}</h2>
      <div className="book-list-container">
        <div className="book-list-grid">
          {bookList.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isStarred={starredBooks.includes(book.id)}
              onToggleStar={() => handleToggleStar(book.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default BookLists;