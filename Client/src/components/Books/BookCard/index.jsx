import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { 
  FavoriteBorder, 
  Pages, 
  LocalOffer, 
  Visibility as EyeIcon, 
  Comment as CommentIcon,
  TrendingUp,
  Star
} from '@mui/icons-material';

// --- LOGIC ---
import { GET_BOOK_BY_ID } from '../../../graphql/queries/book';
import { getOptimizedImage } from '../../../utils/ImageUtils';

// --- UI KIT ---
import { Typography } from '../../UI/Typography';
import { Badge } from '../../UI/Badge';
import { ProgressBar } from '../../UI/ProgressBar';

import './BookCard.css';

const BookCard = ({ book: bookProp, bookId }) => {
  const navigate = useNavigate();

  // Fetch data if bookId is provided, otherwise use prop
  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !!bookProp || !bookId,
  });

  // Determine which book object to use
  const book = bookProp || bookData?.getBookById;

  // Loading Skeleton with better structure
  if (!bookProp && bookLoading) {
    return (
      <div className="book-card skeleton">
        <div className="skeleton-shimmer"></div>
      </div>
    );
  }
  
  if (bookError) return null;
  if (!book) return null;

  const { 
    title, 
    description, 
    imageUrl, 
    pageCount, 
    genre, 
    stats, 
    id, 
    commentCount, 
    author,
    status,
    currentFunding,
    fundingTarget
  } = book;

  // Author name (safe access)
  const displayAuthor = author?.fullName || author?.username || "Anonymous";

  // Image optimization
  const finalCoverImage = imageUrl 
    ? getOptimizedImage(imageUrl, 300, 450) 
    : 'https://via.placeholder.com/300x450?text=No+Cover';

  // Format numbers for better readability
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate reading time estimate (rough)
  const estimatedReadTime = pageCount ? Math.ceil(pageCount / 3) : 0;

  // Handle card click
  const handleBookClick = () => {
    navigate(`/book-detail/${id}`);
  };

  // Determine if book is trending (example logic)
  const isTrending = stats?.views > 1000;

  return (
    <div className="book-card" onClick={handleBookClick}>
      
      {/* COVER IMAGE AREA */}
      <div className="card-media">
        <img 
          src={finalCoverImage} 
          alt={title} 
          className="cover-image" 
          loading="lazy"
          onError={(e) => { 
            e.target.src = 'https://via.placeholder.com/300x450?text=Error'; 
          }}
        />
        
        {/* Overlay Badges */}
        <div className="meta-overlay">
          {/* Page Count */}
          {pageCount && (
            <Badge variant="neutral" className="shadow-sm">
              <Pages style={{ fontSize: 12 }} /> 
              {pageCount}p
            </Badge>
          )}

          {/* Genre Tag */}
          {genre && (
            <Badge variant="primary" className="shadow-sm">
              <LocalOffer style={{ fontSize: 12 }} /> 
              {genre}
            </Badge>
          )}

          {/* Trending Badge */}
          {isTrending && (
            <Badge variant="warning" className="shadow-sm badge-glow">
              <TrendingUp style={{ fontSize: 12 }} /> 
              Trending
            </Badge>
          )}
        </div>

        {/* Status Indicator */}
        {status === 'FUNDING' && (
          <div className="status-badge funding">
            <Star style={{ fontSize: 14 }} />
            <span>Funding</span>
          </div>
        )}
        {status === 'PUBLISHED' && (
          <div className="status-badge published">
            Published
          </div>
        )}
      </div>

      {/* CONTENT AREA */}
      <div className="card-content">
        
        {/* Title */}
        <Typography 
          variant="h6" 
          weight="bold" 
          className="book-title" 
          title={title}
        >
          {title}
        </Typography>
        
        {/* Author */}
        <div className="book-author">
          <Typography variant="caption" color="muted">by</Typography>
          <Typography variant="caption" weight="semibold" color="primary">
            {displayAuthor}
          </Typography>
        </div>
        
        {/* Description */}
        <Typography variant="body" color="muted" className="book-excerpt">
          {description 
            ? (description.length > 120 ? description.substring(0, 120) + "..." : description) 
            : "No description available."}
        </Typography>

        {/* Reading Time Estimate */}
        {estimatedReadTime > 0 && (
          <div className="reading-time">
            <Typography variant="caption" color="muted">
              ~{estimatedReadTime} min read
            </Typography>
          </div>
        )}

        {/* Funding Progress Bar */}
        {status === 'FUNDING' && (
          <div className="funding-status">
            <ProgressBar 
              current={currentFunding || 0} 
              target={fundingTarget || 1000} 
            />
          </div>
        )}

        {/* Statistics Bar */}
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
        </div>
      </div>
    </div>
  );
};

export default BookCard;