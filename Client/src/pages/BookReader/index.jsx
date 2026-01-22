import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { ChevronLeft, ChevronRight, ArrowBack, MenuBook } from '@mui/icons-material';

// --- LOGIC & DATA ---
import { GET_BOOK_READER_DATA } from '../../graphql/queries/book';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { parseContentToPages } from '../../utils/htmlPageSplitter';

// --- UI KIT ---
import { Button } from '../../components/UI/Button';
import { Typography } from '../../components/UI/Typography';

import './BookReader.css';

const BookReader = () => {
  const { bookId } = useParams();

  // --- MUTATIONS ---
  const [incrementBookViews] = useMutation(INCREMENT_BOOK_VIEW_MUTATION);
  const viewCounted = useRef(false);

  useEffect(() => {
    if (bookId && !viewCounted.current) {
      incrementBookViews({ variables: { id: bookId }, onError: (e) => console.log(e) });
      viewCounted.current = true;
    }
  }, [bookId, incrementBookViews]);

  // --- QUERIES ---
  const { data: bookData, loading: bookLoading } = useQuery(GET_BOOK_READER_DATA, {
    variables: { id: bookId },
    skip: !bookId,
  });

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [authorName, setAuthorName] = useState('');
  
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [pages, setPages] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);

  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: book?.authorId },
    skip: !book?.authorId,
  });

  // --- RESIZE HANDLER ---
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- DATA SETTING ---
  useEffect(() => {
    if (userData && userData.getUserById) {
      setAuthorName(userData.getUserById.fullName || userData.getUserById.username);
    }
  }, [userData]);

  useEffect(() => {
    if (bookData && bookData.getBookById) {
      const fetchedBook = bookData.getBookById;
      setBook(fetchedBook);
      setChapters(fetchedBook.chapters || []);
    }
  }, [bookData]);

  // --- PAGE GENERATION LOGIC (UNCHANGED) ---
  useEffect(() => {
    if (book && chapters.length > 0) {
      let allBookPages = [];

      // 1. Kapak Sayfası
      allBookPages.push({
        type: 'title_page', 
        bookTitle: book.title,
        author: authorName || "Bilinmeyen Yazar",
        genre: book.genre
      });

      // 2. Bölümler
      chapters.forEach((chapter) => {
        const chapterPages = parseContentToPages(chapter.content, chapter.title);
        allBookPages = [...allBookPages, ...chapterPages];
      });

      setPages(allBookPages);
      setCurrentPage(0);
    }
  }, [book, chapters, authorName]);

  // --- NAVIGATION ---
  const changePage = (direction) => {
    const increment = isMobile ? 1 : 2;
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
    }, 300);
  };

  // --- PAGE RENDERER (UNCHANGED VISUALLY) ---
  const renderPageContent = (pageData) => {
    if (!pageData) return null;

    if (pageData.type === 'title_page') {
        return (
            <div className="page-inner title-page-content">
                <div className="title-decoration-top">dw</div>
                <h1 className="book-main-title">{pageData.bookTitle}</h1>
                <div className="book-main-author">
                    <span>yazan</span>
                    <h3>{pageData.author}</h3>
                </div>
                <div className="book-genre-tag">{pageData.genre}</div>
                <div className="publisher-logo">
                    <MenuBook fontSize="large"/>
                    <span>SANAL YAYINEVİ</span>
                </div>
                <div className="title-decoration-bottom">dw</div>
            </div>
        );
    }

    return (
        <div className="page-inner">
            {pageData.isChapterStart && (
                <div className="chapter-start-header">
                    <h2>{pageData.title}</h2>
                    <div className="separator">✻</div>
                </div>
            )}
            
            <div 
                className="content-text" 
                dangerouslySetInnerHTML={{ __html: pageData.content }} 
            />
        </div>
    );
  };

  const isLoading = bookLoading || !book;

  if (!bookId) return <div className="book-reader-loading">Geçersiz Kitap ID</div>;
  if (isLoading) return <div className="book-reader-loading">Kitap hazırlanıyor...</div>;
  if (pages.length === 0) return <div className="book-reader-loading">İçerik yükleniyor...</div>;

  return (
    <div className={`book-reader ${isMobile ? 'mobile' : ''}`}>
      
      {/* --- UI KIT: Back Button --- */}
      <div className="reader-top-bar">
        <Link to={`/book-detail/${bookId}`} className="no-underline">
           <Button variant="ghost" icon={<ArrowBack />}>
             Kitaba Dön
           </Button>
        </Link>
      </div>

      <div className={`book-container ${isFlipping ? 'flipping' : ''}`}>
        
        {/* SOL SAYFA */}
        {!isMobile && currentPage < pages.length && (
          <div className="book-page left" onClick={() => changePage('prev')}>
            {renderPageContent(pages[currentPage])}
            {currentPage !== 0 && <div className="footer-number">{currentPage}</div>}
          </div>
        )}

        {/* SAĞ SAYFA */}
        {currentPage + (isMobile ? 0 : 1) < pages.length ? (
          <div className={`book-page ${!isMobile ? 'right' : ''}`} onClick={() => changePage('next')}>
             {renderPageContent(pages[currentPage + (isMobile ? 0 : 1)])}
             <div className="footer-number">{currentPage + (isMobile ? 0 : 1)}</div>
          </div>
        ) : (
           !isMobile && <div className="book-page right empty-page">
               <div className="end-text">SON</div>
           </div>
        )}

        {!isMobile && <div className="book-spine"></div>}
      </div>

      {/* --- UI KIT: Navigation Controls --- */}
      <div className="navigation-controls">
         <Button 
           variant="secondary" 
           onClick={() => changePage('prev')} 
           disabled={currentPage === 0}
           icon={<ChevronLeft />}
         >
           Önceki
         </Button>

         <div className="progress-text">
            <Typography variant="body" weight="medium">
               {currentPage === 0 ? "Kapak" : `Sayfa ${currentPage} / ${pages.length-1}`}
            </Typography>
         </div>

         <Button 
           variant="secondary" 
           onClick={() => changePage('next')} 
           disabled={currentPage >= pages.length - 2}
           // icon prop'unu sağa almak için children olarak kullanabiliriz veya iconRight propu ekleyebiliriz
           // Şimdilik children olarak:
         >
           Sonraki <ChevronRight />
         </Button>
      </div>
    </div>
  );
};

export default BookReader;