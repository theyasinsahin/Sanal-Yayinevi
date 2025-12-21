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
  Delete
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

  // 1. KİTAP VERİSİ
  const {
    data,
    loading,
    error,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id },
  });

  const book = data ? data.getBookById : { comments: [], likedBy: [] };
  const authorId = book?.authorId; 

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

  // 2. YAZAR VERİSİ
  const {
      data: authorData,
      loading: authorLoading,
      error: authorError,
    } = useQuery(GET_USER_BY_ID, {
      variables: { id: authorId },
      skip: !authorId, 
    });

  // 3. MEVCUT KULLANICI VERİSİ (Role bilgisini buradan alıyoruz)
  const {
    data: currentUserData,
    loading: currentUserLoading // Bunu isLoading kontrolüne eklemek iyi olur
  } = useQuery(GET_USER_BY_ID, {
    variables: { id: currentUserId },
    skip: !currentUserId, 
  });

  // 4. MUTASYONLAR
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

  // --- MANTIK KONTROLLERİ ---
  const isAuthor = currentUserId && authorId === currentUserId;
  
  // currentUserData henüz yüklenmediyse isAdmin false olur, yüklendiğinde re-render tetiklenir ve true olur.
  const isAdmin = currentUserData?.getUserById?.role === 'ADMIN';

  const isLiked = book.likedBy && currentUserId 
    ? book.likedBy.includes(currentUserId) 
    : false;

  const savedBooks = currentUserData?.getUserById?.savedBooks || [];
  const isSaved = savedBooks.some(savedBook => 
    (typeof savedBook === 'string' ? savedBook : savedBook.id) === book.id
  );

  // currentUserLoading'i de ekledik ki rol gelmeden sayfa tam oturmuş sanmasın
  const isLoading = loading || (authorId && authorLoading); 

  // --- HANDLERS ---
  const handleLike = async () => {
    if (!currentUserId) return alert("Beğenmek için giriş yapmalısınız.");
    try {
      await likeBook({ variables: { bookId: book.id } });
    } catch (err) {
      if (err.message && err.message.includes("Invalid or expired token")) {
        alert("Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.");
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.reload(); 
      } else {
        console.error("Beğeni hatası:", err);
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

  if (isLoading) return <p>Yükleniyor...</p>;
  if (error) return <p>Kitap yüklenirken hata oluştu: {error.message}</p>;
  if (authorError) return <p>Yazar yüklenirken hata oluştu: {authorError.message}</p>;

  const formattedPublishDate = book.publishDate 
    ? new Date(book.publishDate).toLocaleDateString() 
    : 'Bilinmiyor';

  return (
    <div className="book-detail-container">
      <nav className="detail-nav">
        <Link to="/feed" className="back-button">
          <ArrowBack /> Kitaplığa Dön
        </Link>
      </nav>

      <main className="detail-main">
        <div className="left-panel">
          <img 
            src={book.imageUrl} 
            alt={book.title} 
            className="book-cover" 
          />
          
          <div className="quick-info">
            <div className="info-item">
              <span className="label">Kategori:</span>
              <span className="value">{book.genre}</span>
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
          </div>
        </div>

        <div className="right-panel">
          <h1 className="book-title">{book.title}</h1>
          <div className="author-section">
          <span className="by">Yazar:</span>
          
          {/* Link Bileşeni Eklendi */}
          <Link 
            to={`/user/${authorId}`} 
            className="author-name-link"
            style={{ textDecoration: 'none', color: 'inherit' }} // İstersen CSS class'ı ile de yapabilirsin
          >
            <span className="author-name">
              {authorData?.getUserById?.fullName} ({authorData?.getUserById?.username})
            </span>
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
            {/* HERKES GÖREBİLİR: OKU BUTONU */}
            <Link 
              to={`/book-reader/${book.id}`} 
              className="read-book-button"
            >
              <MenuBook fontSize="small" style={{marginRight: '5px'}}/> Kitabı Oku
            </Link>

            {/* SADECE YAZAR GÖREBİLİR: DÜZENLE BUTONU */}
            {isAuthor && (
              <Link 
                to={`/dashboard/${book.id}`} 
                className="continue-writing-button"
              >
                <Edit fontSize="small" style={{marginRight: '5px'}}/> Yazmaya Devam Et
              </Link>
            )}
            
            {/* YAZAR VEYA ADMIN GÖREBİLİR: SİL BUTONU */}
            {/* Buradaki mantık hatasını düzelttik: Artık isAuthor bloğunun dışında bağımsız bir kontrol */}
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
                  {deleting ? "Siliniyor..." : "Kitabı Sil"}
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
                <Comment /> {commentLoading ? "Gönderiliyor..." : "Gönder"}
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