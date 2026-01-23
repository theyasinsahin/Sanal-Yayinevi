import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  Add, 
  Save, 
  FolderOpen, 
  Edit, 
  Visibility, 
  Delete,
  ArrowBack
} from '@mui/icons-material';

// --- LOGIC & DATA ---
import { useQuery, useMutation } from '@apollo/client';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book'; 
import { UPDATE_BOOK_STATUS_MUTATION } from '../../graphql/mutations/book';
import { CREATE_CHAPTER_MUTATION, UPDATE_CHAPTER_MUTATION, DELETE_CHAPTER_MUTATION } from '../../graphql/mutations/chapter';
import { parseContentToPages } from '../../utils/htmlPageSplitter';

// --- UI KIT ---
import { Button } from '../../components/UI/Button';
import { Typography } from '../../components/UI/Typography';
import { Input } from '../../components/UI/Input';
import { Toast } from '../../components/UI/Toast';
import { Badge } from '../../components/UI/Badge';
import { Select } from '../../components/UI/Select';
import { CostCalculatorModal } from '../../components/Books/CostCalculatorModal';

import './BookDashboard.css';

const BookDashboard = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();

  // --- QUERY & MUTATIONS ---
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !bookId,
    fetchPolicy: "network-only" 
  });

  // Status Mutation
  const [updateStatus, { loading: statusLoading }] = useMutation(UPDATE_BOOK_STATUS_MUTATION, {
     refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }]
  });

  const [addChapter] = useMutation(CREATE_CHAPTER_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId } }]
  });
  
  const [saveChapterContent] = useMutation(UPDATE_CHAPTER_MUTATION);
  const [deleteChapterMutation] = useMutation(DELETE_CHAPTER_MUTATION);

  // --- STATE ---
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [content, setContent] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [notification, setNotification] = useState({ isVisible: false, message: '', type: '' });
  const [showCostModal, setShowCostModal] = useState(false);

  const isJustLoaded = useRef(false);

  // --- HANDLERS ---
  
  // 1. Taslak <-> Yayında Geçişi
  const togglePublish = async () => {
     const newStatus = book.status === 'DRAFT' ? 'WRITING' : 'DRAFT';
     if(window.confirm(newStatus === 'WRITING' ? "Kitap herkese görünür olacak. Onaylıyor musunuz?" : "Kitap yayından kaldırılıp taslağa çekilecek.")) {
        await updateStatus({ variables: { bookId, status: newStatus } });
     }
  };

  // 2. Tamamlandı İşaretleme
  const markAsCompleted = async () => {
     if(window.confirm("Kitabın yazım aşamasını bitirdiniz mi?")) {
        await updateStatus({ variables: { bookId, status: 'COMPLETED' } });
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

  // --- EFFECT: DATA LOAD ---
  useEffect(() => {
    if (bookData && bookData.getBookById) {
      const fetchedBook = bookData.getBookById;
      setBook(fetchedBook);
      const fetchedChapters = fetchedBook.chapters || [];
      setChapters(fetchedChapters);

      // İlk yüklemede, eğer bölüm varsa ve henüz bir seçim yapılmamışsa
      if (!selectedChapter && fetchedChapters.length > 0) {
        isJustLoaded.current = true;
        setSelectedChapter(fetchedChapters[0].id);
        setContent(fetchedChapters[0].content || '');
        setIsSaved(true);
      }
    }
  }, [bookData]);

  // --- HANDLERS ---

  const handleContentChange = (value) => {
    setContent(value);
    if (isJustLoaded.current) {
      isJustLoaded.current = false;
      return;
    }
    setIsSaved(false);
  };

  const handleChapterSelect = (chapterId) => {
    const switchChapter = () => {
      isJustLoaded.current = true;
      const chapter = chapters.find(c => c.id === chapterId);
      setSelectedChapter(chapterId);
      setContent(chapter?.content || '');
      setIsSaved(true);
    };
    
    if (!isSaved) {
      if (window.confirm('Değişiklikleriniz kaydedilmedi. Devam etmek istiyor musunuz?')) {
        switchChapter();
      }
    } else {
      switchChapter();
    }
  };

  const addNewChapter = async () => {
    if (newChapterTitle.trim() && bookId) {
      try {
        await addChapter({
          variables: {
            bookId: bookId,
            title: newChapterTitle,
            content: '',
          },
        });
        setNewChapterTitle('');
      } catch (err) {
        alert("Hata: " + err.message);
      }
    }
  };

  const handleDeleteChapter = async (e, chapterId) => {
    e.stopPropagation(); 
    if (window.confirm("Bu bölümü silmek istediğinize emin misiniz?")) {
      try {
        await deleteChapterMutation({ variables: { id: chapterId } });
        setChapters(prev => prev.filter(c => c.id !== chapterId));
        if (selectedChapter === chapterId) {
            setSelectedChapter(null);
            setContent('');
            setIsSaved(true);
        }
        showNotification('Bölüm silindi', 'success');
      } catch (err) {
        alert("Silme hatası: " + err.message);
      }
    }
  };

  const saveChapter = async () => {
    if (selectedChapter) {
      try {
        const currentChapterTitle = chapters.find(c => c.id === selectedChapter)?.title || "";
        const calculatedPages = parseContentToPages(content, currentChapterTitle);
        const pageCount = calculatedPages.length;

        const { data: updatedData } = await saveChapterContent({
          variables: {
            chapterId: selectedChapter,
            content: content,
            pageCount: pageCount 
          },
        });

        if (updatedData && updatedData.updateChapter) {
          setChapters(prev => prev.map(ch => 
            ch.id === selectedChapter ? { ...ch, content, pageCount } : ch
          ));
          setIsSaved(true);
          showNotification('Kaydedildi!', 'success');
        }
      } catch (err) {
        showNotification('Hata oluştu', 'error');
      }
    }
  };

  const showNotification = (message, type) => {
    setNotification({ isVisible: true, message, type });
    setTimeout(() => setNotification({ isVisible: false, message: '', type: '' }), 3000);
  };

  // --- RENDER ---
  if (bookLoading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (bookError) return <div className="p-8 text-center text-red-600">Hata: {bookError.message}</div>;

  return (
    <div className="dashboard-container">
      
      {/* --- SIDEBAR --- */}
      <aside className="dashboard-sidebar">
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
           <Link to={`/book-reader/${bookId}`} className="w-full no-underline">
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
            <Button variant="secondary" size="small" onClick={addNewChapter} className="w-full">
               <Add fontSize="small" /> Ekle
            </Button>
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
                  <span className="chapter-title-text">{chapter.title}</span>
                </div>
                <button 
                  className="delete-btn"
                  onClick={(e) => handleDeleteChapter(e, chapter.id)}
                >
                  <Delete fontSize="small" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="status-management-panel p-4 border-t mt-4">
             <Typography variant="h6" className="mb-2">Yayın Durumu</Typography>
             
             <div className="mb-4">
                <Badge variant={
                    book?.status === 'PUBLISHED' ? 'success' : 
                    book?.status === 'FUNDING' ? 'warning' :
                    book?.status === 'DRAFT' ? 'neutral' : 'primary'
                }>
                    {book?.status}
                </Badge>
             </div>

             <div className="flex flex-col gap-2">
                {/* DRAFT / WRITING DÖNGÜSÜ */}
                {(book?.status === 'DRAFT' || book?.status === 'WRITING') && (
                    <Button 
                      variant={book.status === 'DRAFT' ? 'success' : 'danger'} 
                      size="small" 
                      onClick={togglePublish}
                      isLoading={statusLoading}
                      className="w-full"
                    >
                       {book.status === 'DRAFT' ? 'Yayınla (Görünür Yap)' : 'Taslağa Çek'}
                    </Button>
                )}

                {/* WRITING -> COMPLETED */}
                {book?.status === 'WRITING' && (
                    <Button 
                      variant="primary" 
                      size="small" 
                      onClick={markAsCompleted}
                      className="w-full"
                    >
                       Yazımı Tamamla
                    </Button>
                )}

                {/* COMPLETED -> FUNDING (Hesaplama) */}
                {book?.status === 'COMPLETED' && (
                    <Button 
                      variant="warning" 
                      size="small" 
                      onClick={() => setShowCostModal(true)}
                      className="w-full"
                    >
                       Baskı Maliyeti Hesapla
                    </Button>
                )}
             </div>
          </div>
      </aside>

      {/* --- EDITOR AREA --- */}
      <main className="dashboard-main">
        {selectedChapter ? (
          <>
            <header className="editor-topbar">
              <div className="topbar-left">
                <Typography variant="h5" weight="bold">
                  {chapters.find(c => c.id === selectedChapter)?.title}
                </Typography>
                <Badge variant={isSaved ? 'success' : 'warning'}>
                  {isSaved ? 'Kaydedildi' : 'Kaydedilmedi'}
                </Badge>
              </div>
              <Button 
                variant="primary" 
                onClick={saveChapter} 
                disabled={isSaved}
                icon={<Save />}
              >
                Kaydet
              </Button>
            </header>

            <div className="quill-wrapper">
              <ReactQuill
                theme="snow"
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
               Düzenlemek için soldan bir bölüm seçin veya yeni bir bölüm oluşturun.
             </Typography>
          </div>
        )}
      </main>

      {/* MODAL: BASKI MALİYETİ HESAPLAMA */}
       {showCostModal && (
          <CostCalculatorModal 
             book={book} 
             pageCount={book.pageCount}
             onClose={() => setShowCostModal(false)}
             onConfirm={async (data) => {
                 await updateStatus({ 
                     variables: { 
                        bookId, 
                        status: 'FUNDING',
                        fundingTarget: data.totalCost,
                        printConfig: data.config
                     } 
                 });
                 setShowCostModal(false);
                 alert("Kitap fonlamaya açıldı!");
             }}
          />
       )}

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