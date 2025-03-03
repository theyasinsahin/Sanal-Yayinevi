import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { sampleBooks } from '../../Data/sampleBooks';
import './BookReader.css';

const BookReader = () => {
  const book = sampleBooks.find(b => b.id === 1);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pages = book.content;

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - (isMobile ? 1 : 2));
  };

  const handleNextPage = () => {
    if (currentPage < pages.length - (isMobile ? 1 : 2))
      setCurrentPage(prev => prev + (isMobile ? 1 : 2));
  };

  return (
    <div className={`book-reader ${isMobile ? 'mobile' : ''}`}>
      <div className="navigation-buttons">
        <button className="nav-button prev" onClick={handlePrevPage} disabled={currentPage === 0}>
          <ChevronLeft />
        </button>
        <button className="nav-button next" onClick={handleNextPage} disabled={currentPage >= pages.length - (isMobile ? 1 : 2)}>
          <ChevronRight />
        </button>
      </div>

      <div className="book-container">
        {!isMobile && (
          <div className="book-page left">
          <div className="header">{book.title}</div>
          <div className="content">{pages[currentPage]?.text}</div>
          <div className={`footer ${pages[currentPage]?.page % 2 === 0 ? 'right' : 'left'}`}>
            {pages[currentPage]?.page}
          </div>
        </div>
        )}
        <div className={`book-page ${!isMobile ? 'right' : ''}`}>
          <div className="header">{!isMobile ? book.author : book.title}</div>
          <div className="content">
            {isMobile ? pages[currentPage]?.text : pages[currentPage + 1]?.text}
          </div>
          <div className={`footer ${pages[currentPage + 1]?.page % 2 === 0 ? 'right' : 'left'}`}>
            {isMobile ? pages[currentPage]?.page : pages[currentPage + 1]?.page}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookReader;
