import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowBack, 
  FavoriteBorder, 
  Favorite, 
  Share, 
  Comment, 
  BookmarkBorder, 
  Bookmark, 
  MenuBook, 
  Edit,
  Delete,
  CardGiftcard // YENİ: Bağış ikonu
} from '@mui/icons-material';
import { useQuery, useMutation } from '@apollo/client';

// IMPORTLAR
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';
import { GET_USER_BY_ID, ME_QUERY } from '../../graphql/queries/user';
import { LIKE_BOOK_MUTATION, DELETE_BOOK_MUTATION } from '../../graphql/mutations/book';
import { TOGGLE_SAVED_BOOK_MUTATION } from '../../graphql/mutations/user';
import { CREATE_COMMENT_MUTATION } from '../../graphql/mutations/comment';

import './BookDetailPage.css';
import CommentList from './CommentList';

const BookDetailPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const { id } = useParams();
  const navigate = useNavigate();

  const currentUserId = localStorage.getItem('userId');
  const [commentText, setCommentText] = useState("");

  // 1. KİTAP VERİSİ (Yazar bilgisi artık bunun içinde geliyor!)
  const {
    data,
    loading,
    error,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id },
  });

  const book = data ? data.getBookById : null;

  // --- SİLME MUTASYONU ---
  const [deleteBook, { loading: deleting }] = useMutation(DELETE_BOOK_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
    onCompleted: () => {
        alert("Kitap başarıyla silindi.");
        navigate('/profile'); 
    },
    onError: (err) => {
        alert("Silme işlemi başarısız: " + err.message);
    }
  });

  const handleDelete = async () => {
    if (window.confirm("Bu kitabı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
       await deleteBook({ variables: { id: id } });
    }
  };

  // --- ESKİ YAZAR SORGUSU SİLİNDİ ---
  // Artık book.author var.

  // 2. MEVCUT KULLANICI VERİSİ (Role ve SavedBooks için)
  const {
    data: currentUserData,
    loading: currentUserLoading
  } = useQuery(GET_USER_BY_ID, {
    variables: { id: currentUserId },
    skip: !currentUserId, 
  });

  // 3. MUTASYONLAR
  const [likeBook] = useMutation(LIKE_BOOK_MUTATION);
  const [toggleSavedBook] = useMutation(TOGGLE_SAVED_BOOK_MUTATION);
  
  const [createComment, { loading: commentLoading }] = useMutation(CREATE_COMMENT_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_BY_ID, variables: { id } }],
    onCompleted: () => {
      setCommentText(""); 
    },
    onError: (err) => {
      console.error("Yorum ekleme hatası:", err);
      alert("Yorum gönderilemedi: " + err.message);
    }
  });

  const [showShareToast, setShowShareToast] = useState(false);

  // Yükleniyor durumu
  if (loading) return <div className="loading-container">Yükleniyor...</div>;
  if (error) return <p>Hata: {error.message}</p>;
  if (!book) return null;

  // --- VERİ HAZIRLIĞI ---
  const author = book.author; // Backend'den gelen obje
  const authorId = book.authorId; // ID karşılaştırması için

  // --- MANTIK KONTROLLERİ ---
  const isAuthor = currentUserId && authorId === currentUserId;
  const isAdmin = currentUserData?.getUserById?.role === 'ADMIN';

  const isLiked = book.likedBy && currentUserId 
    ? book.likedBy.includes(currentUserId) 
    : false;

  const savedBooks = currentUserData?.getUserById?.savedBooks || [];
  const isSaved = savedBooks.some(savedBook => 
    (typeof savedBook === 'string' ? savedBook : savedBook.id) === book.id
  );

  // --- HANDLERS ---
  const handleLike = async () => {
    if (!currentUserId) return alert("Beğenmek için giriş yapmalısınız.");
    try {
      await likeBook({ variables: { bookId: book.id } });
    } catch (err) {
      if (err.message && err.message.includes("Invalid or expired token")) {
        alert("Oturum süreniz dolmuş.");
        localStorage.removeItem('token');
        window.location.reload(); 
      }
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return alert("Kaydetmek için giriş yapmalısınız.");
    try {
      await toggleSavedBook({
        variables: { bookId: book.id },
        refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: currentUserId } }]
      });
    } catch (err) {
      console.error("Kaydetme hatası:", err);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 3000);
  };

  const handleCommentSubmit = async () => {
    if (!currentUserId) return alert("Yorum yapmak için giriş yapmalısınız.");
    if (!commentText.trim()) return; 
    try {
      await createComment({
        variables: {
          bookId: book.id,
          content: commentText
        }
      });
    } catch (e) { }
  };

  const formattedPublishDate = book.publishDate 
    ? new Date(book.publishDate).toLocaleDateString() 
    : 'Bilinmiyor';

  // Yazar İsmi Belirleme
  const displayAuthorName = author?.fullName || author?.username || "Bilinmeyen Yazar";

  return (
    <div className="book-detail-container">
      <nav className="detail-nav">
        <Link to="/feed" className="back-button">
          <ArrowBack /> Kitaplığa Dön
        </Link>
      </nav>

      <main className="detail-main">
        {/* SOL PANEL: KAPAK VE BİLGİLER */}
        <div className="left-panel">
          <img 
            src={book.imageUrl} 
            alt={book.title} 
            className="book-cover" 
            onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=Resim+Yok'; }}
          />
          
          <div className="quick-info">
            <div className="info-item">
              <span className="label">Kategori:</span>
              <span className="value" style={{textTransform: 'capitalize'}}>{book.genre}</span>
            </div>
            <div className="info-item">
              <span className="label">Sayfa Sayısı:</span>
              <span className="value">{book.pageCount}</span>
            </div>
            <div className="info-item">
              <span className="label">Yayın Tarihi:</span>
              <span className="value">{formattedPublishDate}</span>
            </div>
             <div className="info-item">
              <span className="label">Beğeni:</span>
              <span className="value">{book.stats?.likes || 0}</span>
            </div>
            {/* YENİ: Bağışçı Sayısı */}
            <div className="info-item">
              <span className="label">Destekleyen:</span>
              <span className="value">{book.backerCount || 0} Kişi</span>
            </div>
          </div>
        </div>

        {/* SAĞ PANEL: İÇERİK */}
        <div className="right-panel">
          <h1 className="book-title">{book.title}</h1>
          
          <div className="author-section">
             <span className="by">Yazar:</span>
             <Link 
               to={`/user/${authorId}`} 
               className="author-name-link"
               style={{ textDecoration: 'none', color: 'inherit', fontWeight: 'bold' }} 
             >
               <span className="author-name">{displayAuthorName}</span>
             </Link>
          </div>

          <div className="action-buttons">
            <div className="secondary-actions">
              <button className="icon-button" onClick={handleLike} title="Beğen">
                {isLiked ? <Favorite style={{ color: '#e91e63' }} /> : <FavoriteBorder />}
              </button>
              
              <button className="icon-button" onClick={handleShare} title="Linki Kopyala">
                <Share />
              </button>
              
              <button className="icon-button" onClick={handleSave} title="Kaydet">
                {isSaved ? <Bookmark style={{ color: '#007bff' }} /> : <BookmarkBorder />}
              </button>
            </div>
          </div>

          <div className="primary-buttons-container">
            {/* 1. OKU BUTONU */}
            <Link 
              to={`/book-reader/${book.id}`} 
              className="read-book-button"
            >
              <MenuBook fontSize="small" style={{marginRight: '5px'}}/> Oku
            </Link>

            {/* 2. YENİ: DESTEK OL BUTONU (Iyzico) */}
            <Link 
              to={`/donate/${book.id}`} 
              className="donate-button"
              style={{
                  backgroundColor: '#10b981', // Yeşil
                  color: 'white',
                  textDecoration: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 'bold',
                  marginLeft: '10px'
              }}
            >
              <CardGiftcard fontSize="small" style={{marginRight: '5px'}}/> Destek Ol
            </Link>

            {/* YAZAR İŞLEMLERİ */}
            {isAuthor && (
              <Link 
                to={`/dashboard/${book.id}`} 
                className="continue-writing-button"
                style={{ marginLeft: '10px' }}
              >
                <Edit fontSize="small" style={{marginRight: '5px'}}/> Düzenle
              </Link>
            )}
            
            {(isAuthor || isAdmin) && (
                <button 
                  onClick={handleDelete} 
                  className="delete-book-btn"
                  disabled={deleting}
                  style={{ 
                      backgroundColor: '#d32f2f', 
                      color: 'white', 
                      border: 'none', 
                      padding: '10px 20px', 
                      borderRadius: '5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginLeft: '10px'
                  }}
               >
                  <Delete fontSize="small"/> 
                  {deleting ? "Siliniyor..." : "Sil"}
               </button>
            )}
          </div>

          <div className="description-section">
            <h3>Hikaye Özeti</h3>
            <p className="book-description">{book.description}</p>
          </div>


          <div className="comments-section">
            <h3>Yorumlar ({book.commentCount || 0})</h3>
            <div className="comment-form">
              <textarea 
                placeholder="Yorumunuzu yazın..." 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button 
                className="submit-comment" 
                onClick={handleCommentSubmit}
                disabled={commentLoading}
              >
                <Comment /> {commentLoading ? "..." : "Gönder"}
              </button>
            </div>
            
            <CommentList 
              comments={book.comments} 
              currentUserId={currentUserId}
              bookId={book.id}
            />
          </div>
        </div>
      </main>

      {showShareToast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#333',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          Link kopyalandı!
        </div>
      )}
    </div>
  );
};

export default BookDetailPage;