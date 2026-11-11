import ClassificationSummary from '../../components/Books/Classification/ClassificationSummary';
import CompactNumber from '../../components/UI/CompactNumber';
import MentionInput from '../../components/Mentions/MentionInput';
import ClassificationEditor from '../../components/Books/Classification/ClassificationEditor';
import { useAuth } from '../../context/AuthContext';
import { profilePath, readerPath } from '../../utils/publicPaths';
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { 
  ArrowBack, 
  FavoriteBorder, 
  Favorite, 
  BookmarkBorder, 
  Bookmark, 
  MenuBook, 
  Edit,
  Delete,
  CardGiftcard,
  Comment as CommentIcon
} from '@mui/icons-material';

// --- GRAPHQL ---
import { GET_BOOK_DETAIL } from '../../graphql/queries/book';
import { GET_BOOK_VIEWER, ME_QUERY } from '../../graphql/queries/user';
import { LIKE_BOOK_MUTATION, DELETE_BOOK_MUTATION, UPDATE_BOOK_STATUS_MUTATION } from '../../graphql/mutations/book';
import { TOGGLE_SAVED_BOOK_MUTATION } from '../../graphql/mutations/user';
import { CREATE_COMMENT_MUTATION } from '../../graphql/mutations/comment';
import { GET_COMMENTS_BY_BOOK_ID } from '../../graphql/queries/comment';

// --- UI KIT ---
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Toast } from '../../components/UI/Toast';
import { Textarea } from '../../components/UI/Textarea';
import BookFollowButton from '../../components/Books/BookFollowButton';
import CatalogBackLink from '../../components/Books/CatalogBackLink';

// --- COMPONENTS ---
import CommentList from '../../components/Comments/CommentList';
import BookFundingPanel from '../../components/PrintFunding/BookFundingPanel';
import PrintedBookDetail from '../../components/Books/PrintedBookDetail';
import BookShareButton from '../../components/Books/BookShareButton';

import './BookDetail.css';
import { useRegistration, useRestoredRegistration } from '../../hooks/useRegistration';

