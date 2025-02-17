// ArticleCard.js
import React from 'react';
import { FavoriteBorder, Paid, Pages, LocalOffer } from '@mui/icons-material';

const ArticleCard = ({ 
  title,
  author,
  excerpt,
  currentAmount,
  goal,
  imageUrl,
  pageCount,
  genre
}) => {
  const progress = (currentAmount / goal) * 100;
  
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
            <span className="by">Yazar:</span>
            <span className="author-name">{author}</span>
          </div>
        </div>

        <p className="article-excerpt">{excerpt}</p>

        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          <div className="progress-text">
            <Paid fontSize="small" />
            <span>{currentAmount.toLocaleString()} TL</span>
            <span>/ {goal.toLocaleString()} TL</span>
          </div>
        </div>

        <div className="card-footer">
          <button className="donate-button">
            Destek Ol
            <FavoriteBorder fontSize="small" style={{ marginLeft: '8px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;