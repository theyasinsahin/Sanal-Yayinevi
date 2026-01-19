import React from 'react';
import { useFilters } from '../../context/FiltersContext';
import FeedFilters from './FeedFilters';
import FeedSearch from '../../components/FeedSearch';
import BookGrid from '../../components/Books/BookGrid';
import { filterBooks } from '../../utils/FilterArticles';

import { useQuery } from '@apollo/client';
// İki sorguyu da import ediyoruz
import { GET_BOOKS } from '../../graphql/queries/book';
import { GET_ALL_USERS } from '../../graphql/queries/user'; // Bu sorgunun var olduğunu varsayıyorum

const FeedPage = () => {
  const { filters } = useFilters();

  // 1. KİTAPLARI ÇEK
  const { 
    loading: booksLoading, 
    error: booksError, 
    data: booksData 
  } = useQuery(GET_BOOKS);

  // 2. KULLANICILARI ÇEK
  const { 
    loading: usersLoading, 
    error: usersError, 
    data: usersData 
  } = useQuery(GET_ALL_USERS);

  // Herhangi biri yükleniyorsa bekle
  if (booksLoading || usersLoading) return <p>Yükleniyor...</p>;
  
  // Hata kontrolü
  if (booksError) return <p>Kitaplar yüklenirken hata: {booksError.message}</p>;
  if (usersError) return <p>Kullanıcılar yüklenirken hata: {usersError.message}</p>;

  // Verileri al
  const rawBooks = booksData?.getAllBooks || [];
  const allUsers = usersData?.getAllUsers || [];

  // 3. VERİLERİ BİRLEŞTİR (DATA MERGING)
  // Backend'in yapmadığı populate işlemini burada biz yapıyoruz.
  const enrichedBooks = rawBooks.map(book => {
    // Bu kitabın yazarını, kullanıcılar listesinde ID'sine göre bul
    const authorDetail = allUsers.find(u => u.id === book.authorId || u._id === book.authorId);

    return {
      ...book,
      // Kitabın içine 'author' objesini ekle. Bulunamazsa boş obje koy patlamasın.
      author: authorDetail || { username: 'Bilinmiyor', fullName: 'Bilinmiyor' } 
    };
  });

  // 4. FİLTRELEME
  // Artık enrichedBooks içinde author objesi olduğu için filtreleme fonksiyonu yazar ismine göre çalışır.
  const filteredBooks = filterBooks(enrichedBooks, filters);

  return (
    <div className="feed-page-container">
      <aside className="filters-sidebar">
        <FeedSearch />
        <FeedFilters />
      </aside>
      
      <main className="articles-main">
        {filteredBooks.length > 0 ? (
           <BookGrid books={filteredBooks} />
        ) : (
           <div className="no-results">
             <p>Aramanızla eşleşen kitap bulunamadı.</p>
           </div>
        )}
      </main>
    </div>
  );
};

export default FeedPage;