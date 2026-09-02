import React, {useMemo} from 'react';
import BookCard from '../BookCard'; 
import { Typography } from '../../UI/Typography';
import './BookGrid.css';

const BookGrid = ({ books, loading, skeletonCount = 6, recommendations = [] }) => {


  const reasonMap = useMemo(() => {
    const map = {};
    for (const { book, reason } of recommendations) {
      if (book?.id) map[book.id] = reason;
    }
    return map;
  }, [recommendations]);

  // Veri çekilirken skeleton kartlar göster
  if (loading) {
    return (
      <div className="book-grid">
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <BookCard key={`skeleton-${index}`} skeleton />
        ))}
      </div>
    );
  }

  if (!Array.isArray(books) || books.length === 0) {
    return (
      <div className="book-grid-empty">
        <Typography variant="body" color="muted">
          Gösterilecek kitap bulunamadı.
        </Typography>
      </div>
    );
  }

  const firstElement = books[0];
  const isIdArray = typeof firstElement === 'string' || typeof firstElement === 'number';

  return (
    <div className="book-grid">
      {isIdArray ? (
        books.map(bookId => (
          <BookCard bookId={bookId} key={bookId} reason={reasonMap[bookId]} />
        ))
      ) : (
        books.map(book => (
          <BookCard book={book} key={book.id || book._id} reason={reasonMap[book.id || book._id]} />
        ))
      )}
    </div>
  );
};

export default BookGrid;