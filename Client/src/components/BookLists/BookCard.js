import React from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import './BookCard.css';

const BookCard = ({ book, isStarred, onToggleStar }) => {
  return (
    <article className="book-card">
      <button 
        className="star-button" 
        onClick={onToggleStar}
        aria-label={isStarred ? "Yıldızı kaldır" : "Yıldızla"}
      >
        {isStarred ? (
          <FaStar className="star-icon filled" />
        ) : (
          <FaRegStar className="star-icon" />
        )}
      </button>
      
      <img 
        src={book.image ? book.image : "/images/books/yuzyillik-yalnizlik.png"} 
        alt={`${book.title} kapak resmi`} 
        className="book-cover"
        loading="lazy"
      />
      
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        <div className="book-meta">
          <span className="author">{book.author}</span>
          <div className="details">
            <span className="pages">{book.pages} sayfa</span>
            <span className="genre">{book.genre}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

export default BookCard;