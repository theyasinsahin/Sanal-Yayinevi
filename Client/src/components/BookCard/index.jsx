import React, {useEffect} from 'react';
import { FavoriteBorder, 
  Pages, 
  LocalOffer, 
  Share, 
  BookmarkBorder, 
  Visibility as EyeIcon,
  Comment as CommentIcon  } from '@mui/icons-material';

import { useNavigate } from 'react-router-dom';

import './BookCard.css';
import { useQuery } from '@apollo/client';
import {GET_BOOK_BY_ID} from '../../graphql/queries/book';
import {GET_USER_BY_ID} from '../../graphql/queries/user';

/*
 * BU COMPONENT İKİ ŞEKİLDE ÇALIŞIR:
 * 1. <BookCard book={fullBookObject} />
 * -> 'book' prop'u varsa, query'leri atlar (skip) ve bu veriyi direkt kullanır.
 * -> Bu, 'GET_BOOKS' gibi bir liste sorgusundan gelen veri için idealdir.
 * 2. <BookCard bookId="12345" />
 * -> 'book' prop'u yoksa, 'bookId' kullanarak 'GET_BOOK_BY_ID' sorgusunu çalıştırır.
 */
const BookCard = ({ book: bookProp, bookId }) => {
  const navigate = useNavigate();

  // 1. KİTAP VERİSİ SORGUSU
  // 'bookProp' varsa (!!bookProp === true) bu sorguyu ATLA (skip: true)
  const {
    data: bookData,
    loading: bookLoading,
    error: bookError,
  } = useQuery(GET_BOOK_BY_ID, {
    variables: { id: bookId },
    skip: !!bookProp || !bookId, // bookProp varsa VEYA bookId yoksa sorguyu çalıştırma
  });

  // Kullanılacak 'book' nesnesini belirle:
  // Prop olarak 'bookProp' geldiyse onu kullan, gelmediyse sorgudan dönen 'bookData'yı kullan.
  const book = bookProp ? bookProp : bookData?.getBookById;

  // 2. YAZAR VERİSİ SORGUSU
  // 'book' nesnesinden 'authorId' veya 'author' string'ini almayı dene
  const authorId = book?.authorId; // GET_BOOK_BY_ID'den
  const authorString = book?.author; // GET_BOOKS'tan (ilk sorgunuzdaki gibi)

  const {
    data: userData,
    loading: userLoading,
    error: userError,
  } = useQuery(GET_USER_BY_ID, {
    variables: { id: authorId },
    // Bu sorguyu ATLA, eğer:
    // 1. Alınacak bir 'authorId' yoksa (!authorId)
    // 2. VEYA 'book' nesnesinden 'author' string'i zaten geldiyse (!!authorString)
    skip: !authorId || !!authorString,
  });

  // 3. YÜKLENME DURUMU
  // Ne zaman yükleniyor sayılırız?
  // a) 'bookProp' gelmediyse VE 'bookLoading' sürüyorsa (yani kitabı çekiyorsak)
  // b) 'authorId' varsa AMA 'authorString' yoksa VE 'userLoading' sürüyorsa (yani yazarı çekiyorsak)
  const isLoading =
    (!bookProp && bookLoading) || (authorId && !authorString && userLoading);
  
  if (isLoading) return <p>Yükleniyor...</p>;

  // 4. HATA DURUMU
  if (bookError) return <p>Kitap yüklenirken hata oluştu: {bookError.message}</p>;
  if (userError) return <p>Yazar yüklenirken hata oluştu: {userError.message}</p>;

  // 5. VERİ YOKSA (Eğer sorgu bitti ama veri gelmediyse)
  if (!book) {
    return <p>Kitap verisi bulunamadı.</p>;
  }

  // 6. RENDER HAZIRLIĞI
  // Artık 'book' nesnesinin dolu olduğundan eminiz.
  const { title, description, imageUrl, pageCount, genre, stats, id } = book;

  // Yazar adını belirle:
  let author = 'Bilinmiyor';
  if (authorString) {
    author = authorString; // Prop'tan (GET_BOOKS) gelen string'i kullan
  } else if (userData && userData.getUserById) {
    author = userData.getUserById.fullName || userData.getUserById.username; // GET_USER_BY_ID sorgusundan geleni kullan
  }

  const handleBookClick = (bookId) => {
    navigate(`/book-detail/${bookId}`);
  };

  // 7. JSX RENDER
  return (
    <div
      className="article-card"
      key={id}
      onClick={() => handleBookClick(id)}
      style={{ cursor: 'pointer' }}
    >
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
            <span className="author-name">{author}</span> {/* Dinamik yazar adı */}
          </div>
          <p className="article-excerpt">{description}</p>

          <div className="stats">
            <div className="stat-item">
              <EyeIcon fontSize="small" />
              <span>{stats.views.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <CommentIcon fontSize="small" />
              <span>{stats.comments}</span>
            </div>
            {/* 'likes' ve 'shares' için sorgunuzu güncellediğinizi varsayıyorum */}
            {stats.likes !== undefined && (
              <div className="stat-item">
                <FavoriteBorder fontSize="small" />
                <span>{stats.likes.toLocaleString()}</span>
              </div>
            )}
            {stats.shares !== undefined && (
              <div className="stat-item">
                <Share fontSize="small" />
                <span>{stats.shares}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card-footer">
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