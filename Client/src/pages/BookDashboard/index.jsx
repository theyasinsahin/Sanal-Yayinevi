import { hasChapterContent } from '../../utils/chapterContent';
import ClassificationEditor from '../../components/Books/Classification/ClassificationEditor';
import { bookPath, readerPath } from '../../utils/publicPaths';
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate, useBlocker } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  Add, 
  Save, 
  FolderOpen, 
  MenuOpen,
  Close,
  Visibility, 
  Delete,
  ArrowBack
} from '@mui/icons-material';

// --- LOGIC & DATA ---
import { useQuery, useMutation } from '@apollo/client';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book'; 
import { UPDATE_BOOK_STATUS_MUTATION } from '../../graphql/mutations/book';
import { CREATE_CHAPTER_MUTATION, UPDATE_CHAPTER_MUTATION, DELETE_CHAPTER_MUTATION, SET_CHAPTER_VISIBILITY } from '../../graphql/mutations/chapter';
import { parseContentToPages } from '../../utils/htmlPageSplitter';
import useChapterAutosave from '../../hooks/useChapterAutosave';
import SocialShareButton from '../../components/Sharing/SocialShareButton';

// --- UI KIT ---
import { Button } from '../../components/UI/Button';
import { Typography } from '../../components/UI/Typography';
import { Input } from '../../components/UI/Input';
import { Toast } from '../../components/UI/Toast';
import { Badge } from '../../components/UI/Badge';

import { useAuth } from '../../context/AuthContext';
import './BookDashboard.css';

