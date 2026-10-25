import { useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { SCORE_UPDATED_EVENT } from '../utils/scoreUpdates';

export function useLiveScoreQuery(query, options = {}) {
  const result = useQuery(query, { fetchPolicy: 'cache-and-network', pollInterval: 15000, ...options });
  const { refetch } = result;
  useEffect(() => {
    if (options.skip) return undefined;
    const refresh = () => { if (document.visibilityState !== 'hidden') refetch().catch(() => {}); };
    window.addEventListener(SCORE_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(SCORE_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [options.skip, refetch]);
  return result;
}
