import React, { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { Link } from 'react-router-dom';

import { useFilters } from '../../context/FiltersContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { filterBooks } from '../../utils/FilterBooks';
import { GET_BOOKS } from '../../graphql/queries/book';
import { GET_ALL_USERS } from '../../graphql/queries/user';
import { GET_ALL_GENRES } from '../../graphql/queries/genre';

import FeedFilters from '../../components/Feed/FeedFilters';
import FeedSearch from '../../components/Feed/FeedSearch';
import BookGrid from '../../components/Books/BookGrid';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';

import { useUserPreference, useRecommendations } from '../../hooks/useRecommendations';

import './FeedPage.css';

// --- ONBOARDING ---
const FeedOnboarding = ({ onComplete }) => {
  const [selected, setSelected] = useState(new Set());
  const { data, loading } = useQuery(GET_ALL_GENRES);
  const { savePreference, saving } = useUserPreference();
  const { showToast } = useToast();

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) return;
    try {
      await savePreference([...selected]);
      onComplete?.();
    } catch (err) {
      // Önceden sadece console.error yapılıyordu — kullanıcı ekranda
      // hiçbir şey görmüyordu (örn. giriş yapmadan buraya ulaşılırsa,
      // ya da oturum bir şekilde ortada düşerse). Artık toast ile bildiriliyor.
      showToast(err.message || 'Tercih kaydedilemedi.', 'error');
    }
  };

  if (loading) return null;

  const genres = data?.getAllGenres ?? [];

  return (
    <div className="feed-onboarding">
      <Typography variant="h5" weight="bold">Hangi türleri seviyorsun?</Typography>
      <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
        En az bir tür seç, sana özel kitap önerileri hazırlayalım.
      </Typography>

      <div className="feed-onboarding-genres">
        {genres.map((genre) => {
          const isSelected = selected.has(genre.id);
          const color = genre.hexColor ?? '#6B7280';
          return (
            <button
              key={genre.id}
              className={`genre-pill${isSelected ? ' selected' : ''}`}
              style={isSelected ? { color, borderColor: color, backgroundColor: color + '15' } : {}}
              onClick={() => toggle(genre.id)}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      <button
        className="onboarding-save-btn"
        onClick={handleSave}
        disabled={selected.size === 0 || saving}
      >
        {saving
          ? 'Kaydediliyor...'
          : selected.size > 0
            ? `Devam et (${selected.size} tür seçildi)`
            : 'En az bir tür seç'}
      </button>
    </div>
  );
};

// --- TERCİH KUTUSU (sidebar) ---
const PreferenceBox = ({ preference, onEdit }) => {
  if (!preference?.onboardingCompleted) return null;

  return (
    <div className="preference-box">
      <div className="preference-box-header">
        <Typography variant="caption" weight="medium" color="muted">
          Tercihlerim
        </Typography>
        <button className="preference-edit-btn" onClick={onEdit}>
          Düzenle
        </button>
      </div>
      <div className="preference-genre-tags">
        {preference.preferredGenres?.map((genre) => (
          <span
            key={genre.id}
            className="preference-genre-tag"
            style={{
              color:           genre.hexColor ?? '#6B7280',
              borderColor:     (genre.hexColor ?? '#6B7280') + '50',
              backgroundColor: (genre.hexColor ?? '#6B7280') + '12',
            }}
          >
            {genre.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// --- ANA SAYFA ---
const FeedPage = () => {
  const { filters } = useFilters();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [editingPreference, setEditingPreference] = useState(false);

  // Keşfet sayfasına her girişte sayfayı en üste al: kullanıcı önceki
  // sayfada aşağı kaydırmış olsa bile buraya gelince tarayıcı scroll
  // pozisyonunu koruyabiliyor, bu da sidebar'daki tür filtreleri ve
  // arama kutusunun görünmemesine yol açıyordu.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { loading: booksLoading, error: booksError, data: booksData } = useQuery(GET_BOOKS);
  const { loading: usersLoading, data: usersData } = useQuery(GET_ALL_USERS);
  const { loading: genresLoading, data: genresData } = useQuery(GET_ALL_GENRES);
  const { preference, onboardingCompleted, preferenceLoading } = useUserPreference();

  // Recommendations her zaman hook seviyesinde çağrılmalı (hooks koşullu çağrılamaz)
  const { recommendations, loading: recLoading, loadMore } = useRecommendations(10);
  const recommendedBooks = recommendations.map(r => r.book);

  // Loading
  if (booksLoading || usersLoading || genresLoading) {
    return (
      <MainLayout>
        <div className="feed-page-wrapper">
          <Container maxWidth="7xl">
            <div className="feed-layout-grid">
              <aside className="feed-sidebar">
                <FeedSearch />
                <FeedFilters genres={[]} />
              </aside>
              <main className="feed-main-content">
                <div className="feed-header">
                  <Typography variant="h4" weight="bold">Keşfet</Typography>
                  <Typography variant="body" color="muted">Yükleniyor...</Typography>
                </div>
                <BookGrid loading={true} skeletonCount={9} />
              </main>
            </div>
          </Container>
        </div>
      </MainLayout>
    );
  }

  // Hata
  if (booksError) {
    return (
      <MainLayout>
        <div className="feed-page-wrapper">
          <Container maxWidth="7xl">
            <div className="feed-layout-grid">
              <aside className="feed-sidebar">
                <FeedSearch />
                <FeedFilters genres={[]} />
              </aside>
              <main className="feed-main-content">
                <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                  <Typography variant="h4" weight="bold">Kitaplar yüklenemedi</Typography>
                  <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
                    Geçici bir sorun olabilir. Lütfen biraz sonra tekrar deneyin.
                  </Typography>
                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <Button variant="primary" onClick={() => window.location.reload()}>Yenile</Button>
                    <Link to="/" style={{ textDecoration: 'none' }}>
                      <Button variant="outline">Ana Sayfaya Dön</Button>
                    </Link>
                  </div>
                </div>
              </main>
            </div>
          </Container>
        </div>
      </MainLayout>
    );
  }

  // Veri işleme
  const rawBooks  = booksData?.getAllBooks  ?? [];
  const allUsers  = usersData?.getAllUsers  ?? [];
  const allGenres = genresData?.getAllGenres ?? [];

  const enrichedBooks = rawBooks.map(book => {
    const authorDetail = allUsers.find(u => u.id === book.authorId || u._id === book.authorId);
    return {
      ...book,
      author: authorDetail || { username: 'Bilinmiyor', fullName: 'Bilinmiyor' },
      genre:  book.genre?.slug ?? 'Tümü',
    };
  });

  const filteredBooks = filterBooks(enrichedBooks, filters);

  const handlePreferenceEdit = () => {
    setEditingPreference(true);
    setActiveTab('for-you');
  };

  const handleOnboardingComplete = () => {
    setEditingPreference(false);
  };

  return (
    <MainLayout>
      <div className="feed-page-wrapper">
        <Container maxWidth="7xl">
          <div className="feed-layout-grid">

            {/* SIDEBAR */}
            <aside className="feed-sidebar">
              <FeedSearch />
              <FeedFilters genres={allGenres} />
              {!preferenceLoading && (
                <PreferenceBox
                  preference={preference}
                  onEdit={handlePreferenceEdit}
                />
              )}
            </aside>

            {/* MAIN */}
            <main className="feed-main-content">

              {/* SEKMELER */}
              <div className="feed-tabs">
                <button
                  className={`feed-tab${activeTab === 'all' ? ' active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  Tüm kitaplar
                </button>
                <button
                  className={`feed-tab${activeTab === 'for-you' ? ' active' : ''}`}
                  onClick={() => setActiveTab('for-you')}
                >
                  Senin için
                  {onboardingCompleted && (
                    <span className="feed-tab-badge">YENİ</span>
                  )}
                </button>
              </div>

              {/* TÜM KİTAPLAR */}
              {activeTab === 'all' && (
                <>
                  <div className="feed-header">
                    <Typography variant="h4" weight="bold">Keşfet</Typography>
                    <Typography variant="body" color="muted">
                      {filteredBooks.length} kitap listeleniyor
                    </Typography>
                  </div>

                  {filteredBooks.length > 0 ? (
                    <BookGrid books={filteredBooks} loading={booksLoading} />
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
                </>
              )}

              {/* SENİN İÇİN */}
              {activeTab === 'for-you' && (
                <>
                  {!user ? (
                    // DÜZELTME: Öneriler ve tercih kaydı backend'de tamamen
                    // giriş gerektiriyor. Eskiden giriş yapmamış kullanıcı
                    // buraya girip tür seçip "Devam et" diyebiliyor, sonra
                    // hiçbir geri bildirim almadan kaydın sessizce
                    // başarısız olduğunu görüyordu. Artık baştan net bir
                    // giriş daveti gösteriliyor, boşa vakit kaybettirmiyor.
                    <div className="no-results-box">
                      <Typography variant="h6" color="muted">Giriş yapman gerekiyor</Typography>
                      <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
                        Sana özel kitap önerileri hazırlayabilmemiz için önce giriş yapmalısın.
                      </Typography>
                      <div style={{ marginTop: '1.5rem' }}>
                        <Link to="/login" style={{ textDecoration: 'none' }}>
                          <Button variant="primary">Giriş Yap</Button>
                        </Link>
                      </div>
                    </div>
                  ) : (!onboardingCompleted || editingPreference) ? (
                    <FeedOnboarding onComplete={handleOnboardingComplete} />
                  ) : (
                    <>
                      <div className="feed-header">
                        <Typography variant="h4" weight="bold">Senin için</Typography>
                        <Typography variant="body" color="muted">
                          Tercihlerine göre seçildi
                        </Typography>
                      </div>

                      <BookGrid
                        books={recommendedBooks}
                        loading={recLoading}
                        recommendations={recommendations}
                        skeletonCount={6}
                      />

                      {!recLoading && recommendedBooks.length > 0 && (
                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                          <Button variant="outline" onClick={loadMore}>
                            Daha fazla göster
                          </Button>
                        </div>
                      )}

                      {!recLoading && recommendedBooks.length === 0 && (
                        <div className="no-results-box">
                          <Typography variant="h6" color="muted">Henüz öneri yok</Typography>
                          <Typography variant="body" color="muted" style={{ marginTop: '0.5rem' }}>
                            Birkaç kitap beğen veya kaydet, sana özel öneriler hazırlayalım.
                          </Typography>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

            </main>
          </div>
        </Container>
      </div>
    </MainLayout>
  );
};

export default FeedPage;