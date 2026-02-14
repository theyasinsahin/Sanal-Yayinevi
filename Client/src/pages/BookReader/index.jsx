import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  ArrowBack, 
  Check,
  AutoStories,
  ChevronLeft,
  ChevronRight,
  MenuBook
} from '@mui/icons-material';

import { GET_BOOK_READER_DATA } from '../../graphql/queries/book';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { parseContentToPages } from '../../utils/htmlPageSplitter';
import { Button } from '../../components/UI/Button';

import './BookReader.css';

const BookReader = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  // Reading mode: 'chapter' or 'book'
  const [readingMode, setReadingMode] = useState('chapter');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [completedChapters, setCompletedChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);


  // Increment view count
  const [incrementBookViews] = useMutation(INCREMENT_BOOK_VIEW_MUTATION);
  const viewCounted = useRef(false);

  useEffect(() => {
    if (bookId && !viewCounted.current) {
      incrementBookViews({ 
        variables: { id: bookId },
        onError: (e) => console.log(e)
      });
      viewCounted.current = true;
    }
  }, [bookId, incrementBookViews]);

  // Fetch book data
  const { data: bookData, loading: bookLoading } = useQuery(GET_BOOK_READER_DATA, {
    variables: { id: bookId },
    skip: !bookId,
  });

  const book = bookData?.getBookById;
  const chapters = book?.chapters || [];

  // Fetch author info
  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: book?.authorId },
    skip: !book?.authorId,
  });

  const authorName = userData?.getUserById?.fullName || 
                     userData?.getUserById?.username || 
                     'Unknown Author';

  // Load progress from localStorage
  useEffect(() => {
    if (bookId) {
      const saved = localStorage.getItem(`book-progress-${bookId}`);
      if (saved) {
        try {
          const { lastChapter, completed } = JSON.parse(saved);
          setCurrentChapterIndex(lastChapter || 0);
          setCompletedChapters(completed || []);
        } catch (e) {
          console.error('Error loading progress:', e);
        }
      }
    }
  }, [bookId]);

  // Save progress to localStorage
  useEffect(() => {
    if (bookId) {
      const progress = {
        lastChapter: currentChapterIndex,
        completed: completedChapters,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(`book-progress-${bookId}`, JSON.stringify(progress));
    }
  }, [bookId, currentChapterIndex, completedChapters]);

  // Generate pages for book mode
  useEffect(() => {
    if (book && chapters.length > 0) {
      let allPages = [];

      // Title page
      allPages.push({
        type: 'title_page',
        bookTitle: book.title,
        author: authorName,
        genre: book.genre || 'Fiction',
      });

      // Chapters
      chapters.forEach((chapter) => {
        const chapterPages = parseContentToPages(chapter.content, chapter.title);
        allPages = [...allPages, ...chapterPages];
      });

      setPages(allPages);
    }
  }, [book, chapters, authorName]);

  // Scroll to current chapter
  useEffect(() => {
    if (readingMode === 'chapter' && currentChapterIndex >= 0) {
      const element = document.getElementById(`chapter-${currentChapterIndex}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [currentChapterIndex, readingMode]);

  // Toggle chapter completion
  const toggleChapterCompletion = (index) => {
    setCompletedChapters(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  // Navigate to chapter
  const goToChapter = (index) => {
    setCurrentChapterIndex(index);
  };

  // Book mode navigation
  const changePage = (direction) => {
    const increment = 2;
    let newPage = currentPage;

    if (direction === 'next' && currentPage < pages.length - increment) {
      newPage = currentPage + increment;
    } else if (direction === 'prev' && currentPage > 0) {
      newPage = currentPage - increment;
    } else {
      return;
    }

    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setIsFlipping(false);
    }, 400);
  };

  // Keyboard navigation for book mode
  useEffect(() => {
    if (readingMode === 'book') {
      const handleKeyPress = (e) => {
        if (e.key === 'ArrowLeft') changePage('prev');
        if (e.key === 'ArrowRight') changePage('next');
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }
  }, [readingMode, currentPage, pages.length]);

   useEffect(() => {
    if (readingMode === 'chapter') {
      const handleScroll = () => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPosition = window.scrollY;
        
        if (totalHeight > 0) {
          const progress = (scrollPosition / totalHeight) * 100;
          setScrollProgress(Math.min(progress, 100));
        }
      };

      window.addEventListener('scroll', handleScroll);
      // İlk açılışta  tetikleyelim
      handleScroll();
      
      return () => window.removeEventListener('scroll', handleScroll);
    } else {
      setScrollProgress(0);
    }
  }, [readingMode]);

  // Render page content for book mode
  const renderPageContent = (pageData) => {
    if (!pageData) return null;

    if (pageData.type === 'title_page') {
      return (
        <div className="page-inner title-page-content">
          <div className="ornament-top">❦</div>
          <h1>{pageData.bookTitle}</h1>
          <div className="author-info">
            <div className="by">by</div>
            <div className="name">{pageData.author}</div>
          </div>
          <div className="genre">{pageData.genre}</div>
          <div className="ornament-bottom">❦</div>
        </div>
      );
    }

    

    return (
      <div className="page-inner">
        
        {pageData.isChapterStart && (
          <div className="chapter-start-header">
            <h2>{pageData.title}</h2>
            <div className="separator">❦</div>
          </div>
        )}
        <div 
          className="content-text"
          dangerouslySetInnerHTML={{ __html: pageData.content }}
        />
      </div>
    );
  };

  // Calculate progress
  const progressPercentage = chapters.length > 0 
    ? (completedChapters.length / chapters.length) * 100 
    : 0;

  // Loading state
  if (bookLoading || !book) {
    return (
      <div className="reader-loading">
        <div className="spinner"></div>
        <p>Preparing your book...</p>
      </div>
    );
  }

  return (
    <div className="book-reader">

      {readingMode === 'chapter' && (
        <div className="reading-progress-container">
          <div 
            className="reading-progress-fill" 
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      )}
      
      {/* CHAPTERS SIDEBAR */}
      <div className="chapters-sidebar">
        <div className="sidebar-header">
          <h3>{book.title}</h3>
          <div className="book-progress">
            {completedChapters.length} of {chapters.length} chapters read
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        <div className="chapters-list">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id || index}
              className={`chapter-item ${
                currentChapterIndex === index ? 'active' : ''
              } ${
                completedChapters.includes(index) ? 'completed' : ''
              }`}
              onClick={() => goToChapter(index)}
            >
              <div 
                className={`chapter-checkbox ${
                  completedChapters.includes(index) ? 'checked' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChapterCompletion(index);
                }}
              >
                {completedChapters.includes(index) && <Check />}
              </div>

              <div className="chapter-info">
                <div className="chapter-number">
                  Chapter {index + 1}
                </div>
                <div className="chapter-title">
                  {chapter.title}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* READING AREA */}
      <div className="reading-area">
        
        {/* Floating Controls */}
        <div className="reader-controls">
          <button
            className="control-btn"
            onClick={() => navigate(`/book-detail/${bookId}`)}
            title="Back to book"
          >
            <ArrowBack />
          </button>
          <button
            className={`control-btn ${readingMode === 'book' ? 'active' : ''}`}
            onClick={() => setReadingMode('book')}
            title="Book mode"
          >
            <AutoStories />
          </button>
        </div>

        {/* CHAPTER READING MODE */}
        {readingMode === 'chapter' && (
          <div className="chapter-reading-mode">
            
            {/* Title Page */}
            <div className="title-page-section">
              <div className="title-page-ornament">❦</div>
              <h1>{book.title}</h1>
              <div className="title-page-author">written by</div>
              <div className="title-page-author-name">{authorName}</div>
              <div className="title-page-genre">
                {book.genre || 'Fiction'}
              </div>
              <div className="title-page-ornament">❦</div>
            </div>

            {/* Chapters */}
            {chapters.map((chapter, index) => (
              <div
                key={chapter.id || index}
                id={`chapter-${index}`}
                className="chapter-section"
              >
                <div className="chapter-header">
                  <h2>{chapter.title}</h2>
                </div>

                <div 
                  className="chapter-content"
                  dangerouslySetInnerHTML={{ __html: chapter.content }}
                />

                {/* Chapter Navigation */}
                <div className="chapter-navigation">
                  <button
                    className="chapter-nav-btn"
                    onClick={() => goToChapter(index - 1)}
                    disabled={index === 0}
                  >
                    <ChevronLeft />
                    Previous Chapter
                  </button>

                  <button
                    className="chapter-nav-btn"
                    onClick={() => {
                      if (!completedChapters.includes(index)) {
                        toggleChapterCompletion(index);
                      }
                      if (index < chapters.length - 1) {
                        goToChapter(index + 1);
                      }
                    }}
                    disabled={index === chapters.length - 1}
                  >
                    {completedChapters.includes(index) 
                      ? 'Next Chapter' 
                      : 'Mark Complete & Continue'}
                    <ChevronRight />
                  </button>
                </div>
              </div>
            ))}

            {/* End Marker */}
            <div className="end-marker">
              ✦ THE END ✦
            </div>
          </div>
        )}

        {/* BOOK MODE */}
        {readingMode === 'book' && pages.length > 0 && (
          <>
            <div className="reader-book-mode">
              <div className={`book-container ${isFlipping ? 'flipping' : ''}`}>
                
                {/* Left Page */}
                <div 
                  className="book-page left"
                  onClick={() => changePage('prev')}
                >
                  {renderPageContent(pages[currentPage])}
                  {currentPage > 0 && (
                    <div className="footer-number">{currentPage}</div>
                  )}
                </div>

                {/* Book Spine */}
                <div className="book-spine"></div>

                {/* Right Page */}
                {currentPage + 1 < pages.length ? (
                  <div 
                    className="book-page right"
                    onClick={() => changePage('next')}
                  >
                    {renderPageContent(pages[currentPage + 1])}
                    <div className="footer-number">{currentPage + 1}</div>
                  </div>
                ) : (
                  <div className="book-page right empty-page">
                    <div className="end-text">END</div>
                  </div>
                )}
              </div>
            </div>

            {/* Book Navigation */}
            <div className="book-navigation">
              <Button
                variant="ghost"
                onClick={() => changePage('prev')}
                disabled={currentPage === 0}
                icon={<ChevronLeft />}
              >
                Previous
              </Button>

              <div className="progress-text">
                {currentPage === 0 
                  ? 'Cover' 
                  : `Page ${currentPage} of ${pages.length - 1}`}
              </div>

              <Button
                variant="ghost"
                onClick={() => changePage('next')}
                disabled={currentPage >= pages.length - 2}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookReader;