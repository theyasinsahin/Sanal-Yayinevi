// ArticleCard.js
import React, {useEffect} from 'react';
import { FavoriteBorder, 
  Paid, 
  Pages, 
  LocalOffer, 
  Share, 
  BookmarkBorder, 
  Visibility as EyeIcon,
  Comment as CommentIcon  } from '@mui/icons-material';
import ProgressBar from '../Common/ProgressBar';

import { useNavigate } from 'react-router-dom';

import './BookCard.css';
import { useQuery } from '@apollo/client';
import {GET_BOOK_BY_ID_QUERY, GET_USER_BY_ID_QUERY} from './graphql';
import { use } from 'react';

const BookCard = ({bookId}) => {
  const {data, loading, error} = useQuery(GET_BOOK_BY_ID_QUERY, {
    variables: {id: bookId}
  });
  useEffect(() => {
    if (error) {
      console.error("Error fetching book data:", error.message);
    }
  }, [error]);

  useEffect(() => {
    console.log("Fetched book data:", data);
  }, [data]);
  const {title, authorId, description, imageUrl, pageCount, genre, stats, id} = data.getBookById;
  
  const {data: userData} = useQuery(GET_USER_BY_ID_QUERY, {
    variables: {id: authorId}
  });

  let author = "Bilinmiyor";
  if (userData && userData.getUserById) {
    author = userData.getUserById.fullName || userData.getUserById.username;
  }

  const navigate = useNavigate(); // Yönlendirme için hook
  
  const handleBookClick = (bookId) => {
    navigate(`/book-detail/${bookId}`); // Kitap detayına yönlendirme
  };
  
  return (
    
    <div className="article-card" key={id} onClick={() => handleBookClick(id)} style={{ cursor: "pointer" }}>
      {loading ? <div className="loading">Yükleniyor...</div> :
      error ? <div className="error">Hata: {error.message}</div> :
<>
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
          <p className="article-excerpt">{description}</p>

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
        <ProgressBar currentAmount={0} goal={0} />

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
      </div></>}
    </div>
  );
};

export default BookCard;