import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client';
import { FormatQuote, WhatshotOutlined, AccessTimeOutlined } from '@mui/icons-material';
import { GET_QUOTES_FEED, SEARCH_QUOTES } from '../../graphql/queries/quote';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import QuoteCard from '../../components/Quote/QuoteCard';
import './QuotesPage.css';

const LIMIT = 20;

const QuotesPage = () => {
  const [sortBy, setSortBy] = useState('popular');
  const [quotes, setQuotes] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef(null);

  const [searchQuotesFn] = useLazyQuery(SEARCH_QUOTES);

  const { data, loading, fetchMore } = useQuery(GET_QUOTES_FEED, {
    variables: { limit: LIMIT, offset: 0, sortBy },
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    const incoming = data?.getQuotesFeed || [];
    if (incoming.length > 0) {
      setQuotes(incoming);
      setOffset(incoming.length);
      setHasMore(incoming.length === LIMIT);
    }
  }, [data]);

  const handleSortChange = (newSort) => {
    if (newSort === sortBy) return;
    setSortBy(newSort);
    setQuotes([]);
    setOffset(0);
    setHasMore(true);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      const { data } = await searchQuotesFn({
        variables: { query: value, limit: 20, offset: 0 }
      });
      setSearchResults(data?.searchQuotes || []);
      setIsSearching(false);
    }, 400);
  };

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    try {
      const { data: moreData } = await fetchMore({
        variables: { limit: LIMIT, offset, sortBy }
      });

      const incoming = moreData?.getQuotesFeed || [];
      
      if (incoming.length === 0) {
        setHasMore(false);
        return;
      }

      setQuotes(prev => {
        const existingIds = new Set(prev.map(q => q.id));
        const uniqueIncoming = incoming.filter(q => !existingIds.has(q.id));
        return [...prev, ...uniqueIncoming];
      });

      setOffset(prev => prev + incoming.length);
      setHasMore(incoming.length === LIMIT);
    } catch (error) {
      console.error("Daha fazla veri yüklenirken hata oluştu:", error);
    }
  }, [loading, hasMore, offset, sortBy, fetchMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { 
        if (entries[0].isIntersecting && !searchQuery.trim()) {
          loadMore(); 
        } 
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loadMore, searchQuery]);

  const displayedQuotes = searchQuery.trim() ? searchResults : quotes;

  return (
    <MainLayout>
      <div className="quotes-page">
        <Container maxWidth="3xl">
          {/* Header */}
          <div className="quotes-page-header">
            <div className="quotes-page-title">
              <FormatQuote fontSize="large" />
              <Typography variant="h3" weight="bold">Alıntılar</Typography>
            </div>
            <Typography variant="body" color="muted">
              Okuyucuların kitaplardan derlediği en güzel alıntılar
            </Typography>

            <div className="quotes-search-wrapper">
              <input
                className="quotes-search-input"
                placeholder="Alıntı, kitap veya yazar ara..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Sıralama */}
            <div className="quotes-sort-tabs">
              <button
                className={`sort-tab ${sortBy === 'popular' ? 'active' : ''}`}
                onClick={() => handleSortChange('popular')}
              >
                <WhatshotOutlined fontSize="small" />
                En Popüler
              </button>
              <button
                className={`sort-tab ${sortBy === 'newest' ? 'active' : ''}`}
                onClick={() => handleSortChange('newest')}
              >
                <AccessTimeOutlined fontSize="small" />
                En Yeni
              </button>
            </div>
          </div>

          {/* Tek Sütun Liste */}
          <div className="quotes-list">
            {displayedQuotes.map(quote => (
              <QuoteCard key={quote.id} quote={quote} />
            ))}
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="quotes-list">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="quote-card-skeleton" />
              ))}
            </div>
          )}

          {/* Sonsuz scroll tetikleyici */}
          {!searchQuery.trim() && (
            <div ref={loaderRef} className="quotes-loader-trigger" />
          )}

          {/* Bitti */}
          {!hasMore && quotes.length > 0 && !searchQuery.trim() && (
            <div className="quotes-end-message">
              <Typography variant="body" color="muted">Tüm alıntılar yüklendi ✦</Typography>
            </div>
          )}

          {/* Boş durum */}
          {!loading && displayedQuotes.length === 0 && (
            <div className="quotes-empty">
              <FormatQuote style={{ fontSize: '4rem', opacity: 0.2 }} />
              <Typography variant="h5" color="muted">Henüz alıntı yok</Typography>
              <Typography variant="body" color="muted">
                {searchQuery.trim() ? "Aramanıza uygun sonuç bulunamadı." : "Kitap okurken beğendiğin bölümleri alıntıla!"}
              </Typography>
            </div>
          )}
        </Container>
      </div>
    </MainLayout>
  );
};

export default QuotesPage;