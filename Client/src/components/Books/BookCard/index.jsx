import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { 
  FavoriteBorder, 
  Pages, 
  LocalOffer, 
  Visibility as EyeIcon, 
  Comment as CommentIcon 
} from '@mui/icons-material';

// --- LOGIC ---
import { GET_BOOK_BY_ID } from '../../../graphql/queries/book';
import { getOptimizedImage } from '../../../utils/ImageUtils';

// --- UI KIT ---
import { Typography } from '../../UI/Typography';

import './BookCard.css';

const BookCard = ({ book: bookProp, bookId }) => {
  const navigate = useNavigate();

  // Eğer bookId verildiyse veriyi çek, verilmediyse prop'u kullan
  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !!bookProp || !bookId, // bookProp varsa sorguyu atla
  });

  // Hangi objeyi kullanacağız?
  const book = bookProp ? bookProp : bookData?.getBookById;

  // Loading Skeleton (Basit versiyon)
  if (!bookProp && bookLoading) return <div className="book-card skeleton"></div>;
  
  if (bookError) return null; // Hata varsa kartı hiç gösterme (veya hata kartı göster)
  if (!book) return null;

  const { title, description, imageUrl, pageCount, genre, stats, id, commentCount, author } = book;

  // Yazar Adı (Güvenli Erişim)
  const displayAuthor = author?.fullName || author?.username || "Gizli Yazar";

  // Resim Optimizasyonu
  const finalCoverImage = imageUrl 
    ? getOptimizedImage(imageUrl, 300, 450) 
    : 'https://via.placeholder.com/300x450?text=Kapak+Yok';

  const handleBookClick = () => {
      navigate(`/book-detail/${id}`);
  };

  return (
    <div className="book-card" onClick={handleBookClick}>
      
      {/* --- GÖRSEL ALANI --- */}
      <div className="card-media">
        <img 
          src={finalCoverImage} 
          alt={title} 
          className="cover-image" 
          loading="lazy"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/300x450?text=Hata'; }}
        />
        
        {/* Görsel Üzerindeki Etiketler */}
        <div className="meta-overlay">
          <div className="meta-badge">
            <Pages style={{fontSize:12}} />
            <span>{pageCount || 0} Syf</span>
          </div>
          <div className="meta-badge">
            <LocalOffer fontSize="small" />
            <span className="capitalize">{genre || 'Genel'}</span>
          </div>
        </div>
      </div>

      {/* --- İÇERİK ALANI --- */}
      <div className="card-content">
        
        {/* Başlık */}
        <Typography variant="h6" weight="bold" className="book-title" title={title} style={{ fontSize: '1.5rem' }}>
          {title}
        </Typography>
        
        {/* Yazar */}
        <div className="book-author">
          <Typography variant="caption" color="muted">Yazar:</Typography>
          <Typography variant="caption" weight="medium" color="default">
             {displayAuthor}
          </Typography>
        </div>
        
        {/* Açıklama (Kısa) */}
        <Typography variant="body" color="muted" className="book-excerpt">
          {description 
            ? (description.length > 80 ? description.substring(0, 80) + "..." : description) 
            : "Açıklama bulunmuyor."}
        </Typography>

        {/* İstatistikler (Alt Bar) */}
        <div className="card-stats">
          <div className="stat-item" title="Görüntülenme">
            <EyeIcon className="stat-icon" />
            <span>{stats?.views || 0}</span>
          </div>
          <div className="stat-item" title="Yorumlar">
            <CommentIcon className="stat-icon" />
            <span>{commentCount || 0}</span>
          </div>
          <div className="stat-item" title="Beğeniler">
             <FavoriteBorder className="stat-icon" />
             <span>{(stats?.likes || 0).toLocaleString()}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BookCard;