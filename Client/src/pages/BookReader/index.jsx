import { bookPath } from '../../utils/publicPaths';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  ArrowBack, 
  Check,
  AutoStories,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';

import { GET_BOOK_READER_DATA, GET_READING_CHAPTER, GET_BOOK_READER_FULL } from '../../graphql/queries/book';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { GET_BOOKMARK } from '../../graphql/queries/bookmark';
import { SET_BOOKMARK, REMOVE_BOOKMARK } from '../../graphql/mutations/bookmark';


import { parseContentToPages } from '../../utils/htmlPageSplitter';
import { Button } from '../../components/UI/Button';

import ParagraphRenderer from '../../components/ParagraphComment/ParagraphRenderer';

import './BookReader.css';

import QuotePopup from '../../components/Quote/QuotePopup';
import SocialShareButton from '../../components/Sharing/SocialShareButton';
import { useAuth } from '../../context/AuthContext';

import { useReadingTracker } from '../../hooks/useReadingTracker';
import { useReaderProgress } from '../../hooks/useReaderProgress';

const BookReaderContent = ({ resolvedId, resolvedChapterId } = {}) => {
  const params = useParams();
  const bookId = resolvedId || params.bookId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedChapterId = resolvedChapterId || searchParams.get('chapter');

  const { user } = useAuth();

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [bookmarkActionError, setBookmarkActionError] = useState('');

  const [readingMode, setReadingMode] = useState('chapter');
  const [currentPage, setCurrentPage] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const flipTimer = useRef(null);
  const positionBookPages = useRef(false);
  useEffect(() => () => clearTimeout(flipTimer.current), []);

  const [incrementBookViews] = useMutation(INCREMENT_BOOK_VIEW_MUTATION);
  const viewCounted = useRef(false);

  const { data: bookmarkData, refetch: refetchBookmark, loading: bookmarkLoading, error: bookmarkError } = useQuery(GET_BOOKMARK, {
    variables: { bookId },
    skip: !bookId || !user,
    fetchPolicy: 'no-cache',
    context: { queryDeduplication: false },
  });

  const [setBookmarkMutation] = useMutation(SET_BOOKMARK);
  const [removeBookmarkMutation] = useMutation(REMOVE_BOOKMARK);

  const bookmark = bookmarkData?.getBookmark;

  const handleSetBookmark = async (paragraphIndex) => {
    const chapter = chapters[currentChapterIndex];
    setBookmarkActionError('');
    try {
      await setBookmarkMutation({ variables: {
        bookId, chapterId: chapter.id, chapterIndex: currentChapterIndex, paragraphIndex, chapterTitle: chapter.title,
      } });
      await refetchBookmark();
    } catch { setBookmarkActionError('Ayraç kaydedilemedi. Lütfen tekrar deneyin.'); }
  };

  const handleRemoveBookmark = async () => {
    setBookmarkActionError('');
    try {
      await removeBookmarkMutation({ variables: { bookId } });
      await refetchBookmark();
    } catch { setBookmarkActionError('Ayraç kaldırılamadı. Lütfen tekrar deneyin.'); }
  };

  useEffect(() => {
    if (bookId && !viewCounted.current) {
      incrementBookViews({ 
        variables: { id: bookId },
        onError: (e) => console.log(e)
      });
      viewCounted.current = true;
    }
  }, [bookId, incrementBookViews]);

  const { data: bookData, loading: bookLoading, error: bookError, refetch: refetchBook } = useQuery(GET_BOOK_READER_DATA, {
    variables: { id: bookId },
    skip: !bookId,
    fetchPolicy: 'cache-and-network',
  });

  const book = bookData?.getBookById;
  const chapters = useMemo(() => book?.chapters || [], [book]);

  const {
    ready: progressReady, currentChapterIndex, completedChapters,
    setCurrentChapterIndex, setCompletedChapters, restoreParagraphIndex,
    missingSharedChapter, syncError: progressSyncError, retry: retryProgress, clearParagraphRestore,
  } = useReaderProgress({ bookId, userId: user?.id, chapters, bookLoading,
    bookmark, bookmarkLoading, bookmarkError, refetchBookmark, requestedChapterId });
  const chapterBookmark = bookmark?.chapterId === chapters[currentChapterIndex]?.id ? bookmark : null;
  const chapterId = chapters[currentChapterIndex]?.id;
  const { data: chapterData, loading: chapterLoading, error: chapterError, refetch: refetchChapter } = useQuery(GET_READING_CHAPTER, {
    variables: { bookId, chapterId }, skip: !progressReady || !chapterId || readingMode !== 'chapter',
    fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first',
  });
  const { data: fullData, loading: fullLoading, error: fullError, refetch: refetchFull } = useQuery(GET_BOOK_READER_FULL, {
    variables: { id: bookId }, skip: !progressReady || readingMode !== 'book', fetchPolicy: 'no-cache',
  });
  const fullChapters = fullData?.getBookById?.chapters;
  const loadedChapter = readingMode === 'book' ? fullChapters?.find(chapter => chapter.id === chapterId) : chapterData?.getReadingChapter;
  const chapterReady = Boolean(chapterId && loadedChapter?.id === chapterId);
  // Apollo may retain the previous variables' result while a new chapter loads.
  const currentChapter = { ...chapters[currentChapterIndex], content: loadedChapter?.id === chapterId ? loadedChapter?.content : undefined };

  const readingStatus = useReadingTracker({
    isActive: Boolean(progressReady && user?.id && book && book.status !== 'DRAFT' &&
      (book.kind !== 'PRINTED' || book.publicationStatus === 'APPROVED') && currentChapter.content?.replace(/<[^>]*>/g, '').trim()),
    userId: user?.id, bookId: book?.id, chapterId: chapters[currentChapterIndex]?.id,
    onIdleWarning: () => setShowIdleWarning(true),
    onIdleResume: () => setShowIdleWarning(false),
  });

  const authorName = book?.author?.fullName || book?.author?.username || 'Bilinmeyen Yazar';

  // KOPYALAMAYA KARŞI KORUMA (DRM)
  useEffect(() => {
    const handleCopy = (e) => {
      if (document.activeElement?.closest('[data-social-share-copy], .social-share-dialog')) return;
      // Kullanıcının ekranda seçtiği metni al
      const selectedText = window.getSelection().toString();
      
      // Eğer bir metin seçilmişse ve kopyalamaya çalışıyorsa devreye gir
      if (selectedText.length > 0) {
        e.preventDefault(); // Tarayıcının varsayılan kopyalama işlemini iptal et

        // Kendi özel metnimizi oluştur
        const bookUrl = `${window.location.origin}${bookPath(book)}`;
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
      window.scrollTo({ top: 0, behavior: 'auto' });
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

  const pages = useMemo(() => {
    if (readingMode !== 'book' || !book || !fullChapters?.length) return [];
    return [{ type: 'title_page', bookTitle: book.title, author: authorName, genre: [book.format?.name, ...(book.genres || []).map(item => item.name)].filter(Boolean).join(' / ') },
      ...fullChapters.flatMap(chapter => parseContentToPages(chapter.content, chapter.title)
        .map(page => ({ ...page, chapterId: chapter.id })))];
  }, [book, fullChapters, authorName, readingMode]);
  useEffect(() => {
    if (positionBookPages.current && pages.length) {
      setCurrentPage(Math.max(0, pages.findIndex(page => page.chapterId === chapterId)));
      positionBookPages.current = false;
    }
  }, [pages, chapterId]);

  const toggleChapterCompletion = (index) => {
    setCompletedChapters(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const goToChapter = (index) => {
    if (index < 0 || index >= chapters.length) return;
    clearTimeout(flipTimer.current);
    setIsFlipping(false);
    setCurrentChapterIndex(index);
    if (readingMode === 'book') {
      const pageIndex = pages.findIndex(page => page.chapterId === chapters[index].id);
      if (pageIndex >= 0) setCurrentPage(pageIndex);
    }
  };

  const changePage = useCallback((direction) => {
    if (isFlipping) return;
    const increment = 2;
    let newPage = currentPage;
    if (direction === 'next' && currentPage < pages.length - increment) {
      newPage = currentPage + increment;
    } else if (direction === 'prev' && currentPage > 0) {
      newPage = Math.max(0, currentPage - increment);
    } else {
      return;
    }
    setIsFlipping(true);
    flipTimer.current = setTimeout(() => {
      setCurrentPage(newPage);
      const visibleChapter = pages[newPage]?.chapterId || pages[newPage + 1]?.chapterId;
      const index = chapters.findIndex(chapter => chapter.id === visibleChapter);
      if (index >= 0) setCurrentChapterIndex(index);
      setIsFlipping(false);
    }, 400);
  }, [isFlipping, currentPage, pages, chapters, setCurrentChapterIndex]);

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
  }, [readingMode, changePage]);


  const renderPageContent = (pageData) => {
    if (!pageData) return null;
    if (pageData.type === 'title_page') {
      return (
        <div className="page-inner title-page-content">
          <div className="ornament-top">❦</div>
          <h1>{pageData.bookTitle}</h1>
          <div className="author-info">
            <div className="Yazar:">Yazar:</div>
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

  const isFirstChapter = currentChapterIndex === 0;
  const isLastChapter = currentChapterIndex === chapters.length - 1;

  if (bookError || (!bookLoading && !book)) return <div className="reader-loading" role="alert">
    <p>Kitap yüklenemedi.</p><button className="ui-text-link" onClick={() => refetchBook()}>Tekrar dene</button>
  </div>;

  if (bookLoading || !book || !progressReady) {
    return (
      <div className="reader-loading">
        <div className="spinner"></div>
        <p>Kitabınız hazırlanıyor...</p>
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
            onClick={() => navigate(bookPath(book || { id: bookId }))}
          >
            <ArrowBack fontSize="small" />
            <span>Kitap Detayına Dön</span>
          </button>

          <h3>{book.title}</h3>
          <div className="book-progress">
            {chapters.length} bölümden {completedChapters.length} tanesi okundu
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
                <div className="chapter-number">Bölüm {index + 1}</div>
                <div className="chapter-title">{chapter.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {bookmarkActionError && <p className="ui-notice" role="alert">{bookmarkActionError}</p>}
      {progressSyncError && <p className="ui-notice" role="status">
        Okuma ilerlemesi eşitlenemedi. Bu cihazdaki kayıt korunuyor. <button className="ui-text-link" onClick={() => retryProgress().catch(() => {})}>Tekrar dene</button>
      </p>}
      {(readingStatus === 'error' || readingStatus === 'paused') && <p className="ui-notice" role="status">
        {readingStatus === 'paused' ? 'Okuma puanı takibi diğer açık okuyucuya geçti. Burada devam etmek için sayfayı yenileyebilirsiniz.' : 'Okuma puanı kaydedilemiyor. Bağlantınız geldiğinde tekrar denenecek; doğrulanamayan süre puanlandırılmaz.'}
      </p>}
      {showIdleWarning && (
        <div className="idle-warning-banner">
          <span>⏸️ Hareketsiz görünüyorsun. İki dakika boyunca etkileşim olmazsa okuma puanı takibi duraklar.</span>
          <button onClick={() => setShowIdleWarning(false)}>Devam Et</button>
        </div>
      )}

      {/* READING AREA */}
      <div className="reading-area">
        
        {/* Floating Controls */}
        <div className="reader-controls">
          <button
            className="control-btn"
            onClick={() => navigate(bookPath(book || { id: bookId }))}
            title="Kitaba dön"
          >
            <ArrowBack />
          </button>
          <button
            className={`control-btn ${readingMode === 'book' ? 'active' : ''}`}
            onClick={() => {
              clearTimeout(flipTimer.current);
              setIsFlipping(false);
              clearParagraphRestore();
              if (readingMode === 'chapter') {
                positionBookPages.current = true;
                setReadingMode('book');
              } else setReadingMode('chapter');
            }}
            title="Kitap görünümü"
          >
            <AutoStories />
          </button>
        </div>

        {/* CHAPTER READING MODE — Tek bölüm göster */}
        {missingSharedChapter && <p className="ui-notice" role="status">Paylaşılan bölüm bulunamadı. Kitabın diğer bölümlerini okuyabilirsiniz.</p>}
        {readingMode === 'chapter' && chapterId && (
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
              <SocialShareButton type="CHAPTER" id={currentChapter.id} label="Bölümü paylaş" />
            </div>

            {/* Bölüm İçeriği */}
            {chapterLoading && !chapterReady ? <p role="status">Bölüm yükleniyor...</p> : chapterError || !chapterReady ?
              <p className="ui-notice" role="alert">Bölüm yüklenemedi. <button className="ui-text-link" onClick={() => refetchChapter()}>Tekrar dene</button></p> : <ParagraphRenderer
              key={currentChapter.id}
              restoreParagraphIndex={restoreParagraphIndex}
              content={currentChapter.content}
              bookId={bookId}
              chapterId={currentChapter.id}
              bookmark={chapterBookmark}
              onSetBookmark={user ? handleSetBookmark : null}
              onRemoveBookmark={user ? handleRemoveBookmark : null}
            />}

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
              <div className="end-marker">✦ SON ✦</div>
            )}
          </div>
        )}

        {/* BOOK MODE */}
        {readingMode === 'book' && fullLoading && <p role="status">Kitap görünümü hazırlanıyor...</p>}
        {readingMode === 'book' && fullError && <p className="ui-notice" role="alert">Kitap yüklenemedi. <button className="ui-text-link" onClick={() => refetchFull()}>Tekrar dene</button></p>}
        {readingMode === 'book' && !fullLoading && !fullError && pages.length > 0 && (
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
                    <div className="end-text">SON</div>
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
                Önceki
              </Button>
              <div className="progress-text">
                {currentPage === 0 
                  ? 'Kapak'
                  : `Sayfa ${currentPage} / ${pages.length - 1}`}
              </div>
              <Button
                variant="outline"
                onClick={() => changePage('next')}
                disabled={currentPage >= pages.length - 2}
              >
                Sonraki
                <ChevronRight />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function BookReader(props) {
  const { user } = useAuth();
  const params = useParams();
  return <BookReaderContent key={`${user?.id || 'guest'}:${props.resolvedId || params.bookId}`} {...props} />;
}
