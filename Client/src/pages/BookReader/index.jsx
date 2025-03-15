import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { sampleBooks } from '../../Data/sampleBooks';
import './BookReader.css';

const WORDS_PER_PAGE = 100; // Sayfa başına kelime sınırı

const splitContentIntoPages = (content) => {
  const words = content.split(' ');
  const pages = [];
  for (let i = 0; i < words.length; i += WORDS_PER_PAGE) {
    pages.push(words.slice(i, i + WORDS_PER_PAGE).join(' '));
  }
  return pages;
};

const BookReader = () => {
  const book = sampleBooks.find(b => b.id === 1);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [pages, setPages] = useState([]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (book && book.chapters) {
      const allPages = book.chapters.flatMap(chapter => splitContentIntoPages(chapter.content));
      setPages(allPages);
    }
  }, [book]);

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
        {!isMobile && currentPage < pages.length && (
          <div className="book-page left">
            <div className="header">{book.title}</div>
            <div className="content" dangerouslySetInnerHTML={{ __html: pages[currentPage] }} />
            <div className={`footer ${currentPage % 2 === 0 ? 'right' : 'left'}`}>{currentPage + 1}</div>
          </div>
        )}
        {currentPage + 1 < pages.length && (
          <div className={`book-page ${!isMobile ? 'right' : ''}`}>
            <div className="header">{!isMobile ? book.author : book.title}</div>
            <div className="content" dangerouslySetInnerHTML={{ __html: pages[currentPage + (isMobile ? 0 : 1)] }} />
            <div className={`footer ${(currentPage + 1) % 2 === 0 ? 'right' : 'left'}`}>{currentPage + (isMobile ? 1 : 2)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookReader;
