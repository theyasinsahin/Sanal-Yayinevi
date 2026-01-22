import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  ArrowBack, 
  FavoriteBorder, 
  Favorite, 
  Share, 
  BookmarkBorder, 
  Bookmark, 
  MenuBook, 
  Edit,
  Delete,
  CardGiftcard,
  Comment as CommentIcon
} from '@mui/icons-material';

// --- GRAPHQL ---
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';
import { GET_USER_BY_ID, ME_QUERY } from '../../graphql/queries/user';
import { LIKE_BOOK_MUTATION, DELETE_BOOK_MUTATION } from '../../graphql/mutations/book';
import { TOGGLE_SAVED_BOOK_MUTATION } from '../../graphql/mutations/user';
import { CREATE_COMMENT_MUTATION } from '../../graphql/mutations/comment';
import { GET_COMMENTS_BY_BOOK_ID } from '../../graphql/queries/comment';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Badge } from '../../components/UI/Badge';
import { Toast } from '../../components/UI/Toast';
import { Textarea } from '../../components/UI/Textarea';

// --- COMPONENTS ---
import CommentList from '../../components/Comments/CommentList';

import './BookDetail.css';

const BookDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserId = localStorage.getItem('userId');
  const [commentText, setCommentText] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // --- QUERIES ---
  // 1. KİTAP SORGUSU (Artık yorumları getirmiyor, daha hafif)
  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_BY_ID, {
    variables: { id }
  });

  // 2. YORUM SORGUSU (Ayrı bir sorgu)
  // fetchPolicy: "cache-and-network" diyerek yorum eklendiğinde güncel kalmasını sağlıyoruz
  const { 
    data: commentsData, 
    loading: commentsLoading,
    refetch: refetchComments // Yorum eklenince tetiklemek için
  } = useQuery(GET_COMMENTS_BY_BOOK_ID, {
    variables: { bookId: id },
    fetchPolicy: "cache-and-network"
  });

  const book = bookData ? bookData.getBookById : null;

  // Gelen ham (düz) yorum listesi
  const rawComments = commentsData ? commentsData.getCommentsByBookId : [];

  const { data: currentUserData } = useQuery(GET_USER_BY_ID, {
    variables: { id: currentUserId },
    skip: !currentUserId, 
  });

  // --- MUTATIONS ---
  const [deleteBook, { loading: deleting }] = useMutation(DELETE_BOOK_MUTATION, {
    refetchQueries: [{ query: ME_QUERY }],
    onCompleted: () => navigate('/profile'),
    onError: (err) => showToast(err.message, 'error')
  });

  const [likeBook] = useMutation(LIKE_BOOK_MUTATION);
  const [toggleSavedBook] = useMutation(TOGGLE_SAVED_BOOK_MUTATION);
  
  // Yorum Ekleme Mutation Güncellemesi
  const [createComment, { loading: commentSending }] = useMutation(CREATE_COMMENT_MUTATION, {
    onCompleted: () => {
      setCommentText("");
      showToast('Yorum gönderildi', 'success');
      refetchComments(); // Listeyi yenile
    },
    onError: (err) => {
      console.log("Mutation Hatası:", err);
      showToast(err.message || "Bir hata oluştu", 'error');
    }
  });

  // --- HANDLERS ---
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
  };

  const handleDelete = async () => {
    if (window.confirm("Bu kitabı kalıcı olarak silmek istediğinize emin misiniz?")) {
       await deleteBook({ variables: { id } });
    }
  };

  const handleLike = async () => {
    if (!currentUserId) return showToast("Giriş yapmalısınız", 'warning');
    try { await likeBook({ variables: { bookId: book.id } }); } 
    catch (err) { /* Token error logic */ }
  };

  const handleSave = async () => {
    if (!currentUserId) return showToast("Giriş yapmalısınız", 'warning');
    try {
      await toggleSavedBook({
        variables: { bookId: book.id },
        refetchQueries: [{ query: GET_USER_BY_ID, variables: { id: currentUserId } }]
      });
      showToast(isSaved ? 'Kaydedilenlerden çıkarıldı' : 'Kaydedildi', 'success');
    } catch (err) { console.error(err); }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast('Link kopyalandı!', 'success');
  };

  const handleCommentSubmit = async () => {
    if (!currentUserId) return showToast("Giriş yapmalısınız", 'warning');
    if (!commentText.trim()) return; 
    try {
        await createComment({ 
            variables: { 
                bookId: book.id, 
                content: commentText 
            } 
        });
    } catch (e) {
        // Hata zaten useMutation'ın onError kısmında yakalandı ve toast gösterildi.
        // Burası sadece uygulamanın beyaz ekrana düşmesini engeller.
        console.log("Hata yakalandı (Graceful handling)");
    }   };

  // --- RENDER CHECKS ---
  if (bookLoading) return <MainLayout><div className="p-10 text-center">Yükleniyor...</div></MainLayout>;
  if (bookError) return <MainLayout><div className="p-10 text-center">Hata: {bookError.message}</div></MainLayout>;
  if (!book) return null;

  // --- VARIABLES ---
  const author = book.author;
  const isAuthor = currentUserId && book.authorId === currentUserId;
  const isAdmin = currentUserData?.getUserById?.role === 'ADMIN';
  const isLiked = book.likedBy && currentUserId ? book.likedBy.includes(currentUserId) : false;
  
  const savedBooks = currentUserData?.getUserById?.savedBooks || [];
  const isSaved = savedBooks.some(sb => (typeof sb === 'string' ? sb : sb.id) === book.id);
  
  const displayAuthorName = author?.fullName || author?.username || "Bilinmeyen Yazar";
  const formattedPublishDate = book.publishDate ? new Date(book.publishDate).toLocaleDateString() : 'Bilinmiyor';

  return (
    <MainLayout>
      <div className="book-detail-page">
        <Container maxWidth="5xl">
          
          {/* Navigasyon */}
          <Link to="/feed" className="back-link">
            <ArrowBack fontSize="small" /> Kitaplığa Dön
          </Link>

          <div className="book-detail-grid">
            
            {/* --- SOL PANEL (Kapak & Meta) --- */}
            <aside className="left-panel">
              <div className="cover-wrapper">
                <img 
                  src={book.imageUrl} 
                  alt={book.title} 
                  className="book-cover-lg"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=Resim+Yok'; }}
                />
              </div>

              <div className="meta-info-card">
                <div className="meta-row">
                  <span className="meta-label">Kategori:</span>
                  <Badge variant="neutral" className="capitalize">{book.genre}</Badge>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Sayfa:</span>
                  <span className="meta-value">{book.pageCount}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Yayın:</span>
                  <span className="meta-value">{formattedPublishDate}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Beğeni:</span>
                  <span className="meta-value">{book.stats?.likes || 0}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Desteklenme Sayısı:</span>
                  <Badge variant="success">{book.backerCount || 0} Kez</Badge>
                </div>
                 <div className="meta-row">
                  <span className="meta-label">Desteklenme Tutarı:</span>
                  <Badge variant="success">{book.currentFunding || 0} TL</Badge>
                </div>
              </div>
            </aside>

            {/* --- SAĞ PANEL (İçerik) --- */}
            <main className="right-panel">
              
              {/* Başlık & Yazar */}
              <div className="book-header">
                <Typography variant="h2" weight="bold" className="book-title-lg">
                  {book.title}
                </Typography>
                
                <div className="author-link-wrapper">
                  <Typography variant="body" color="muted">Yazar:</Typography>
                  <Link to={`/user/${book.authorId}`} className="author-link">
                    {displayAuthorName}
                  </Link>
                </div>
              </div>

              {/* Aksiyon Butonları (Toolbar) */}
              <div className="action-toolbar">
                <div className="primary-actions">
                  <Link to={`/book-reader/${book.id}`} className="no-underline">
                    <Button variant="primary" size="large" icon={<MenuBook />}>
                      Kitabı Oku
                    </Button>
                  </Link>

                  <Link to={`/donate/${book.id}`} className="no-underline">
                    <Button variant="success" size="large" icon={<CardGiftcard />}>
                      Destek Ol
                    </Button>
                  </Link>
                </div>

                <div className="secondary-actions">
                   <Button 
                     variant="ghost" 
                     onClick={handleLike} 
                     className={isLiked ? 'text-pink-600' : ''}
                     icon={isLiked ? <Favorite /> : <FavoriteBorder />}
                   />
                   <Button 
                     variant="ghost" 
                     onClick={handleSave} 
                     className={isSaved ? 'text-blue-600' : ''}
                     icon={isSaved ? <Bookmark /> : <BookmarkBorder />}
                   />
                   <Button variant="ghost" onClick={handleShare} icon={<Share />} />
                </div>
              </div>

              {/* Yazar/Admin İşlemleri */}
              {(isAuthor || isAdmin) && (
                <div className="admin-actions">
                   {isAuthor && (
                     <Link to={`/dashboard/${book.id}`} className="no-underline">
                       <Button variant="outline" size="small" icon={<Edit fontSize="small"/>}>
                         Düzenle
                       </Button>
                     </Link>
                   )}
                   <Button 
                     variant="danger" 
                     size="small" 
                     onClick={handleDelete} 
                     isLoading={deleting}
                     icon={<Delete fontSize="small"/>}
                   >
                     Sil
                   </Button>
                </div>
              )}

              {/* Açıklama */}
              <div className="description-box">
                <Typography variant="h5" weight="bold" className="mb-4">Hikaye Özeti</Typography>
                <Typography variant="body" className="leading-relaxed">
                  {book.description}
                </Typography>
              </div>

              {/* Yorumlar */}
              <div className="comments-wrapper">
                <Typography variant="h5" weight="bold" className="mb-4">
                  Yorumlar ({rawComments.length})                
                </Typography>
                
                <div className="comment-input-area">
                  <Textarea 
                    name="comment"
                    placeholder="Yorumunuzu buraya yazın..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button 
                      variant="primary" 
                      onClick={handleCommentSubmit} 
                      isLoading={commentSending}                      
                      icon={<CommentIcon fontSize="small"/>}
                    >
                      Gönder
                    </Button>
                  </div>
                </div>

                {commentsLoading ? (
                  <div className="p-4 text-center text-gray-500">Yorumlar yükleniyor...</div>
                ) : (
                  <CommentList 
                    comments={rawComments} // Düz listeyi gönderiyoruz
                    currentUserId={currentUserId}
                    bookId={id}
                  />
                )}
              </div>

            </main>
          </div>
        </Container>
      </div>

      <Toast 
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </MainLayout>
  );
};

export default BookDetailPage;