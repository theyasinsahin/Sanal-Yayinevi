// ArticleCard.js
import React from 'react';
import { FavoriteBorder, 
  Paid, 
  Pages, 
  LocalOffer, 
  Share, 
  BookmarkBorder, 
  Visibility as EyeIcon,
  Comment as CommentIcon  } from '@mui/icons-material';
import ProgressBar from '../Common/ProgressBar';

import './BookCard.css';

const BookCard = ({ 
  title,
  author,
  excerpt,
  currentAmount,
  goal,
  imageUrl,
  pageCount,
  genre,
  stats
}) => {
  
  return (
    <div className="article-card">
      <div className="card-media">
        <img src={imageUrl} alt={title} className="cover-image" />
        <div className="meta-overlay">
          <div className="meta-item">
            <Pages className="meta-icon" />
            <span>{pageCount} Sayfa</span>
          </div>
          <div className="meta-item">
            <LocalOffer className="meta-icon" />
            <span>{genre}</span>
          </div>
        </div>
      </div>

      <div className="card-content">
        <div className="card-header">
          <h3 className="article-title">{title}</h3>
          <div className="author-info">
            <span className="by">Yazar: </span>
            <span className="author-name">{author}</span>
          </div>
          <p className="article-excerpt">{excerpt}</p>

          {/* İstatistikler */}
          <div className="stats">
            <div className="stat-item">
              <EyeIcon fontSize="small" />
              <span>{stats.views.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <CommentIcon fontSize="small" />
              <span>{stats.comments}</span>
            </div>
          </div>

        </div>

        {/* Progress Bar */}
        <ProgressBar currentAmount={currentAmount} goal={goal} />

        <div className="card-footer">
          <button className="donate-button">
            Destek Ol
            <FavoriteBorder fontSize="small" style={{ marginLeft: '8px' }} />
          </button>
          <div className="secondary-actions">
            <BookmarkBorder className="icon" />
            <Share className="icon" />
            <FavoriteBorder className="icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookCard;