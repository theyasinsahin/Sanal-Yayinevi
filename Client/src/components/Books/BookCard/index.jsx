import UserProfileLink from '../../UI/UserProfileLink';
import ClassificationSummary from '../Classification/ClassificationSummary';
import { bookPath } from '../../../utils/publicPaths';
import React, { lazy, Suspense, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { 
  FavoriteBorder, 
  Pages, 
  Visibility as EyeIcon, 
  Comment as CommentIcon,
  TrendingUp,
  Star,
  Share,
} from '@mui/icons-material';

import { GET_BOOK_CARD } from '../../../graphql/queries/book';
import { getOptimizedImage } from '../../../utils/ImageUtils';
import { useAuth } from '../../../context/AuthContext';

import { Typography } from '../../UI/Typography';
import { Badge } from '../../UI/Badge';
import ReasonBadge from '../../Recommendation/ReasonBadge';
import PrintedBookCard from '../PrintedBookCard';

import './BookCard.css';

// Share dialogs are downloaded only after the visitor opens them.
const ShareModal = lazy(() => import('../../Messaging/ShareModal'));
const SocialShareDialog = lazy(() => import('../../Sharing/SocialShareDialog'));

const BookCard = ({ book: bookProp, bookId, skeleton, reason }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_CARD, {
    variables: { id: bookId },
    skip: !!bookProp || !bookId,
  });

  if (skeleton || (!bookProp && bookLoading)) {
    return (
      <div className="book-card skeleton">
        <div className="skeleton-shimmer"></div>
      </div>
    );
  }

  if (bookError) return null;

  const book = bookProp || bookData?.getBookById;
  if (!book) return null;
  if (book.kind === 'PRINTED') return <PrintedBookCard book={book} />;

  const {
    title,
    description,
    imageUrl,
    pageCount,
    stats,
    id,
    commentCount,
    author,
    status,
  } = book;

  const displayAuthor    = author?.fullName || author?.username || 'Anonim';
  const finalCoverImage  = imageUrl
    ? getOptimizedImage(imageUrl, 300, 450)
    : '/images/book-placeholder.svg';
  const estimatedReadTime = pageCount ? Math.ceil(pageCount / 3) : 0;
  const isTrending        = stats?.views > 1000;

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} mn`;
    if (num >= 1000) return `${(num / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} bin`;
    return num.toString();
  };

  const handleBookClick = () => navigate(bookPath(book), {
    state: { catalogReturn: ['/feed', '/printed-books'].includes(location.pathname) ? location.pathname + location.search : undefined },
  });

  const handleShareClick = (e) => {
    e.stopPropagation(); // kartın navigate'ini tetikleme
    setShareOpen(true);
  };

  return (
    <>
      <div className="book-card" onClick={handleBookClick}>

        <div className="card-media">
          <img
            src={finalCoverImage}
            alt={title}
            className="cover-image"
            loading="lazy"
            width={300} height={450} decoding="async"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/book-placeholder.svg'; }}
          />

          <div className="meta-overlay">
            {pageCount && (
              <Badge variant="neutral" className="shadow-sm">
                <Pages style={{ fontSize: 12 }} />
                {pageCount}s.
              </Badge>
            )}
            {isTrending && (
              <Badge variant="warning" className="shadow-sm badge-glow">
                <TrendingUp style={{ fontSize: 12 }} />
                Popüler
              </Badge>
            )}
          </div>

          {status === 'FUNDING' && (
            <div className="status-badge funding">
              <Star style={{ fontSize: 14 }} />
              <span>Basım bilgileri</span>
            </div>
          )}
          {status === 'PUBLISHED' && (
            <div className="status-badge published">Yayımlandı</div>
          )}
        </div>

        <div className="card-content">
          <ClassificationSummary book={book} compact />
          <Typography variant="h6" weight="bold" className="book-title" title={title}>
            {title}
          </Typography>

          {reason && (
            <div style={{ marginBottom: '4px' }}>
              <ReasonBadge reason={reason} />
            </div>
          )}

          <div className="book-author">
            <Typography variant="caption" color="muted">Yazar:</Typography>
            <Typography variant="caption" weight="medium" color="primary">
              <UserProfileLink user={author}>{displayAuthor}</UserProfileLink>
            </Typography>
          </div>

          <Typography variant="body" color="muted" className="book-excerpt">
            {description
              ? description.length > 120 ? description.substring(0, 120) + '...' : description
              : 'Henüz açıklama eklenmemiş.'}
          </Typography>

          {estimatedReadTime > 0 && (
            <div className="reading-time">
              <Typography variant="caption" color="muted">
                ~{estimatedReadTime} dk okuma
              </Typography>
            </div>
          )}

          <div className="card-stats">
            <div className="stat-item" title="Görüntülenme">
              <EyeIcon className="stat-icon" />
              <span>{formatNumber(stats?.views || 0)}</span>
            </div>
            <div className="stat-item" title="Yorumlar">
              <CommentIcon className="stat-icon" />
              <span>{formatNumber(commentCount || 0)}</span>
            </div>
            <div className="stat-item" title="Beğeniler">
              <FavoriteBorder className="stat-icon" />
              <span>{formatNumber(stats?.likes || 0)}</span>
            </div>

            {/* Sosyal paylaşım ve mevcut Betik mesajlaşması */}
            {(status !== 'DRAFT' || user) && (
              <button
                className="stat-item book-card-share-btn"
                title="Kitabı paylaş"
                aria-label="Kitabı paylaş"
                onClick={handleShareClick}
              >
                <Share className="stat-icon" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ShareModal */}
      {shareOpen && (<Suspense fallback={null}>
        <SocialShareDialog target={{ type: 'BOOK', id }} onClose={() => setShareOpen(false)} onSendInBetik={user ? () => setMessageOpen(true) : undefined} />
      </Suspense>)}
      {messageOpen && (<Suspense fallback={null}>
        <ShareModal
          isOpen={messageOpen}
          onClose={() => setMessageOpen(false)}
          type="BOOK"
          attachedBookId={id}
          attachedBook={book}
          currentUserId={user?.id}
        />
      </Suspense>)}
    </>
  );
};

export default BookCard;