const BookDashboard = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  const { user } = useAuth();

  // --- QUERY & MUTATIONS ---
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !bookId,
    fetchPolicy: "network-only" 
  });
  const fetchedBook = bookData?.getBookById;

  // Status Mutation
  const [updateStatus, { loading: statusLoading }] = useMutation(UPDATE_BOOK_STATUS_MUTATION, {
     refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }],
     awaitRefetchQueries: true
  });

  const [addChapter] = useMutation(CREATE_CHAPTER_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }],
    awaitRefetchQueries: true,
  });
  
  const [saveChapterContent] = useMutation(UPDATE_CHAPTER_MUTATION);
  const [setChapterVisibility] = useMutation(SET_CHAPTER_VISIBILITY, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }], awaitRefetchQueries: true,
  });
  const [deleteChapterMutation] = useMutation(DELETE_CHAPTER_MUTATION);

  const persistChapter = useCallback(async ({ chapterId, content, title }) => {
    const pageCount = parseContentToPages(content, title).length;
    const response = await saveChapterContent({ variables: { chapterId, content, pageCount } });
    if (!response.data?.updateChapter) throw new Error('Bölüm kaydedilemedi.');
    return response.data.updateChapter;
  }, [saveChapterContent]);
  const { manager, chapters, selectedChapter, content, status: saveStatus, hasUnsaved } = useChapterAutosave({ bookId, save: persistChapter });

  // --- STATE ---
  const [book, setBook] = useState(null);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterHidden, setNewChapterHidden] = useState(false);
  const [notification, setNotification] = useState({ isVisible: false, message: '', type: '' });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const dashboardRef = useRef(null);
  const chapterActionsRef = useRef(null);
  const [isActionBusy, setIsActionBusy] = useState(false);
  const actionBusy = useRef(false);
  const notificationTimer = useRef(null);
  const showNotification = useCallback((message, type) => {
    clearTimeout(notificationTimer.current);
    setNotification({ isVisible: true, message, type });
    notificationTimer.current = setTimeout(() => setNotification({ isVisible: false, message: '', type: '' }), 3000);
  }, []);
  useEffect(() => () => clearTimeout(notificationTimer.current), []);
  const blocker = useBlocker(manager.hasUnsaved);
  const { state: blockerState, proceed, reset } = blocker;
  const editorLocked = isActionBusy || blockerState === 'blocked';
  useEffect(() => {
    if (blockerState !== 'blocked') return undefined;
    let active = true;
    manager.flush().then(() => { if (active) proceed(); }).catch(() => {
      if (!active) return;
      showNotification('Değişiklikler kaydedilemedi.', 'error');
      if (window.confirm('Değişiklikler kaydedilemedi. Kaydetmeden ayrılmak istiyor musunuz?')) proceed();
      else reset();
    });
    return () => { active = false; };
  }, [blockerState, proceed, reset, manager, showNotification]);

  const runAfterSaving = async operation => {
    if (actionBusy.current || blockerState === 'blocked') return false;
    actionBusy.current = true; setIsActionBusy(true);
    try {
      await manager.flush();
      await operation();
      return true;
    } catch (error) {
      showNotification(error.message || 'İşlem tamamlanamadı. Değişiklikleriniz korunuyor.', 'error');
      return false;
    } finally { actionBusy.current = false; setIsActionBusy(false); }
  };

  // Gerçek üst konuma göre kalan yüksekliği hesapla. Böylece navbar veya
  // üst layout boşlukları için sabit 64px gibi bir tahminde bulunmayız.
  useLayoutEffect(() => {
    const element = dashboardRef.current;
    if (!element) return undefined;

    // Başka bir sayfadan kalan scroll pozisyonu editörün üstünü kesmesin.
    window.scrollTo(0, 0);

    let frame = null;
    const measure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const viewportOffset = window.visualViewport?.offsetTop ?? 0;
        const top = element.getBoundingClientRect().top - viewportOffset;
        const remaining = Math.max(240, viewportHeight - Math.max(0, top));
        element.style.setProperty('--dashboard-measured-height', `${remaining}px`);
        element.classList.toggle('dashboard-short-viewport', remaining < 500);
        frame = null;
      });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    if (element.parentElement) observer?.observe(element.parentElement);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [bookLoading, bookError, book?.id]);


  // --- HANDLERS ---
  
  // 1. Taslak <-> Yayında Geçişi
  const togglePublish = async () => {
     const newStatus = (book.digitalStatus || (book.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')) === 'DRAFT' ? 'WRITING' : 'DRAFT';
     if(window.confirm(newStatus === 'WRITING' ? "Kitap herkese görünür olacak. Onaylıyor musunuz?" : "Kitap yayından kaldırılıp taslağa çekilecek.")) {
        await runAfterSaving(() => updateStatus({ variables: { bookId, status: newStatus } }));
     }
  };

  // 2. Tamamlandı İşaretleme
  const markAsCompleted = async () => {
     if(window.confirm("Kitabın yazım aşamasını bitirdiniz mi?")) {
        await runAfterSaving(() => updateStatus({ variables: { bookId, status: 'COMPLETED' } }));
     }
  };

  // --- QUILL MODULES ---
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

  // Keep drafts authoritative when mutations or status changes refetch the book.
  useEffect(() => {
    if (!fetchedBook || fetchedBook.id !== bookId) return;
    setBook(fetchedBook);
    manager.load(fetchedBook.chapters || []);
  }, [fetchedBook, bookId, manager]);

  const handleContentChange = (value, delta, source) => {
    if (source === 'api' || source === 'silent' || editorLocked) return;
    manager.edit(value);
  };

  const handleChapterSelect = chapterId => {
    if (chapterId === selectedChapter) { setIsMobileSidebarOpen(false); return; }
    runAfterSaving(() => { manager.select(chapterId); setIsMobileSidebarOpen(false); });
  };

  const addNewChapter = async () => {
    if (!newChapterTitle.trim() || !bookId) return;
    await runAfterSaving(async () => {
      await addChapter({ variables: { bookId, title: newChapterTitle.trim(), content: '', userId: user?.id, ...(newChapterHidden ? { isHidden: true } : {}) } });
      setNewChapterTitle('');
    });
  };

  const handleDeleteChapter = async (event, chapterId) => {
    event.stopPropagation();
    if (!window.confirm('Bu bölümü silmek istediğinize emin misiniz?')) return;
    await runAfterSaving(async () => {
      await deleteChapterMutation({ variables: { id: chapterId } });
      manager.remove(chapterId);
      showNotification('Bölüm silindi', 'success');
    });
  };

  const toggleChapterVisibility = async () => {
    const chapter = chapters.find(item => item.id === selectedChapter);
    if (!chapter) return;
    await runAfterSaving(async () => {
      await setChapterVisibility({ variables: { chapterId: chapter.id, isHidden: !chapter.isHidden } });
    });
  };

  const saveChapter = async () => {
    try { await manager.flush(); showNotification('Kaydedildi!', 'success'); }
    catch { showNotification('Değişiklikler kaydedilemedi. Yeniden deneyin.', 'error'); }
  };
  const saveMessages = { saved: 'Kaydedildi', saving: 'Kaydediliyor…', pending: 'Otomatik kayıt bekleniyor…', error: 'Kaydedilemedi — Kaydet ile tekrar deneyin.' };

  const hasContent = chapters.some(chapter => hasChapterContent(chapter.content));
  const isDraft = (book?.digitalStatus || (book?.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')) === 'DRAFT';
  const isCompleted = book?.writingStatus ? book.writingStatus === 'COMPLETED' : ['COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'].includes(book?.status);

  // --- RENDER ---
  if (bookLoading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (bookError) return <div className="p-8 text-center text-red-600">Hata: {bookError.message}</div>;
  if (!book) return <div className="p-8 text-center">Kitap yükleniyor…</div>;
  if (book.kind === 'PRINTED' && !book.canEditContent) return <div className="ui-notice" role="status">Bu kitaba içerik eklemek için yazar hak talebinizin onaylanması gerekir. <Link className="ui-text-link" to={bookPath(book)}>Kitaba dön</Link></div>;

  return (
    <div className="dashboard-container" ref={dashboardRef}>
      {/* Mobil: bölüm menüsü açılınca editörü örten karartma */}
      {isMobileSidebarOpen && (
        <button
          type="button"
          className="dashboard-sidebar-backdrop"
          aria-label="Bölüm menüsünü kapat"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* --- SIDEBAR --- */}
      <aside
        id="dashboard-chapter-sidebar"
        className={`dashboard-sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`}
      >
        <div className="dashboard-sidebar-mobile-header">
          <strong>Kitap bölümleri</strong>
          <button type="button" className="dashboard-mobile-icon-button"
            aria-label="Menüyü kapat" onClick={() => setIsMobileSidebarOpen(false)}>
            <Close />
          </button>
        </div>
        {/* Kitap Bilgisi */}
        <div className="book-summary">
          <div className="book-cover-mini">
             <img src={book?.imageUrl || 'https://via.placeholder.com/150'} alt="Kapak" />
          </div>
          <div className="book-details-mini">
             <Typography variant="h6" weight="bold" className="truncate">{book?.title}</Typography>
             <Typography variant="caption" color="muted">{chapters.length} Bölüm</Typography>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="sidebar-actions">
           <ClassificationEditor key={book.id} book={book} />
           <Link to={readerPath(book)} className="w-full no-underline">
              <Button variant="outline" size="small" className="w-full" icon={<Visibility fontSize="small"/>}>
                Okuyucu Modu
              </Button>
           </Link>
           <Button 
             variant="ghost" 
             size="small" 
             className="w-full text-left" 
             onClick={() => navigate('/profile')}
             icon={<ArrowBack fontSize="small"/>}
           >
             Profile Dön
           </Button>
        </div>

        <div className="divider"></div>

        {/* Bölüm Listesi */}
        <div className="chapters-section">
          <div className="new-chapter-form">
            <Input 
              placeholder="Yeni Bölüm..." 
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewChapter()}
              className="mb-2"
            />
            <Button variant="secondary" size="small" onClick={addNewChapter} disabled={editorLocked} className="w-full">
               <Add fontSize="small" /> Ekle
            </Button>
            <label className="new-chapter-visibility"><input type="checkbox" checked={newChapterHidden} disabled={editorLocked} onChange={event => setNewChapterHidden(event.target.checked)} /> Yeni bölümü gizli oluştur</label>
          </div>

          <div className="chapter-list-scroll">
            {chapters.map(chapter => (
              <div
                key={chapter.id}
                className={`chapter-row ${selectedChapter === chapter.id ? 'active' : ''}`}
                onClick={() => handleChapterSelect(chapter.id)}
              >
                <div className="chapter-row-content">
                  <FolderOpen fontSize="small" className="folder-icon" />
                  <span className="chapter-title-text">{chapter.title}{chapter.isHidden && <small> · Gizli</small>}</span>
                </div>
                <button 
                  className="delete-btn"
                  disabled={editorLocked}
                  aria-label={`${chapter.title} bölümünü sil`}
                  onClick={(e) => handleDeleteChapter(e, chapter.id)}
                >
                  <Delete fontSize="small" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </aside>

      {/* --- EDITOR AREA --- */}
      <main className="dashboard-main">
        <div className="dashboard-mobile-toolbar">
          <button
            type="button"
            className="dashboard-mobile-chapters-button"
            aria-controls="dashboard-chapter-sidebar"
            aria-expanded={isMobileSidebarOpen}
            onClick={() => setIsMobileSidebarOpen(true)}
          >
            <MenuOpen fontSize="small" />
            Bölümler ({chapters.length})
          </button>
          <span className="dashboard-mobile-book-name">{book?.title}</span>
        </div>
        {book.kind !== 'PRINTED' && (
          <section className="dashboard-publish-bar" aria-label="Yayın yönetimi">
            <div className="dashboard-publish-summary">
              <strong className="dashboard-publish-desktop-status">{isDraft ? 'Kitabınız taslak olarak kayıtlı' : isCompleted ? 'Kitabınızın yazımı tamamlandı' : 'Kitabınız okuyuculara açık'}</strong>
              <strong className="dashboard-publish-mobile-status">{isDraft ? 'Taslak' : isCompleted ? 'Yazım tamamlandı' : 'Yayında'}</strong>
              <p className={!hasContent ? 'dashboard-publish-hint is-required' : 'dashboard-publish-hint'}>{!hasContent ? 'Yayınlamak için en az bir bölüme metin ekleyin.' : isDraft
                ? 'Hazır olduğunuzda yayınlayarak okuyuculara açabilirsiniz.'
                : isCompleted ? 'Destek fonu için basım başvurunuzu oluşturabilir veya mevcut başvurunuzu görebilirsiniz.'
                : 'Yazımı tamamlayabilir veya kitabınızı yeniden taslağa çekebilirsiniz.'}</p>
            </div>
            <div className="dashboard-publish-actions">
              <Button variant={isDraft ? 'primary' : 'danger'} size="small" icon={<Visibility />} onClick={togglePublish}
                disabled={editorLocked || (isDraft && !hasContent)} isLoading={statusLoading || isActionBusy}>
                {isDraft ? 'Yayınla (Görünür Yap)' : 'Taslağa Çek'}
              </Button>
              {!isDraft && !isCompleted && <Button variant="primary" size="small" onClick={markAsCompleted}
                disabled={editorLocked || !hasContent} isLoading={statusLoading || isActionBusy}>Yazımı Tamamla</Button>}
              {!isDraft && isCompleted && <Button variant="primary" size="small"
                disabled={editorLocked} isLoading={isActionBusy}
                aria-label="Destek Fonu İçin Başvur / Başvurumu Gör"
                onClick={() => runAfterSaving(() => navigate(`/print/${bookId}`))}>
                  <span className="dashboard-publish-desktop-status">Destek Fonu İçin Başvur / Başvurumu Gör</span>
                  <span className="dashboard-publish-mobile-status">Destek Fonu</span>
                </Button>}
            </div>
          </section>
        )}
        {selectedChapter ? (
          <>
            <header className="editor-topbar">
              <div className="topbar-left">
                <Typography variant="h5" weight="bold">
                  {chapters.find(c => c.id === selectedChapter)?.title}
                </Typography>
                <span role={saveStatus === 'error' ? 'alert' : 'status'} aria-live="polite" className="editor-save-status">
                  <Badge variant={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'danger' : 'warning'}>{saveMessages[saveStatus]}</Badge>
                </span>
              </div>
              <div className="editor-topbar-actions">
                <details className="editor-chapter-actions" ref={chapterActionsRef}
                  onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
                  onKeyDown={event => {
                    if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
                  }}>
                  <summary aria-label="Bölüm işlemleri" title="Bölüm işlemleri">⋯</summary>
                  <div className="editor-chapter-actions-menu">
                    <Button type="button" variant="ghost" size="small" disabled={editorLocked}
                      aria-pressed={chapters.find(c => c.id === selectedChapter)?.isHidden === true}
                      onClick={() => { chapterActionsRef.current.open = false; toggleChapterVisibility(); }}>
                      {chapters.find(c => c.id === selectedChapter)?.isHidden ? 'Okuyuculara aç' : 'Okuyuculardan gizle'}
                    </Button>
                    {book.status !== 'DRAFT' && !chapters.find(c => c.id === selectedChapter)?.isHidden && <SocialShareButton type="CHAPTER" id={selectedChapter} label="Bölümü paylaş"
                      beforeOpen={async () => { await manager.flush(); if (chapterActionsRef.current) chapterActionsRef.current.open = false; }} disabled={editorLocked} />}
                  </div>
                </details>
              <Button variant="primary" size="small" onClick={saveChapter}
                className="dashboard-save-button"
                aria-label="Bölümü kaydet"
                aria-busy={saveStatus === 'saving'}
                disabled={!hasUnsaved || saveStatus === 'saving' || editorLocked}
                icon={<Save />}
              >
                Kaydet
              </Button>
              </div>
            </header>

            <div className="quill-wrapper">
              <ReactQuill
                theme="snow"
                readOnly={editorLocked}
                value={content}
                onChange={handleContentChange}
                modules={modules}
                placeholder="Hikayenizi buraya yazın..."
              />
            </div>
          </>
        ) : (
          <div className="empty-state">
             <Typography variant="h4" color="muted">Hoşgeldiniz</Typography>
             <Typography variant="body" color="muted">
               Düzenlemek için bir bölüm seçin veya yeni bir bölüm oluşturun.
             </Typography>
             <button
               type="button"
               className="dashboard-empty-action"
               onClick={() => setIsMobileSidebarOpen(true)}
             >
               <FolderOpen fontSize="small" /> Bölümleri Aç
             </button>
          </div>
        )}
      </main>

      <Toast 
        isVisible={notification.isVisible}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, isVisible: false })}
      />

    </div>
  );
};

export default BookDashboard;
