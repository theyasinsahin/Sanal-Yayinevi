import React from 'react';
import { Link } from 'react-router-dom';
import { useBookFeed } from '../../../hooks/useBookFeed';
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import { Container } from '../../UI/Container';
import BookCard from '../../Books/BookCard';
import './FeaturedBooks.css';

const BOOKS_PER_PAGE = 8;

const FeaturedBooks = ({ search = '', onClearSearch }) => {
  const { books, loading, searchPending, error, refetch, loadMore, loadingMore, moreError, hasNextPage } = useBookFeed(
    { search, sortBy: 'popular' }, true, { limit: BOOKS_PER_PAGE }
  );
  const term = search.trim();
  const isLoading = loading || searchPending;

  return (
    <section id="home-books" className="featured-books-section" aria-labelledby="home-books-title" aria-busy={isLoading}>
      <Container maxWidth="7xl">
        <div className="featured-books-header">
          <div>
            <Typography id="home-books-title" variant="h2" weight="bold">
              {term ? 'Arama Sonuçları' : 'En Popüler Kitaplar'}
            </Typography>
            <Typography variant="body" color="muted" className="featured-books-description" role="status">
              {isLoading ? 'Kitaplar yükleniyor…' : error ? 'Kitaplar şu an yüklenemiyor.' : term
                ? `${books.length}${hasNextPage ? '+' : ''} kitap listeleniyor.`
                : 'Okurların en çok beğendiği kitapları keşfedin.'}
            </Typography>
          </div>
          <Link to="/feed" className="featured-books-all">Tüm Kitapları Gör →</Link>
        </div>

        {isLoading ? (
          <div className="featured-books-grid">
            {Array.from({ length: BOOKS_PER_PAGE }, (_, index) => <BookCard key={index} skeleton />)}
          </div>
        ) : error ? (
          <div className="featured-books-message" role="alert">
            <Typography variant="body" color="muted">Bağlantınızı kontrol edip tekrar deneyin.</Typography>
            <Button variant="outline" onClick={() => refetch()}>Yeniden Dene</Button>
          </div>
        ) : books.length ? (
          <>
            <div className="featured-books-grid">
              {books.map(book => <BookCard key={book.id} book={book} />)}
            </div>
            {moreError && <p role="alert">Diğer kitaplar yüklenemedi. Tekrar deneyin.</p>}
            {hasNextPage && (
              <div className="featured-books-more">
                <Button variant="outline" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Yükleniyor…' : 'Daha Fazla Kitap Göster'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="featured-books-message">
            <Typography variant="body" color="muted">
              {term ? 'Aramanızla eşleşen kitap bulunamadı. Farklı bir kitap veya yazar adı deneyin.' : 'Henüz yayımlanmış kitap bulunmuyor.'}
            </Typography>
            {term && <Button variant="outline" onClick={onClearSearch}>Popüler Kitaplara Dön</Button>}
          </div>
        )}
      </Container>
    </section>
  );
};

export default FeaturedBooks;
