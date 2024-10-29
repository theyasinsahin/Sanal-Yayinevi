import React, { useRef, useState } from 'react';
import './BookLists.css';

const BookLists = () => {

  const popularBooksRef = useRef(null);
  const newAdditionsRef = useRef(null);
  const newReleasesRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const popularBooks = [
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "link-to-image" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "link-to-image" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "link-to-image" },
    { title: "Kitap A", author: "Yazar A", pages: 200, genre: "Fantastik", image: "link-to-image" },
    { title: "Kitap B", author: "Yazar B", pages: 350, genre: "Bilim-Kurgu", image: "link-to-image" },
    // Add more book data
  ];

  const newAdditions = [
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    { title: "Book C", author: "Author C", pages: 180, genre: "Romantik", image: "link-to-image" },
    { title: "Book D", author: "Author D", pages: 400, genre: "Gizem", image: "link-to-image" },
    // Add more book data
  ];

  const newReleases = [
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    { title: "Book E", author: "Author E", pages: 250, genre: "Biyografi", image: "link-to-image" },
    { title: "Book F", author: "Author F", pages: 320, genre: "Tarih", image: "link-to-image" },
    // Add more book data
  ];

  const handleMouseDown = (e, ref) => {
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e, ref) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2; // Kaydırma hassasiyeti
    ref.current.scrollLeft = scrollLeft - walk;
  };

  const renderBooks = (books, ref) => (
    <div 
      className="book-list" 
      ref={ref}
      onMouseDown={(e) => handleMouseDown(e, ref)}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={(e) => handleMouseMove(e, ref)}      
    >
      {books.map((book, index) => (
        
        <div key={index} className="book-card">
          <img src='./images/books/yuzyillik-yalnizlik.png'/*src={book.image}*/ 
          alt={book.title} className="book-image"   
          onDragStart={(e) => e.preventDefault()} 
          />
          <div className="book-details">
            <h3 className="book-title">{book.title}</h3>
            <p className="book-author">Author: {book.author}</p>
            <p className="book-pages">Pages: {book.pages}</p>
            <p className="book-genre">Genre: {book.genre}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="book-lists">
      <div className="book-category">
        <h2>Popular Books</h2>
        {renderBooks(popularBooks, popularBooksRef)}

      </div>

      <div className="book-category">
        <h2>New Additions</h2>
        {renderBooks(newAdditions, newAdditionsRef)}

      </div>

      <div className="book-category">
        <h2>New Releases</h2>
        {renderBooks(newReleases, newReleasesRef)}

      </div>
    </div>
  );
};

export default BookLists;
