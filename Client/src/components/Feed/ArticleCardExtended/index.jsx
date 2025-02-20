import React from 'react';
import { 
    FavoriteBorder, 
    Paid, 
    Share, 
    BookmarkBorder,
    Visibility as EyeIcon,
    Comment as CommentIcon 
  } from '@mui/icons-material';
import './ArticleCardExtended.css';

import ProgressBar from '../../Common/ProgressBar';

const ArticleCardExtended = ({ article }) => {
  const progress = (article.currentAmount / article.goal) * 100;

  return (
    <div className="article-card-extended">
      {/* Kapak Görseli */}
      <div className="cover-image-container">
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="cover-image"
        />
        <div className="image-overlay">
          <span className="genre-badge">{article.genre}</span>
          <span className="page-count">{article.pageCount} Sayfa</span>
        </div>
      </div>

      {/* İçerik */}
      <div className="card-content">
        <h3 className="title">{article.title}</h3>
        <div className="author-section">
          <span className="by">Yazar: </span>
          <span className="author">{article.author}</span>
        </div>

        {/* İstatistikler */}
        <div className="stats">
          <div className="stat-item">
            <EyeIcon fontSize="small" />
            <span>{article.stats.views.toLocaleString()}</span>
          </div>
          <div className="stat-item">
            <CommentIcon fontSize="small" />
            <span>{article.stats.comments}</span>
          </div>
          <div className='stat-item'>
            <span>Hedef: </span><span>${article.goal}</span>
            </div>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} />
        
        {/* Action Butonları */}
        <div className="actions">
          <button className="donate-button">
            <Paid fontSize="small" />
            Destek Ol
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

export default ArticleCardExtended;