import React from 'react';
import { FavoriteBorder, Pages, LocalOffer, Visibility as EyeIcon, Comment as CommentIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import './BookCard.css';
import { useQuery } from '@apollo/client';
import { GET_BOOK_BY_ID } from '../../../graphql/queries/book';
import { getOptimizedImage } from '../../../utils/ImageUtils';

const BookCard = ({ book: bookProp, bookId }) => {

  const navigate = useNavigate();

  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !!bookProp || !bookId,
  });

  // Hangi objeyi kullanacağız?
  const book = bookProp ? bookProp : bookData?.getBookById;
  // --- İKİNCİ SORGEYU SİLİYORUZ (GET_USER_BY_ID) --- 
  // Artık yazar verisi book.author içinde hazır gelecek.

  if ((!bookProp && bookLoading)) return <div className="article-card skeleton">Yükleniyor...</div>;
  if (bookError) return <p>Hata: {bookError.message}</p>;
  if (!book) return null;

  const { title, description, imageUrl, pageCount, genre, stats, id, commentCount, author } = book;

  // YAZAR ADI BELİRLEME (Çok daha basit)
  const displayAuthor = author?.fullName || author?.username || "Bilinmeyen Yazar";

  // RESİM HAZIRLIĞI
  const finalCoverImage = imageUrl 
    ? getOptimizedImage(imageUrl, 300, 450) 
    : 'https://via.placeholder.com/300x450?text=Kapak+Yok';

  const handleBookClick = () => {
      navigate(`/book-detail/${id}`);
  };

  return (
    <div className="article-card" onClick={handleBookClick} style={{ cursor: 'pointer' }}>
      <div className="card-media">
        <img 
          src={finalCoverImage} 
          alt={title} 
          className="cover-image" 
          onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=Hata'; }}
        />
        <div className="meta-overlay">
          <div className="meta-item">
            <Pages className="meta-icon" />
            <span>{pageCount || 0} Sayfa</span>
          </div>
          <div className="meta-item">
            <LocalOffer className="meta-icon" />
            <span style={{textTransform: 'capitalize'}}>{genre || 'Genel'}</span>
          </div>
        </div>
      </div>

      <div className="card-content">
        <div className="card-header">
          <h3 className="article-title">{title}</h3>
          
          {/* Yazar Kısmı */}
          <div className="author-info">
            <span className="by">Yazar: </span>
            <span className="author-name">{displayAuthor}</span>
          </div>
          
          <p className="article-excerpt">
            {description ? (description.length > 80 ? description.substring(0, 80) + "..." : description) : "Açıklama yok."}
          </p>

          <div className="stats">
            <div className="stat-item">
              <EyeIcon fontSize="small" />
              <span>{stats?.views || 0}</span>
            </div>
            <div className="stat-item">
              <CommentIcon fontSize="small" />
              <span>{commentCount || 0}</span>
            </div>
            <div className="stat-item">
                <FavoriteBorder fontSize="small" />
                <span>{(stats?.likes || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookCard;