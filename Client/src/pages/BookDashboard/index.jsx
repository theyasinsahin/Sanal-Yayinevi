import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Add, Save, FolderOpen, Edit, Visibility, Delete } from '@mui/icons-material';
import './BookDashboard.css';

import { useQuery, useMutation } from '@apollo/client'; // useApolloClient'a gerek kalmadı
import { GET_BOOK_BY_ID } from '../../graphql/queries/book'; 
import { CREATE_CHAPTER_MUTATION, UPDATE_CHAPTER_MUTATION, DELETE_CHAPTER_MUTATION } from '../../graphql/mutations/chapter';

import { parseContentToPages } from '../../utils/htmlPageSplitter';

const BookDashboard = () => {
  const { bookId } = useParams();

  // 1. TEK SORGU YETERLİ
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !bookId,
    // Bölüm ekleyince/düzenleyince listenin güncel kalması için:
    fetchPolicy: "network-only" 
  });

  const [addChapter] = useMutation(CREATE_CHAPTER_MUTATION, {
    // Bölüm eklenince Kitap sorgusunu yenile ki yeni bölüm listeye gelsin
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id: bookId, pageCount: 0 } }]
  });
  
  const [saveChapterContent] = useMutation(UPDATE_CHAPTER_MUTATION);

  const [deleteChapterMutation] = useMutation(DELETE_CHAPTER_MUTATION);

  // 3. SİLME FONKSİYONU
  const handleDeleteChapter = async (e, chapterId) => {
    // ÖNEMLİ: Buna basınca satırın "onClick" olayının çalışmasını (seçilmesini) engeller.
    e.stopPropagation(); 

    if (window.confirm("Bu bölümü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
      try {
        await deleteChapterMutation({
          variables: { id: chapterId }
        });

        // State'ten silerek anında ekrandan kaldırıyoruz (Refetch beklemeye gerek yok)
        setChapters(prev => prev.filter(c => c.id !== chapterId));

        // Eğer silinen bölüm şu an ekranda açıksa editörü temizle
        if (selectedChapter === chapterId) {
            setSelectedChapter(null);
            setContent('');
            setIsSaved(true);
        }

        setNotification({ isVisible: true, message: 'Bölüm silindi', type: 'success' });
        setTimeout(() => setNotification({ isVisible: false, message: '', type: '' }), 3000);
      } catch (err) {
        alert("Silme hatası: " + err.message);
      }
    }
  };

  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [content, setContent] = useState('');
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const [notification, setNotification] = useState({ isVisible: false, message: '', type: '' });
  const isJustLoaded = useRef(false);

  const modules = useMemo(() => ({
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'header': [1, 2, 3, false] }],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  }), []);

  // 2. USEEFFECT SADELEŞTİRİLDİ
  // Veri geldiğinde state'leri güncellemek yeterli. Ekstra fetch YOK.
  useEffect(() => {
    if (bookData && bookData.getBookById) {
      const fetchedBook = bookData.getBookById;
      setBook(fetchedBook);
      
      // Query'den gelen chapters zaten dolu obje dizisi
      const fetchedChapters = fetchedBook.chapters || [];
      setChapters(fetchedChapters);

      // Eğer seçili bölüm yoksa ve bölümler varsa ilkini seç
      if (!selectedChapter && fetchedChapters.length > 0) {
        isJustLoaded.current = true;
        setSelectedChapter(fetchedChapters[0].id);
        setContent(fetchedChapters[0].content || '');
        setIsSaved(true);
      }
    }
  }, [bookData]); // selectedChapter bağımlılığını kaldırdım ki sonsuz döngü olmasın

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
        // refetchQueries kullandığımız için burada manuel setChapters yapmaya gerek yok,
        // ama kullanıcı deneyimi için (loading beklemeden) state güncelleyebiliriz:
        setNewChapterTitle('');
        // setSelectedChapter vs işlemlerini useEffect'e bırakabiliriz veya 
        // mutation dönüş değerini kullanabiliriz.
      } catch (err) {
        console.error("Bölüm eklenemedi:", err.message);
        alert("Hata: " + err.message);
      }
    }
  };

  const saveChapter = async () => {
    if (selectedChapter) {
      try {
        // 1. HESAPLAMA: İçeriğin kaç sayfa tuttuğunu hesapla
        // Bölüm başlığı hesaplamayı etkilemediği için boş string geçebilirsin veya state'ten alabilirsin
        const currentChapterTitle = chapters.find(c => c.id === selectedChapter)?.title || "";
        const calculatedPages = parseContentToPages(content, currentChapterTitle);
        // Dizi uzunluğu = Sayfa Sayısı
        const pageCount = calculatedPages.length;

        // 2. GÖNDERME: pageCount'u mutation'a ekle
        const { data: updatedData } = await saveChapterContent({
          variables: {
            chapterId: selectedChapter,
            content: content,
            pageCount: pageCount 
          },
        });

        // 3. STATE GÜNCELLEME
        if (updatedData && updatedData.updateChapter) {
          setChapters(prev => prev.map(ch => 
            ch.id === selectedChapter ? { ...ch, content, pageCount } : ch
          ));
          setIsSaved(true);

        setNotification({ isVisible: true, message: 'Kaydedildi!', type: 'success' });
        setTimeout(() => setNotification({ isVisible: false, message: '', type: '' }), 3000);        
      }
      } catch (err) {
        console.error("Bölüm kaydedilemedi:", err);
        setNotification({ isVisible: true, message: 'Hata oluştu', type: 'error' });
      }
    }
  };


  



  if (!bookId) return <div className="book-dashboard"><h2>Geçersiz Kitap ID</h2></div>;
  if (bookLoading) return <div className="book-dashboard"><p>Yükleniyor...</p></div>;
  if (bookError) return <div className="book-dashboard"><p>Hata: {bookError.message}</p></div>;
  if (!book) return <div className="book-dashboard"><h2>Kitap Bulunamadı</h2></div>;
  
  return (
    <div className="book-dashboard">
      <div className="sidebar">
         <div className="book-info-dashboard">
          <img 
            src={book?.imageUrl || 'https://via.placeholder.com/200x300'} 
            alt={book?.title} 
            className="book-cover"
          />
          <h2 title={book?.title}>{book?.title}</h2>
          
          <div className="stats">
            <span>{chapters.length} Bölüm</span>
            <span>{book?.genre}</span>
          </div>

          <Link to={`/book-reader/${bookId}`} className="preview-button">
             <Visibility fontSize="small" /> Okuyucu Modu
          </Link>
          <Link to={`/book-detail/${bookId}`} className="preview-button secondary">
             <Visibility fontSize="small" /> Detay Sayfası
          </Link>
        </div>

        <div className="chapter-management">
          <div className="new-chapter">
            <input
              type="text"
              placeholder="Yeni Bölüm Başlığı"
              value={newChapterTitle}
              onChange={(e) => setNewChapterTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addNewChapter()}
            />
            <button onClick={addNewChapter}>
              <Add fontSize="small" />
            </button>
          </div>

          <div className="chapter-list">
            {chapters.map(chapter => (
              <div
                key={chapter.id}
                className={`chapter-item ${selectedChapter === chapter.id ? 'active' : ''}`}
                onClick={() => handleChapterSelect(chapter.id)}
              >
                {/* Sol Kısım: İkon ve Başlık */}
                <div className="chapter-item-left">
                  <FolderOpen className="icon" fontSize="small" />
                  <span className="title" title={chapter.title}>{chapter.title}</span>
                </div>

                {/* Sağ Kısım: Silme Butonu */}
                <button 
                  className="delete-chapter-btn"
                  onClick={(e) => handleDeleteChapter(e, chapter.id)}
                  title="Bölümü Sil"
                >
                  <Delete fontSize="small" />
                </button>

              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="editor-area">
        {selectedChapter ? (
           <>
            <div className="editor-header">
              <h3>
                <Edit fontSize="small" /> {chapters.find(c => c.id === selectedChapter)?.title}
              </h3>
              <button 
                onClick={saveChapter} 
                className={`save-btn ${isSaved ? 'saved' : 'unsaved'}`}
                disabled={isSaved}
              >
                <Save fontSize="small" /> {isSaved ? "Kaydedildi" : "Kaydet"}
              </button>
            </div>
            <ReactQuill
              theme="snow"
              value={content}
              onChange={handleContentChange}
              modules={modules}
              className="custom-quill-editor"
              placeholder="Hikayenizi buraya yazın..."
            />
           </>
        ) : (
            <div className="no-chapter-selected">
                <p>Düzenlemek için soldan bir bölüm seçin veya yeni bölüm ekleyin.</p>
            </div>
        )}
      </div>

    {notification.isVisible && (
        <div className={`notification-snackbar ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default BookDashboard;