const BookDetailPage = ({ resolvedId } = {}) => {
  const params = useParams();
  const id = resolvedId || params.id;
  const navigate = useNavigate();
  const { hash, pathname } = useLocation();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const requestRegistration = useRegistration();
  const restoredComment = useRestoredRegistration('comment', { bookId: id });
  const restoredSave = useRestoredRegistration('save', { bookId: id });
  const restoredLike = useRestoredRegistration('like', { bookId: id });
  const [commentText, setCommentText] = useState("");
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const [optimisticLiked, setOptimisticLiked] = useState(null);
  const [optimisticSaved, setOptimisticSaved] = useState(null);
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    setOptimisticLiked(null);
    setOptimisticSaved(null);
    setOptimisticLikeCount(null);
    setCommentText('');
  }, [currentUserId]);
  useEffect(() => { if (restoredComment) setCommentText(restoredComment.draft || ''); }, [restoredComment]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // --- QUERIES ---
  const { data: bookData, loading: bookLoading, error: bookError, refetch: refreshBook } = useQuery(GET_BOOK_DETAIL, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });

  const { 
    data: commentsData, 
    loading: commentsLoading,
    refetch: refetchComments
  } = useQuery(GET_COMMENTS_BY_BOOK_ID, {
    variables: { bookId: id },
    fetchPolicy: "cache-and-network"
  });

  const book = bookData ? bookData.getBookById : null;
  useEffect(() => {
    if (restoredSave || restoredLike) document.getElementById(restoredSave ? 'book-save' : 'book-like')?.focus();
  }, [restoredSave, restoredLike, book]);
  const hasContent = book?.chapters?.some(chapter => chapter.wordCount > 0);
  useEffect(() => {
    if (book && hash === '#comments') document.getElementById('comments')?.scrollIntoView?.({ block: 'start' });
  }, [book, hash]);
  const rawComments = commentsData ? commentsData.getCommentsByBookId : [];

  const { data: currentUserData } = useQuery(GET_BOOK_VIEWER, {
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
  const [publishBook, { loading: publishing }] = useMutation(UPDATE_BOOK_STATUS_MUTATION, {
    refetchQueries: [{ query: GET_BOOK_DETAIL, variables: { id } }],
    awaitRefetchQueries: true,
  });
  const [toggleSavedBook] = useMutation(TOGGLE_SAVED_BOOK_MUTATION);
  
  const [createComment, { loading: commentSending }] = useMutation(CREATE_COMMENT_MUTATION, {
    onCompleted: () => {
      setCommentText("");
      showToast('Yorum gönderildi', 'success');
      refetchComments();
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

  const handlePublish = async () => {
    if (!hasContent) { showToast('Yayınlamak için en az bir bölüme metin ekleyin.', 'error'); return; }
    if (!window.confirm('Kitap herkese görünür olacak. Onaylıyor musunuz?')) return;
    try {
      await publishBook({ variables: { bookId: book.id, status: 'WRITING' } });
      showToast('Kitabınız yayınlandı ve okuyuculara açıldı.', 'success');
    } catch (error) {
      showToast(error.message || 'Kitap yayınlanamadı. Lütfen tekrar deneyin.', 'error');
    }
  };

  const handlePublicationStatus = async status => {
    const drafting = status === 'DRAFT';
    if (!window.confirm(drafting ? 'Kitap yayından kaldırılıp taslağa çekilecek. Onaylıyor musunuz?' : 'Kitabın yazım aşamasını bitirdiniz mi?')) return;
    try {
      await publishBook({ variables: { bookId: book.id, status } });
      showToast(drafting ? 'Kitabınız taslağa çekildi.' : 'Kitabınızın yazımı tamamlandı.', 'success');
    } catch (error) { showToast(error.message || 'Yayın durumu değiştirilemedi. Lütfen tekrar deneyin.', 'error'); }
  };

  const handleLike = async () => {
    if (!currentUserId) return requestRegistration({ action: 'like', bookId: id });
    const currentlyLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
    const currentCount = optimisticLikeCount !== null ? optimisticLikeCount : (book.stats?.likes || 0);
    setOptimisticLiked(!currentlyLiked);
    setOptimisticLikeCount(currentlyLiked ? currentCount - 1 : currentCount + 1);
    try { 
      await likeBook({ variables: { bookId: book.id } }); 
    } catch (err) { 
      setOptimisticLiked(currentlyLiked);
      setOptimisticLikeCount(currentCount);
      showToast("Beğeni işlemi başarısız", 'error');
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return requestRegistration({ action: 'save', bookId: id });
    const currentlySaved = optimisticSaved !== null ? optimisticSaved : isSavedFromServer;
    setOptimisticSaved(!currentlySaved);
    showToast(!currentlySaved ? 'Kitaplığına eklendi' : 'Kitaplıktan çıkarıldı', 'success');
    try {
      await toggleSavedBook({
        variables: { bookId: book.id },
        refetchQueries: [{ query: GET_BOOK_VIEWER, variables: { id: currentUserId } }]
      });
    } catch (err) { 
      setOptimisticSaved(currentlySaved);
      showToast("Kaydetme işlemi başarısız", 'error');
    }
  };

  const handleCommentSubmit = async () => {
    if (!currentUserId) return requestRegistration({ action: 'comment', bookId: id, draft: commentText, returnTo: `${pathname}#comments` });
    if (!commentText.trim()) return; 
    try {
        await createComment({ 
            variables: { 
                bookId: book.id, 
                content: commentText 
            } 
        });
    } catch (e) {
        console.log("Hata yakalandı (Graceful handling)");
    }
  };

  // --- RENDER CHECKS ---
  if (bookLoading) return (
    <MainLayout>
      <div className="book-detail-page">
        <Container maxWidth="5xl">
          <div className="back-link" style={{ width: 140, height: 20, background: 'var(--skeleton-base)', borderRadius: 6 }} />
          <div className="book-detail-grid">
            <aside className="left-panel">
              <div className="cover-wrapper">
                <div style={{
                  width: '100%',
                  aspectRatio: '2/3',
                  background: 'var(--skeleton-base)',
                  borderRadius: 12,
                  animation: 'shimmer 1.5s ease-in-out infinite'
                }} />
              </div>
              <div className="meta-info-card">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="meta-row" style={{ gap: '0.5rem' }}>
                    <div style={{ width: 80, height: 14, background: 'var(--skeleton-base)', borderRadius: 4 }} />
                    <div style={{ width: 60, height: 14, background: 'var(--skeleton-base)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            </aside>
            <main className="right-panel">
              <div className="book-header">
                <div style={{ width: '75%', height: 36, background: 'var(--skeleton-base)', borderRadius: 8, marginBottom: '0.75rem' }} />
                <div style={{ width: '40%', height: 36, background: 'var(--skeleton-base)', borderRadius: 8, marginBottom: '1rem' }} />
                <div style={{ width: 160, height: 16, background: 'var(--skeleton-base)', borderRadius: 4 }} />
              </div>
              <div className="action-toolbar">
                <div className="primary-actions">
                  <div style={{ width: 140, height: 44, background: 'var(--skeleton-base)', borderRadius: 8 }} />
                  <div style={{ width: 140, height: 44, background: 'var(--skeleton-base)', borderRadius: 8 }} />
                </div>
                <div className="secondary-actions">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ width: 40, height: 40, background: 'var(--skeleton-base)', borderRadius: 8 }} />
                  ))}
                </div>
              </div>
              <div className="description-box">
                <div style={{ width: 140, height: 22, background: 'var(--skeleton-base)', borderRadius: 6, marginBottom: '1rem' }} />
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ width: i === 4 ? '60%' : '100%', height: 14, background: 'var(--skeleton-base)', borderRadius: 4, marginBottom: '0.5rem' }} />
                ))}
              </div>
            </main>
          </div>
        </Container>
      </div>
    </MainLayout>
  );

  if (bookError) return (
    <MainLayout>
      <Container maxWidth="5xl">
        <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
          <Typography variant="h4" weight="bold">Kitap açılamadı</Typography>
          <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
            Bu kitaba şu an ulaşılamıyor. Silinmiş ya da geçici bir sorun yaşanıyor olabilir.
          </Typography>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Button variant="outline" onClick={() => window.location.reload()}>Tekrar Dene</Button>
            <Link to="/feed" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Kitaplığa Dön</Button>
            </Link>
          </div>
        </div>
      </Container>
    </MainLayout>
  );  
  
  if (!book) return <MainLayout><Container maxWidth="5xl"><section className="printed-panel"><Typography variant="h2">Kitap bulunamadı</Typography><p>Bu kayıt henüz yayımlanmamış veya erişime kapalı olabilir.</p><Link className="ui-text-link" to="/printed-books">Basılı kitaplara dön</Link></section></Container></MainLayout>;
  if (book.kind === 'PRINTED') return <><PrintedBookDetail book={book} comments={rawComments} commentsLoading={commentsLoading} currentUserId={currentUserId} commentText={commentText} onCommentChange={event => setCommentText(event.target.value)} onCommentSubmit={handleCommentSubmit} commentSending={commentSending} refresh={refreshBook} /><Toast isVisible={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} /></>;

  // --- VARIABLES ---
  const author = book.author;
  const isAuthor = currentUserId && book.authorId === currentUserId;
  const isDraft = (book.digitalStatus || (book.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')) === 'DRAFT';
  const isCompleted = book.writingStatus ? book.writingStatus === 'COMPLETED' : ['COMPLETED', 'FUNDING', 'FUNDED', 'PUBLISHED'].includes(book.status);
  const viewer = currentUserId && currentUserData?.getUserById?.id === currentUserId ? currentUserData.getUserById : null;
  const isAdmin = viewer?.role === 'ADMIN';

  const isLikedFromServer = book.likedBy && currentUserId ? book.likedBy.includes(currentUserId) : false;
  const savedBooks = viewer?.savedBooks || [];
  const isSavedFromServer = savedBooks.some(sb => (typeof sb === 'string' ? sb : sb.id) === book.id);

  const isLiked = optimisticLiked !== null ? optimisticLiked : isLikedFromServer;
  const isSaved = optimisticSaved !== null ? optimisticSaved : isSavedFromServer;
  const likeCount = optimisticLikeCount !== null ? optimisticLikeCount : (book.stats?.likes || 0);

  const displayAuthorName = author?.fullName || author?.username || "Bilinmeyen Yazar";
  const formattedPublishDate = book.publishDate ? new Date(book.publishDate).toLocaleDateString() : 'Bilinmiyor';

  return (
    <MainLayout>
      <div className="book-detail-page">
        <Container maxWidth="5xl">
          
          <CatalogBackLink to="/feed" className="back-link">
            <ArrowBack fontSize="small" /> Kitaplığa Dön
          </CatalogBackLink>

          <div className="book-detail-grid">
            
            <aside className="left-panel">
              <div className="cover-wrapper">
                <img 
                  src={book.imageUrl} 
                  alt={book.title} 
                  className="book-cover-lg"
                  style={{ display: imgLoaded ? 'block' : 'none' }}
                  onLoad={() => setImgLoaded(true)}
                  onError={(e) => { 
                    e.target.src = 'https://via.placeholder.com/300x450?text=Resim+Yok';
                    setImgLoaded(true);
                  }}
                />
                {!imgLoaded && (
                  <div style={{
                    width: '100%',
                    aspectRatio: '2/3',
                    background: 'var(--skeleton-base)',
                    borderRadius: 12,
                    animation: 'shimmer 1.5s ease-in-out infinite'
                  }} />
                )}
              </div>

              <div className="meta-info-card">
                <div className="meta-row">
                  <span className="meta-label">Biçim / Tür:</span>
                  <ClassificationSummary book={book} compact />
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
                  <CompactNumber className="meta-value" value={likeCount} label="beğeni" />
                </div>
              </div>
            </aside>

            <main className="right-panel">
              
              <div className="book-header">
                <Typography variant="h2" weight="bold" className="book-title-lg">
                  {book.title}
                </Typography>
                <div className="author-link-wrapper">
                  <Typography variant="body" color="muted">Yazar:</Typography>
                  <Link to={profilePath(book.author || { id: book.authorId })} className="author-link">
                    {displayAuthorName}
                  </Link>
                </div>
                <BookFollowButton bookId={book.id} />
              </div>

              <div className="action-toolbar">
                <div className="primary-actions">
                  <Link to={readerPath(book)} className="no-underline">
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
                     id="book-like" onClick={handleLike}
                     className={isLiked ? 'text-pink-600' : ''}
                     icon={isLiked ? <Favorite /> : <FavoriteBorder />}
                   />
                   <Button 
                     variant="ghost" 
                     id="book-save" onClick={handleSave}
                     className={isSaved ? 'text-blue-600' : ''}
                     icon={isSaved ? <Bookmark /> : <BookmarkBorder />}
                   />
                   {book.status !== 'DRAFT' && <BookShareButton book={book} variant="ghost" />}
                </div>
              </div>

              {isAuthor && !isDraft && <section className="book-publication-actions" aria-label="Yayın yönetimi">
                <div><strong>{isCompleted ? 'Kitabınızın yazımı tamamlandı' : 'Kitabınız okuyuculara açık'}</strong>
                  <p>{isCompleted ? 'Destek fonu için basım başvurusu oluşturabilir veya başvurunuzu takip edebilirsiniz.' : 'Yazımı tamamlayabilir veya kitabınızı yeniden taslağa çekebilirsiniz.'}</p>
                </div>
                <div className="book-publication-buttons">
                  <Button variant="danger" size="small" onClick={() => handlePublicationStatus('DRAFT')} disabled={deleting} isLoading={publishing}>Taslağa Çek</Button>
                  {isCompleted ? <Link to={`/print/${book.id}`} className="no-underline"><Button variant="primary" size="small" disabled={deleting || publishing}>Destek Fonu İçin Başvur / Başvurumu Gör</Button></Link>
                    : <Button variant="primary" size="small" onClick={() => handlePublicationStatus('COMPLETED')} disabled={deleting || !hasContent} isLoading={publishing}>Yazımı Tamamla</Button>}
                </div>
              </section>}
              {(isAuthor || isAdmin) && (
                <div className="admin-actions">
                   {isAuthor && (
                     <Link to={`/dashboard/${book.id}`} className="no-underline">
                       <Button variant="outline" size="small" icon={<Edit fontSize="small"/>}>
                         Yazmaya Devam Et
                       </Button>
                     </Link>
                   )}
                   {isAuthor && (book.digitalStatus || (book.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED')) === 'DRAFT' && (
                     <Button variant="primary" size="small" onClick={handlePublish} isLoading={publishing} disabled={deleting || !hasContent}>
                       Yayınla (Görünür Yap)
                     </Button>
                   )}
                   {isAuthor && book.status === 'DRAFT' && !hasContent && <p role="status">Yayınlamak için en az bir bölüme metin ekleyin.</p>}
                   <Button 
                     variant="danger" 
                     size="small" 
                     onClick={handleDelete} 
                     isLoading={deleting}
                     disabled={publishing}
                     icon={<Delete fontSize="small"/>}
                   >
                     Sil
                   </Button>
                </div>
              )}

              <div className="description-box">
                <Typography variant="h5" weight="bold" className="mb-4">Hikaye Özeti</Typography>
                <Typography variant="body" className="leading-relaxed">
                  {book.description}
                </Typography>
              </div>
              <ClassificationSummary book={book} />
              {(isAuthor || isAdmin) && <ClassificationEditor key={book.id} book={book} />}
              <BookFundingPanel bookId={book.id} />

              <div className="comments-wrapper" id="comments">
                <Typography variant="h5" weight="bold" className="mb-4">
                  Yorumlar (<CompactNumber value={rawComments.length} />)
                </Typography>
                
                <div className="comment-input-area">
                  <MentionInput as={Textarea}
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
                    comments={rawComments}
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
