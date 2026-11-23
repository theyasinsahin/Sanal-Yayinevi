import React from 'react';
import { Link } from 'react-router-dom';
import { useBookFeed } from '../../../hooks/useBookFeed';
import { Typography } from '../../UI/Typography';
import { Button } from '../../UI/Button';
import { Container } from '../../UI/Container';
import BookCard from '../../Books/BookCard';
import SectionHeading from '../SectionHeading';
import './FeaturedBooks.css';

const BOOKS_PER_PAGE = 10;

const FeaturedBooks = ({ search = '', onClearSearch }) => {
  const { books, loading, searchPending, error, refetch, loadMore, loadingMore, moreError, hasNextPage } = useBookFeed(
    { search, sortBy: 'popular' }, true, { limit: BOOKS_PER_PAGE }
  );
  const term = search.trim();
  const isLoading = loading || searchPending;

  return (
    <section id="home-books" className="featured-books-section" aria-labelledby="home-books-title" aria-busy={isLoading}>
      <Container maxWidth="7xl">
        <SectionHeading
          number="01"
          eyebrow={term ? 'Arama' : 'Seçki'}
          titleId="home-books-title"
          title={term ? 'Arama Sonuçları' : 'En Popüler Kitaplar'}
          description={isLoading ? 'Kitaplar yükleniyor…' : error ? 'Kitaplar şu an yüklenemiyor.' : term
            ? `${books.length}${hasNextPage ? '+' : ''} kitap listeleniyor.`
            : 'Okurların en çok beğendiği kitapları keşfedin.'}
          descriptionProps={{ role: 'status' }}
          action={<Link to="/feed" className="section-link">Tüm Kitapları Gör →</Link>}
        />

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
            <div className={`featured-books-grid${term ? '' : ' featured-books-grid--ranked'}`}>
              {books.map((book, index) => (
                <div className="featured-book" key={book.id}>
                  {!term && <span className="featured-book-rank" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>}
                  <BookCard book={book} />
                </div>
              ))}
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
