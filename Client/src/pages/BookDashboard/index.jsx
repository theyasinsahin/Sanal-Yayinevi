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
import { CREATE_CHAPTER_MUTATION, UPDATE_CHAPTER_MUTATION, DELETE_CHAPTER_MUTATION } from '../../graphql/mutations/chapter';
import { parseContentToPages } from '../../utils/htmlPageSplitter';

// --- UI KIT ---
import { Button } from '../../components/UI/Button';
import { Typography } from '../../components/UI/Typography';
import { Input } from '../../components/UI/Input';

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
  
  const isJustLoaded = useRef(false);

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
                <span className={`status-badge ${isSaved ? 'saved' : 'unsaved'}`}>
                  {isSaved ? 'Kaydedildi' : 'Kaydedilmedi'}
                </span>
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

      {/* Notification Toast */}
      {notification.isVisible && (
        <div className={`toast-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

    </div>
  );
};

export default BookDashboard;