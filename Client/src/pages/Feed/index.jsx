import React from 'react';
import { useQuery } from '@apollo/client';

// --- LOGIC & CONTEXT ---
import { useFilters } from '../../context/FiltersContext';
import { filterBooks } from '../../utils/FilterBooks';
import { GET_BOOKS } from '../../graphql/queries/book';
import { GET_ALL_USERS } from '../../graphql/queries/user';

// --- COMPONENTS ---
import FeedFilters from '../../components/Feed/FeedFilters';
import FeedSearch from '../../components/Feed/FeedSearch';
import BookGrid from '../../components/Books/BookGrid'; // Henüz refactor edilmedi ama yeri doğru
import { MainLayout } from '../../components/Layout/MainLayout';

// --- UI KIT ---
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';

import './FeedPage.css';

const FeedPage = () => {
  const { filters } = useFilters();

  // 1. VERİ ÇEKME
  const { loading: booksLoading, error: booksError, data: booksData } = useQuery(GET_BOOKS);
  const { loading: usersLoading, error: usersError, data: usersData } = useQuery(GET_ALL_USERS);

  // 2. YÜKLENİYOR DURUMU
  if (booksLoading || usersLoading) {
    return (
      <MainLayout>
        <Container className="py-10 text-center">
           <Typography variant="h5" color="muted">İçerikler yükleniyor...</Typography>
        </Container>
      </MainLayout>
    );
  }

  // 3. HATA DURUMU
  if (booksError || usersError) {
    return (
      <MainLayout>
        <Container className="py-10 text-center">
          <Typography variant="body" color="danger">
            Hata: {booksError?.message || usersError?.message}
          </Typography>
        </Container>
      </MainLayout>
    );
  }

  // 4. VERİ İŞLEME
  const rawBooks = booksData?.getAllBooks || [];
  const allUsers = usersData?.getAllUsers || [];

  const enrichedBooks = rawBooks.map(book => {
    const authorDetail = allUsers.find(u => u.id === book.authorId || u._id === book.authorId);
    return {
      ...book,
      author: authorDetail || { username: 'Bilinmiyor', fullName: 'Bilinmiyor' } 
    };
  });

  const filteredBooks = filterBooks(enrichedBooks, filters);

  return (
    <MainLayout>
      <div className="feed-page-wrapper">
        <Container maxWidth="7xl">
          
          <div className="feed-layout-grid">
            
            {/* SOL: FİLTRELER (SIDEBAR) */}
            <aside className="feed-sidebar">
              {/* Mobilde Search burada da olabilir veya yukarıda */}
              <FeedSearch /> 
              <FeedFilters />
            </aside>
            
            {/* SAĞ: İÇERİK (MAIN) */}
            <main className="feed-main-content">
              
              <div className="feed-header">
                <Typography variant="h4" weight="bold">Keşfet</Typography>
                <Typography variant="body" color="muted">
                  {filteredBooks.length} kitap listeleniyor
                </Typography>
              </div>

              {filteredBooks.length > 0 ? (
                 <BookGrid books={filteredBooks} />
              ) : (
                 <div className="no-results-box">
                   <Typography variant="h6" color="muted">
                     Aramanızla eşleşen kitap bulunamadı.
                   </Typography>
                   <Typography variant="body" color="muted">
                     Filtreleri değiştirmeyi deneyebilirsiniz.
                   </Typography>
                 </div>
              )}
            </main>

          </div>

        </Container>
      </div>
    </MainLayout>
  );
};

export default FeedPage;