import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_BOOK_FEED } from '../graphql/queries/book';

const sorts = { newest: 'NEWEST', oldest: 'OLDEST', popular: 'POPULAR', lastUpdated: 'UPDATED' };

export function useBookFeed(filters, enabled = true, { limit = 24 } = {}) {
  const requestedSearch = (filters.search || '').trim().slice(0, 100);
  const [search, setSearch] = useState(requestedSearch);
  const [moreError, setMoreError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => setSearch((filters.search || '').trim().slice(0, 100)), 250);
    return () => clearTimeout(timer);
  }, [filters.search]);
  const variables = { limit, sort: sorts[filters.sortBy] || 'NEWEST',
    classification: filters.classification || null, search: search || null };
  const key = JSON.stringify(variables);
  const activeKey = useRef(key);
  activeKey.current = key;
  useEffect(() => { setMoreError(null); }, [key]);
  const { data, loading, error, fetchMore, refetch } = useQuery(GET_BOOK_FEED, {
    variables,
    skip: !enabled,
  });
  const page = data?.getBookFeed;
  const loadMore = async () => {
    if (pending.current || !page?.hasNextPage) return;
    const requestedKey = key;
    pending.current = true; setLoadingMore(true); setMoreError(null);
    try {
      await fetchMore({ variables: { after: page.endCursor }, updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult || !previous || requestedKey !== activeKey.current) return previous;
        const next = fetchMoreResult.getBookFeed;
        const books = new Map([...previous.getBookFeed.books, ...next.books].map(book => [book.id, book]));
        return { getBookFeed: { ...next, books: [...books.values()] } };
      } });
    } catch (failure) { if (requestedKey === activeKey.current) setMoreError(failure); }
    finally { pending.current = false; setLoadingMore(false); }
  };
  return { books: page?.books || [], loading, searchPending: requestedSearch !== search, error, refetch, loadMore, loadingMore, moreError, hasNextPage: page?.hasNextPage || false };
}
