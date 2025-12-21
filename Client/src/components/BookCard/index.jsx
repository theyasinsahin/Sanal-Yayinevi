import React from 'react'; // React importu
import { FavoriteBorder, 
  Pages, 
  LocalOffer, 
  Visibility as EyeIcon,
  Comment as CommentIcon,  
  } from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';
import './BookCard.css';
import { useQuery } from '@apollo/client';
import { GET_BOOK_BY_ID } from '../../graphql/queries/book';
import { GET_USER_BY_ID } from '../../graphql/queries/user';
import { getOptimizedImage } from '../../utils/ImageUtils';

const BookCard = ({ book: bookProp, bookId }) => {

  const navigate = useNavigate();

  // 1. KİTAP SORGUSU
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

 // 2. YAZAR VERİSİ SORGUSU
  // Hedef: Eğer elimizde yazarın adı yoksa ama ID'si varsa, gidip adını çekmek.
  
  // Kitap objesinden yazar ID'sini güvenli bir şekilde alalım
  const authorIdToFetch = book?.authorId;

  // Zaten yazar bilgisi var mı? (String isim veya Obje olarak)
  // book.author doluysa tekrar sorgu atmaya gerek yok.
  const hasAuthorData = !!book?.author;

  const {
    data: userData,
    loading: userLoading,
    error: userError,
  } = useQuery(GET_USER_BY_ID, {
    variables: { id: authorIdToFetch },
    // SORGUSUNU ATLAMAK İÇİN ŞARTLAR (SKIP):
    // 1. Çekecek bir ID yoksa (!authorIdToFetch) -> Kesinlikle atla (Hatanın sebebi buydu)
    // 2. VEYA Zaten yazar bilgisi elimizde varsa (hasAuthorData) -> Atla
    skip: !authorIdToFetch || hasAuthorData,
  });

  // --- YÜKLENME VE HATA KONTROLLERİ ---
  const isLoading = (!bookProp && bookLoading) || (book?.authorId && !hasAuthorData && userLoading);
  
  if (isLoading) return <div className="article-card skeleton">Yükleniyor...</div>;
  if (bookError) return <p>Hata: {bookError.message}</p>;
  if (userError) return <p>Yazar Hatası: {userError.message}</p>;
  if (!book) return null; // Veri yoksa hiçbir şey çizme

  // --- VERİ HAZIRLIĞI ---
  const { title, description, imageUrl, pageCount, genre, stats, id, commentCount } = book;

  // 1. YAZAR ADI BELİRLEME (Robust Logic)
  let displayAuthor = "Bilinmeyen Yazar";
  
  if (book.author) {
    // Eğer author bir nesne ise (populate edilmişse)
    if (typeof book.author === 'object') {
        displayAuthor = book.author.fullName || book.author.username;
    } else {
        // Eğer author düz bir string ise
        displayAuthor = book.author;
    }
  } else if (userData?.getUserById) {
    // Eğer sorgudan geldiyse
    displayAuthor = userData.getUserById.fullName || userData.getUserById.username;
  }

  // 2. RESİM HAZIRLIĞI (Fallback Ekledik)
  // Eğer imageUrl yoksa placeholder kullan
  const finalCoverImage = imageUrl 
    ? getOptimizedImage(imageUrl, 300, 450) 
    : 'https://via.placeholder.com/300x450?text=Kapak+Yok';

  const handleBookClick = () => {
      navigate(`/book-detail/${id}`);
  };

  // --- RENDER ---
  return (
    <div
      className="article-card"
      onClick={handleBookClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="card-media">
        <img 
          src={finalCoverImage} 
          alt={title} 
          className="cover-image" 
          // Resim yüklenirken veya hata verirse çirkin durmasın
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
          
          <div className="author-info">
            <span className="by">Yazar: </span>
            <span className="author-name">{displayAuthor}</span>
          </div>
          
          {/* Açıklama yoksa boş gösterme */}
          <p className="article-excerpt">
            {description ? (description.length > 80 ? description.substring(0, 80) + "..." : description) : "Açıklama yok."}
          </p>

          <div className="stats">
            <div className="stat-item">
              <EyeIcon fontSize="small" />
              {/* Optional Chaining (?.) kullanarak hatayı önledik */}
              <span>{stats?.views || 0}</span>
            </div>
            
            <div className="stat-item">
              <CommentIcon fontSize="small" />
              {/* commentCount root'ta olduğu için direkt alıyoruz */}
              <span>{commentCount || 0}</span>
            </div>

            {/* Beğeni sayısı kontrolü */}
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