import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

import { GET_BOOK_BY_ID } from '../../../graphql/queries/book';
import { getOptimizedImage } from '../../../utils/ImageUtils';
import { useAuth } from '../../../context/AuthContext';

import { Typography } from '../../UI/Typography';
import { Badge } from '../../UI/Badge';
import { ProgressBar } from '../../UI/ProgressBar';
import ReasonBadge from '../../Recommendation/ReasonBadge';
import ShareModal from '../../Messaging/ShareModal';

import './BookCard.css';

const BookCard = ({ book: bookProp, bookId, skeleton, reason }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: bookData, loading: bookLoading, error: bookError } = useQuery(GET_BOOK_BY_ID, {
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
    currentFunding,
    fundingTarget,
  } = book;

  const displayAuthor    = author?.fullName || author?.username || 'Anonymous';
  const finalCoverImage  = imageUrl
    ? getOptimizedImage(imageUrl, 300, 450)
    : 'https://via.placeholder.com/300x450?text=No+Cover';
  const estimatedReadTime = pageCount ? Math.ceil(pageCount / 3) : 0;
  const isTrending        = stats?.views > 1000;

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleBookClick = () => navigate(`/book-detail/${id}`);

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
            onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=Error'; }}
          />

          <div className="meta-overlay">
            {pageCount && (
              <Badge variant="neutral" className="shadow-sm">
                <Pages style={{ fontSize: 12 }} />
                {pageCount}p
              </Badge>
            )}
            {isTrending && (
              <Badge variant="warning" className="shadow-sm badge-glow">
                <TrendingUp style={{ fontSize: 12 }} />
                Trending
              </Badge>
            )}
          </div>

          {status === 'FUNDING' && (
            <div className="status-badge funding">
              <Star style={{ fontSize: 14 }} />
              <span>Funding</span>
            </div>
          )}
          {status === 'PUBLISHED' && (
            <div className="status-badge published">Published</div>
          )}
        </div>

        <div className="card-content">
          <Typography variant="h6" weight="bold" className="book-title" title={title}>
            {title}
          </Typography>

          {reason && (
            <div style={{ marginBottom: '4px' }}>
              <ReasonBadge reason={reason} />
            </div>
          )}

          <div className="book-author">
            <Typography variant="caption" color="muted">by</Typography>
            <Typography variant="caption" weight="medium" color="primary">
              {displayAuthor}
            </Typography>
          </div>

          <Typography variant="body" color="muted" className="book-excerpt">
            {description
              ? description.length > 120 ? description.substring(0, 120) + '...' : description
              : 'No description available.'}
          </Typography>

          {estimatedReadTime > 0 && (
            <div className="reading-time">
              <Typography variant="caption" color="muted">
                ~{estimatedReadTime} min read
              </Typography>
            </div>
          )}

          {status === 'FUNDING' && (
            <div className="funding-status">
              <ProgressBar current={currentFunding || 0} target={fundingTarget || 1000} />
            </div>
          )}

          <div className="card-stats">
            <div className="stat-item" title="Views">
              <EyeIcon className="stat-icon" />
              <span>{formatNumber(stats?.views || 0)}</span>
            </div>
            <div className="stat-item" title="Comments">
              <CommentIcon className="stat-icon" />
              <span>{formatNumber(commentCount || 0)}</span>
            </div>
            <div className="stat-item" title="Likes">
              <FavoriteBorder className="stat-icon" />
              <span>{formatNumber(stats?.likes || 0)}</span>
            </div>

            {/* Paylaş — sadece giriş yapılmışsa */}
            {user && (
              <button
                className="stat-item book-card-share-btn"
                title="Arkadaşa gönder"
                onClick={handleShareClick}
              >
                <Share className="stat-icon" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ShareModal */}
      {shareOpen && (
        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          type="BOOK"
          attachedBookId={id}
          attachedBook={book}
          currentUserId={user?.id}
        />
      )}
    </>
  );
};

export default BookCard;