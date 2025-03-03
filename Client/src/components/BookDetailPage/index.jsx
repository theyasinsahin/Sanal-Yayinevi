import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowBack, FavoriteBorder, Share, Comment, Paid, BookmarkBorder } from '@mui/icons-material';
import ProgressBar from '../Common/ProgressBar';
import { sampleBooks } from '../../Data/sampleBooks';

import './BookDetailPage.css';
import CommentList from './CommentList';

const BookDetailPage = () => {
  //const { id } = useParams();
  const book = sampleBooks.find(b => b.id === 1);

  return (
    <div className="book-detail-container">
      {/* Üst Navigasyon */}
      <nav className="detail-nav">
        <Link to="/feed" className="back-button">
          <ArrowBack /> Kitaplığa Dön
        </Link>
      </nav>

      {/* Ana İçerik */}
      <main className="detail-main">
        {/* Sol Panel - Kapak ve Hızlı Bilgiler */}
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
              <span className="value">{book.publishDate}</span>
            </div>
           
          </div>

        </div>


        {/* Sağ Panel - Detaylar */}
        <div className="right-panel">
          <h1 className="book-title">{book.title}</h1>
          <div className="author-section">
            <span className="by">Yazar:</span>
            <span className="author-name">{book.author}</span>
          </div>


          <ProgressBar 
            currentAmount={book.currentAmount} goal={book.goal}
          />

          <div className="action-buttons">
            <button className="donate-button">
              <Paid fontSize="small" />
              Destek Ol
            </button>
            <div className="secondary-actions">
              <button className="icon-button">
                <FavoriteBorder />
              </button>
              <button className="icon-button">
                <Share />
              </button>
              <button className="icon-button">
                <BookmarkBorder />
              </button>
            </div>
    
          </div>

          <div className="description-section">
            <h3>Hikaye Özeti</h3>
            <p className="book-description">{book.excerpt}</p>
          </div>

          <div className="comments-section">
            <h3>Yorumlar ({book.comments.length})</h3>
            <div className="comment-form">
              <textarea placeholder="Yorumunuzu yazın..." />
              <button className="submit-comment">
                <Comment /> Gönder
              </button>
            </div>
            {/* Yorum Listesi */}
            <CommentList comments={book.comments}/>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookDetailPage;