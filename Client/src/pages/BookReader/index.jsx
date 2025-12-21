import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Edit, ArrowBack, MenuBook } from '@mui/icons-material';
import './BookReader.css';

import { useQuery, useMutation } from '@apollo/client';
import { GET_BOOK_READER_DATA } from '../../graphql/queries/book';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';

// Yukarıda yazdığımız fonksiyonu buraya yapıştırabilir veya import edebilirsin.
// Ben kolaylık olsun diye burada çağırdığımızı varsayıyorum:
import { parseContentToPages } from '../../utils/htmlPageSplitter'; 

const BookReader = () => {
  const { bookId } = useParams();

  // --- Görüntülenme Arttırma ---
  const [incrementBookViews] = useMutation(INCREMENT_BOOK_VIEW_MUTATION);
  const viewCounted = useRef(false);

  useEffect(() => {
    if (bookId && !viewCounted.current) {
      incrementBookViews({ variables: { id: bookId }, onError: (e) => console.log(e) });
      viewCounted.current = true;
    }
  }, [bookId, incrementBookViews]);

  // --- Veri Çekme ---
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_READER_DATA, {
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

  const currentUserId = localStorage.getItem('userId');
  const isAuthor = book && book.authorId === currentUserId;

  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: book?.authorId },
    skip: !book?.authorId,
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // --- SAYFALANDIRMA MANTIĞI (KAPAK SAYFASI DAHİL) ---
  useEffect(() => {
    if (book && chapters.length > 0) {
      let allBookPages = [];

      // 1. ADIM: KAPAK SAYFASI EKLE (En Başa)
      allBookPages.push({
        type: 'title_page', // Özel tip
        bookTitle: book.title,
        author: authorName || "Bilinmeyen Yazar",
        genre: book.genre
      });

      // 2. ADIM: BÖLÜMLERİ İŞLE
      chapters.forEach((chapter) => {
        // Yardımcı fonksiyonumuzla HTML'i bozmadan bölüyoruz
        const chapterPages = parseContentToPages(chapter.content, chapter.title);
        allBookPages = [...allBookPages, ...chapterPages];
      });

      setPages(allBookPages);
      setCurrentPage(0);
    }
  }, [book, chapters, authorName]);

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

  const renderPageContent = (pageData) => {
    if (!pageData) return null;

    // KAPAK SAYFASI TASARIMI
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

    // NORMAL İÇERİK SAYFASI
    return (
        <div className="page-inner">
            {pageData.isChapterStart && (
                <div className="chapter-start-header">
                    <h2>{pageData.title}</h2>
                    <div className="separator">✻</div>
                </div>
            )}
            
            {/* HTML etiketlerini (p, b, strong) yorumlaması için dangerouslySetInnerHTML kullanıyoruz */}
            <div 
                className="content-text" 
                dangerouslySetInnerHTML={{ __html: pageData.content }} 
            />
            
            {/* Kapak sayfasında numara olmaz, o yüzden index kontrolü yapabiliriz ama basitlik için bırakıyoruz */}
        </div>
    );
  };

  const isLoading = bookLoading || !book;

  if (!bookId) return <div className="book-reader-loading">Geçersiz Kitap ID</div>;
  if (isLoading) return <div className="book-reader-loading">Kitap hazırlanıyor...</div>;
  if (pages.length === 0) return <div className="book-reader-loading">İçerik yükleniyor...</div>;

  return (
    <div className={`book-reader ${isMobile ? 'mobile' : ''}`}>
      
      <Link to={`/book-detail/${bookId}`} className="back-link">
         <ArrowBack /> Kitaba Dön
      </Link>

      <div className={`book-container ${isFlipping ? 'flipping' : ''}`}>
        
        {/* SOL SAYFA */}
        {!isMobile && currentPage < pages.length && (
          <div className="book-page left" onClick={() => changePage('prev')}>
            {renderPageContent(pages[currentPage])}
            {/* Kapak sayfasında (index 0) numara gösterme */}
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

      <div className="navigation-controls">
         <button className="nav-btn" onClick={() => changePage('prev')} disabled={currentPage === 0}>
            <ChevronLeft /> Önceki
         </button>
         <div className="progress-text">
            {currentPage === 0 ? "Kapak" : `Sayfa ${currentPage} / ${pages.length-1}`}
         </div>
         <button className="nav-btn" onClick={() => changePage('next')} disabled={currentPage >= pages.length - 2}>
            Sonraki <ChevronRight />
         </button>
      </div>
    </div>
  );
};

export default BookReader;