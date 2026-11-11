import HiddenChapterNotice from '../../components/Books/HiddenChapterNotice';
import { isChapterLocked, chapterLengthLabel } from '../../utils/chapterVisibility';
import { bookPath, readerPath } from '../../utils/publicPaths';
import { useRegistration, useRestoredRegistration } from '../../hooks/useRegistration';
import { RegistrationCard } from '../../components/Registration/RegistrationPrompt';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  ArrowBack, 
  Check,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';

import { GET_BOOK_READER_DATA, GET_READING_CHAPTER } from '../../graphql/queries/book';
import { INCREMENT_BOOK_VIEW_MUTATION } from '../../graphql/mutations/book';
import { GET_BOOKMARK } from '../../graphql/queries/bookmark';
import { SET_BOOKMARK, REMOVE_BOOKMARK } from '../../graphql/mutations/bookmark';



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
  const requestedParagraph = searchParams.get('paragraph');
  const requestedParagraphIndex = requestedParagraph !== null && /^\d+$/.test(requestedParagraph) ? Number(requestedParagraph) : null;

  const { user, loading: authLoading } = useAuth();
  const requestRegistration = useRegistration();
  const restoredBookmark = useRestoredRegistration('bookmark', { bookId });
  useRestoredRegistration('read', { bookId });
  const [bookmarkConfirmed, setBookmarkConfirmed] = useState(false);

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [bookmarkActionError, setBookmarkActionError] = useState('');
  const [isCompact, setIsCompact] = useState(() => window.innerWidth <= 1100);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [quoteHelpOpen, setQuoteHelpOpen] = useState(true);

  useEffect(() => {
    const resize = () => setIsCompact(window.innerWidth <= 1100);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  useEffect(() => {
    if (!sidebarOpen || !isCompact) return undefined;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector('button')?.focus();
    const keydown = event => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key !== 'Tab') return;
      const controls = [...(sidebarRef.current?.querySelectorAll('button:not(:disabled)') || [])];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      menuButton?.focus({ preventScroll: true });
    };
  }, [sidebarOpen, isCompact]);

  const [scrollProgress, setScrollProgress] = useState(0);

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
    if (!user) return requestRegistration({ action: 'bookmark', bookId, chapterId: chapter.id, paragraphIndex,
      returnTo: `${readerPath(book)}?chapter=${chapter.id}&paragraph=${paragraphIndex}` });
    setBookmarkActionError('');
    try {
      await setBookmarkMutation({ variables: {
        bookId, chapterId: chapter.id, chapterIndex: currentChapterIndex, paragraphIndex, chapterTitle: chapter.title,
      } });
      await refetchBookmark();
      setBookmarkConfirmed(true);
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
    skip: !bookId || authLoading,
    fetchPolicy: 'no-cache',
    context: { queryDeduplication: false },
  });

  const book = bookData?.getBookById;
  const chapters = useMemo(() => book?.chapters || [], [book]);

  const {
    ready: progressReady, currentChapterIndex, completedChapters,
    setCurrentChapterIndex, setCompletedChapters, restoreParagraphIndex,
    missingSharedChapter, syncError: progressSyncError, retry: retryProgress,
  } = useReaderProgress({ bookId, userId: user?.id, chapters, bookLoading: bookLoading || authLoading,
    bookmark, bookmarkLoading, bookmarkError, refetchBookmark, requestedChapterId });
  const chapterBookmark = bookmark?.chapterId === chapters[currentChapterIndex]?.id ? bookmark : null;
  const chapterId = chapters[currentChapterIndex]?.id;
  const { data: chapterData, loading: chapterLoading, error: chapterError, refetch: refetchChapter } = useQuery(GET_READING_CHAPTER, {
    variables: { bookId, chapterId }, skip: !progressReady || !chapterId,
    fetchPolicy: 'no-cache',
  });
  const loadedChapter = chapterData?.getReadingChapter;
  const chapterReady = Boolean(chapterId && loadedChapter?.id === chapterId);
  // Apollo may retain the previous variables' result while a new chapter loads.
  const locked = isChapterLocked(chapters[currentChapterIndex]) || (loadedChapter?.id === chapterId && isChapterLocked(loadedChapter));
  const currentChapter = { ...chapters[currentChapterIndex], ...(loadedChapter?.id === chapterId ? loadedChapter : {}), content: !locked && loadedChapter?.id === chapterId ? loadedChapter?.content : undefined };
  const registrationRequired = currentChapter.accessStatus === 'REGISTRATION_REQUIRED';
  const readingIntent = chapter => ({ action: 'read', bookId, chapterId: chapter.id, bookTitle: book.title,
    returnTo: `${readerPath(book)}?chapter=${chapter.id}` });

  const readingStatus = useReadingTracker({
    isActive: Boolean(!locked && progressReady && user?.id && book && book.status !== 'DRAFT' &&
      (book.kind !== 'PRINTED' || book.publicationStatus === 'APPROVED') && currentChapter.content?.replace(/<[^>]*>/g, '').trim()),
    userId: user?.id, bookId: book?.id, chapterId: chapters[currentChapterIndex]?.id,
    onIdleWarning: () => setShowIdleWarning(true),
    onIdleResume: () => setShowIdleWarning(false),
  });

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentChapterIndex]);

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(totalHeight > 0 ? Math.min((window.scrollY / totalHeight) * 100, 100) : 0);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentChapterIndex]);

  const toggleChapterCompletion = (index) => {
    if (isChapterLocked(chapters[index])) return;
    setCompletedChapters(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const goToChapter = (index) => {
    if (index < 0 || index >= chapters.length) return;
    if (chapters[index].accessStatus === 'REGISTRATION_REQUIRED') {
      setSidebarOpen(false);
      requestRegistration(readingIntent(chapters[index]));
      return;
    }
    setSidebarOpen(false);
    setCurrentChapterIndex(index);
  };

  const progressPercentage = chapters.length > 0 
    ? (completedChapters.length / chapters.length) * 100 
    : 0;

  const isFirstChapter = currentChapterIndex === 0;
  const isLastChapter = currentChapterIndex === chapters.length - 1;

  if (bookError || (!bookLoading && !book)) return <div className="reader-loading" role="alert">
    <p>Kitap yüklenemedi.</p><button className="ui-text-link" onClick={() => refetchBook()}>Tekrar dene</button>
  </div>;

  if (authLoading || bookLoading || !book || !progressReady) {
    return (
      <div className="reader-loading">
        <div className="spinner"></div>
        <p>Kitabınız hazırlanıyor...</p>
      </div>
    );
  }

  return (
    <div className="book-reader">

        <div className="reading-progress-container">
          <div 
            className="reading-progress-fill" 
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      
      {/* CHAPTERS SIDEBAR */}
      {isCompact && sidebarOpen && <div className="reader-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside ref={sidebarRef} id="reader-chapters" className={`chapters-sidebar ${sidebarOpen ? 'is-open' : ''}`}
        role={isCompact ? 'dialog' : undefined} aria-modal={isCompact && sidebarOpen ? 'true' : undefined}
        aria-label="Kitap bölümleri" aria-hidden={isCompact && !sidebarOpen ? true : undefined}
        {...(isCompact && !sidebarOpen ? { inert: '' } : {})}>
        {isCompact && <button type="button" className="reader-sidebar-close" onClick={() => setSidebarOpen(false)}>Bölümleri kapat ×</button>}
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
            >
              <button type="button"
                className={`chapter-checkbox ${completedChapters.includes(index) ? 'checked' : ''}`}
                disabled={isChapterLocked(chapter)}
                aria-label={`${chapter.title}: okundu durumunu değiştir`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isChapterLocked(chapter)) toggleChapterCompletion(index);
                }}
              >
                {completedChapters.includes(index) && <Check />}
              </button>
              <button type="button" className="chapter-info" onClick={() => goToChapter(index)} aria-current={currentChapterIndex === index ? 'location' : undefined}>
                <div className="chapter-number">Bölüm {index + 1}</div>
                <div className="chapter-title">{chapter.title}</div>
                <span className="chapter-length">{chapterLengthLabel(chapter)}</span>
                {chapter.isHidden && <span className="chapter-visibility-label">Okuyuculara kapalı</span>}
                {chapter.accessStatus === 'REGISTRATION_REQUIRED' && <span className="chapter-visibility-label">Ücretsiz üyelikle oku</span>}
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* READING AREA */}
      <div className="reading-area" {...(isCompact && sidebarOpen ? { inert: '' } : {})}>
      {!user && !locked && currentChapterIndex === chapters.findIndex(chapter => chapter.canReadContent !== false) && <p className="ui-notice">İlk bölümü üye olmadan okuyabilirsin.</p>}
      {restoredBookmark?.chapterId === currentChapter.id && !bookmarkConfirmed && !locked && chapterReady && <p className="ui-notice" role="status">
        Ayracı kaydetmeye hazırsın. <button className="ui-text-link" onClick={() => handleSetBookmark(restoredBookmark.paragraphIndex)}>Ayracı buraya kaydet</button>
      </p>}
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

        {/* Floating Controls */}
        <div className="reader-controls">
          {isCompact && <button ref={menuButtonRef} type="button" className="reader-chapters-toggle" aria-controls="reader-chapters"
            aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>Bölümler ({chapters.length})</button>}
          <button
            className="control-btn"
            onClick={() => navigate(bookPath(book || { id: bookId }))}
            title="Kitaba dön"
          >
            <ArrowBack />
          </button>
          <button type="button" className="reader-quote-help-toggle" aria-expanded={quoteHelpOpen} aria-controls="reader-quote-help" onClick={() => setQuoteHelpOpen(value => !value)}>Alıntı nasıl eklenir?</button>
        </div>

        {quoteHelpOpen && <aside id="reader-quote-help" className="reader-quote-help" aria-label="Alıntı ekleme ipucu">
          <div><strong>Beğendiğiniz satırları saklayın</strong>
            <p>Bilgisayarda metni fareyle seçin. Telefonda bir kelimeye basılı tutup seçim tutamaçlarını sürükleyin. 10–1000 karakter seçtiğinizde alıntı penceresi açılır; not ve görünürlük seçerek kaydedebilirsiniz.</p>
            {!user && <p>Alıntı kaydetmek için giriş yapmalısınız.</p>}
          </div>
          <button type="button" aria-label="Alıntı ipucunu kapat" onClick={() => setQuoteHelpOpen(false)}>×</button>
        </aside>}
        {!currentChapter.isHidden && !locked && chapterReady && (
          <QuotePopup key={chapterId} bookId={bookId} chapterId={currentChapter.id}
            chapterTitle={currentChapter.title} chapterIndex={currentChapterIndex} />
        )}

        {/* CHAPTER READING MODE — Tek bölüm göster */}
        {missingSharedChapter && <p className="ui-notice" role="status">Paylaşılan bölüm bulunamadı. Kitabın diğer bölümlerini okuyabilirsiniz.</p>}
        {chapterId && (
          <div className="chapter-reading-mode">

            {/* Bölüm Başlığı */}
            <div className="chapter-header">
              <div className="chapter-number-label">
                Bölüm {currentChapterIndex + 1} / {chapters.length}
              </div>
              <h2>{currentChapter.title}</h2>
              {!currentChapter.isHidden && <SocialShareButton type="CHAPTER" id={currentChapter.id} label="Bölümü paylaş" />}
            </div>

            {/* Bölüm İçeriği */}
            {registrationRequired ? <RegistrationCard intent={readingIntent(currentChapter)}>
              <button className="ui-text-link" onClick={() => {
                const first = chapters.find(chapter => chapter.canReadContent !== false);
                if (first) navigate(`${readerPath(book)}?chapter=${first.id}`, { replace: true });
              }}>İlk açık bölümü oku</button>
              <button className="ui-text-link" onClick={() => navigate(bookPath(book))}>Kitap detayına dön</button>
            </RegistrationCard> : locked ? currentChapter.accessStatus === 'UNAVAILABLE' ? <p role="status">Bu bölüm artık erişilebilir değil. Kitabın diğer bölümlerine dönebilirsin.</p> : <HiddenChapterNotice chapter={currentChapter} bookId={bookId} /> : chapterLoading && !chapterReady ? <p role="status">Bölüm yükleniyor...</p> : chapterError || !chapterReady ?
              <p className="ui-notice" role="alert">Bölüm yüklenemedi. <button className="ui-text-link" onClick={() => refetchChapter()}>Tekrar dene</button></p> : <ParagraphRenderer
              key={currentChapter.id}
              restoreParagraphIndex={restoreParagraphIndex}
              requestedParagraphIndex={currentChapter.id === requestedChapterId ? requestedParagraphIndex : null}
              content={currentChapter.content}
              bookId={bookId}
              chapterId={currentChapter.id}
              bookmark={chapterBookmark}
              onSetBookmark={handleSetBookmark}
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
                  if (registrationRequired) { requestRegistration(readingIntent(currentChapter)); return; }
                  if (!completedChapters.includes(currentChapterIndex)) {
                    toggleChapterCompletion(currentChapterIndex);
                  }
                  if (!isLastChapter) {
                    goToChapter(currentChapterIndex + 1);
                  }
                }}
                disabled={isLastChapter && !registrationRequired && (locked || completedChapters.includes(currentChapterIndex))}
              >
                {registrationRequired ? 'Ücretsiz üyelikle oku' : locked ? (isLastChapter ? 'Okuyuculara kapalı' : 'Sonraki Bölüm') : isLastChapter
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
            {isLastChapter && !locked && (
              <div className="end-marker">✦ SON ✦</div>
            )}
          </div>
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
