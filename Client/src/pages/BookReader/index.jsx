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
import { GET_BOOKMARK } from '../../graphql/queries/bookmark';
import { SET_BOOKMARK, REMOVE_BOOKMARK } from '../../graphql/mutations/bookmark';


import { parseContentToPages } from '../../utils/htmlPageSplitter';
import { Button } from '../../components/UI/Button';

import ParagraphRenderer from '../../components/ParagraphComment/ParagraphRenderer';

import './BookReader.css';

import QuotePopup from '../../components/Quote/QuotePopup';
import { useAuth } from '../../context/AuthContext';

import { useReadingTracker } from '../../hooks/useReadingTracker';

const BookReader = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const [readingMode, setReadingMode] = useState('chapter');
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [completedChapters, setCompletedChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const [incrementBookViews] = useMutation(INCREMENT_BOOK_VIEW_MUTATION);
  const viewCounted = useRef(false);

  const { data: bookmarkData, refetch: refetchBookmark } = useQuery(GET_BOOKMARK, {
  variables: { bookId },
  skip: !bookId || !user,
});

const [setBookmarkMutation] = useMutation(SET_BOOKMARK);
const [removeBookmarkMutation] = useMutation(REMOVE_BOOKMARK);

const bookmark = bookmarkData?.getBookmark;

// Ayraç bu chapter'a mı ait?
const chapterBookmark = bookmark?.chapterIndex === currentChapterIndex 
  ? bookmark 
  : null;

const handleSetBookmark = async (paragraphIndex) => {
  const chapter = chapters[currentChapterIndex];
  await setBookmarkMutation({
    variables: {
      bookId,
      chapterId: chapter.id,
      chapterIndex: currentChapterIndex,
      paragraphIndex,
      chapterTitle: chapter.title,
    }
  });
  refetchBookmark();
};

const handleRemoveBookmark = async () => {
  await removeBookmarkMutation({ variables: { bookId } });
  refetchBookmark();
};

  // Hook'u kullan:
  useReadingTracker({
    isActive: true,
    onIdleWarning: () => setShowIdleWarning(true),
    onIdleResume: () => setShowIdleWarning(false),
  });

  useEffect(() => {
    if (bookId && !viewCounted.current) {
      incrementBookViews({ 
        variables: { id: bookId },
        onError: (e) => console.log(e)
      });
      viewCounted.current = true;
    }
  }, [bookId, incrementBookViews]);

  const { data: bookData, loading: bookLoading } = useQuery(GET_BOOK_READER_DATA, {
    variables: { id: bookId },
    skip: !bookId,
  });

  const book = bookData?.getBookById;
  const chapters = book?.chapters || [];

  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: { id: book?.authorId },
    skip: !book?.authorId,
  });

  const authorName = userData?.getUserById?.fullName || 
                     userData?.getUserById?.username || 
                     'Unknown Author';

  // Load progress
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

  // Save progress
  useEffect(() => {
    if (bookId) {
      localStorage.setItem(`book-progress-${bookId}`, JSON.stringify({
        lastChapter: currentChapterIndex,
        completed: completedChapters,
        timestamp: new Date().toISOString()
      }));
    }
  }, [bookId, currentChapterIndex, completedChapters]);

  // KOPYALAMAYA KARŞI KORUMA (DRM)
  useEffect(() => {
    const handleCopy = (e) => {
      // Kullanıcının ekranda seçtiği metni al
      const selectedText = window.getSelection().toString();
      
      // Eğer bir metin seçilmişse ve kopyalamaya çalışıyorsa devreye gir
      if (selectedText.length > 0) {
        e.preventDefault(); // Tarayıcının varsayılan kopyalama işlemini iptal et

        // Kendi özel metnimizi oluştur
        const bookUrl = `${window.location.origin}/book-detail/${bookId}`;
        const bookTitle = book?.title || 'Bilinmeyen Kitap';
        
        const customCopyText = `Kitap: ${bookTitle}\nLink: ${bookUrl}\n\n* Bu platformdaki kitap içeriklerinin doğrudan kopyalanması telif hakları gereği sınırlandırılmıştır. Lütfen alıntı yapma özelliğini kullanınız.`;

        // Panoya (Clipboard) bizim belirlediğimiz metni yazdır
        if (e.clipboardData) {
          e.clipboardData.setData('text/plain', customCopyText);
        }
      }
    };

    // Tüm dökümanda copy event'ini dinle
    document.addEventListener('copy', handleCopy);

    // Bileşen ekrandan kalktığında event listener'ı temizle
    return () => {
      document.removeEventListener('copy', handleCopy);
    };
  }, [book, bookId]); // Kitap verisi veya ID değiştiğinde güncellenmesi için

  // Bölüm değişince sayfayı en üste al
  useEffect(() => {
    if (readingMode === 'chapter') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentChapterIndex, readingMode]);

  // Scroll progress (chapter mode)
  useEffect(() => {
    if (readingMode === 'chapter') {
      const handleScroll = () => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPosition = window.scrollY;
        if (totalHeight > 0) {
          setScrollProgress(Math.min((scrollPosition / totalHeight) * 100, 100));
        }
      };
      window.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => window.removeEventListener('scroll', handleScroll);
    } else {
      setScrollProgress(0);
    }
  }, [readingMode, currentChapterIndex]); // currentChapterIndex değişince de sıfırla

  // Generate pages for book mode
  useEffect(() => {
    if (book && chapters.length > 0) {
      let allPages = [];
      allPages.push({
        type: 'title_page',
        bookTitle: book.title,
        author: authorName,
        genre: book.genre?.name || 'Fiction',
      });
      chapters.forEach((chapter) => {
        const chapterPages = parseContentToPages(chapter.content, chapter.title);
        allPages = [...allPages, ...chapterPages];
      });
      setPages(allPages);
    }
  }, [book, chapters, authorName]);

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


  const toggleChapterCompletion = (index) => {
    setCompletedChapters(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const goToChapter = (index) => {
    if (index < 0 || index >= chapters.length) return;
    setCurrentChapterIndex(index);
  };

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

  const progressPercentage = chapters.length > 0 
    ? (completedChapters.length / chapters.length) * 100 
    : 0;

  const currentChapter = chapters[currentChapterIndex];
  const isFirstChapter = currentChapterIndex === 0;
  const isLastChapter = currentChapterIndex === chapters.length - 1;

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
          
          <button
            className="sidebar-back-btn"
            onClick={() => navigate(`/book-detail/${bookId}`)}
          >
            <ArrowBack fontSize="small" />
            <span>Kitap Detayına Dön</span>
          </button>

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
              className={`chapter-item ${currentChapterIndex === index ? 'active' : ''} ${completedChapters.includes(index) ? 'completed' : ''}`}
              onClick={() => goToChapter(index)}
            >
              <div 
                className={`chapter-checkbox ${completedChapters.includes(index) ? 'checked' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleChapterCompletion(index);
                }}
              >
                {completedChapters.includes(index) && <Check />}
              </div>
              <div className="chapter-info">
                <div className="chapter-number">Chapter {index + 1}</div>
                <div className="chapter-title">{chapter.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showIdleWarning && (
        <div className="idle-warning-banner">
          <span>⏸️ Hareketsiz görünüyorsun — puan kazanma duraklatıldı.</span>
          <button onClick={() => setShowIdleWarning(false)}>Devam Et</button>
        </div>
      )}

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
            onClick={() => setReadingMode(readingMode === 'book' ? 'chapter' : 'book')}
            title="Book mode"
          >
            <AutoStories />
          </button>
        </div>

        {/* CHAPTER READING MODE — Tek bölüm göster */}
        {readingMode === 'chapter' && currentChapter && (
          <div className="chapter-reading-mode">

            {user && (
              <QuotePopup
                bookId={bookId}
                chapterId={currentChapter.id}
                chapterTitle={currentChapter.title}
                chapterIndex={currentChapterIndex}
              />
            )}

            {/* Bölüm Başlığı */}
            <div className="chapter-header">
              <div className="chapter-number-label">
                Bölüm {currentChapterIndex + 1} / {chapters.length}
              </div>
              <h2>{currentChapter.title}</h2>
            </div>

            {/* Bölüm İçeriği */}
            <ParagraphRenderer
              content={currentChapter.content}
              bookId={bookId}
              chapterId={currentChapter.id}
              bookmark={chapterBookmark}
              onSetBookmark={user ? handleSetBookmark : null}
              onRemoveBookmark={user ? handleRemoveBookmark : null}
            />

            {/* Bölüm Navigasyonu */}
            <div className="chapter-navigation">
              <button
                className="chapter-nav-btn"
                onClick={() => goToChapter(currentChapterIndex - 1)}
                disabled={isFirstChapter}
              >
                <ChevronLeft />
                Önceki Bölüm
              </button>

              <button
                className="chapter-nav-btn complete-btn"
                onClick={() => {
                  if (!completedChapters.includes(currentChapterIndex)) {
                    toggleChapterCompletion(currentChapterIndex);
                  }
                  if (!isLastChapter) {
                    goToChapter(currentChapterIndex + 1);
                  }
                }}
                disabled={isLastChapter && completedChapters.includes(currentChapterIndex)}
              >
                {isLastChapter
                  ? completedChapters.includes(currentChapterIndex)
                    ? '✦ Tamamlandı'
                    : 'Tamamla'
                  : completedChapters.includes(currentChapterIndex)
                    ? 'Sonraki Bölüm'
                    : 'Tamamla ve Devam Et'}
                {!isLastChapter && <ChevronRight />}
              </button>
            </div>

            {/* Son bölümdeyse bitiş işareti */}
            {isLastChapter && (
              <div className="end-marker">✦ THE END ✦</div>
            )}
          </div>
        )}

        {/* BOOK MODE */}
        {readingMode === 'book' && pages.length > 0 && (
          <>
            <div className="reader-book-mode">
              <div className={`book-container ${isFlipping ? 'flipping' : ''}`}>
                
                <div 
                  className="book-page left"
                  onClick={() => changePage('prev')}
                >
                  {renderPageContent(pages[currentPage])}
                  {currentPage > 0 && (
                    <div className="footer-number">{currentPage}</div>
                  )}
                </div>

                <div className="book-spine"></div>

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

            <div className="book-navigation">
              <Button
                variant="outline"
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
                variant="outline"
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