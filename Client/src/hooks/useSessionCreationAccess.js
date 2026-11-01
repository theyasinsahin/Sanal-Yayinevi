import { useEffect } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../context/AuthContext';
import { MY_SESSION_ACCESS, REQUEST_SESSION_ACCESS } from '../graphql/sessionAccess';

export default function useSessionCreationAccess() {
  const { user } = useAuth();
  const userId = user?.id;
  const { data, loading, error, refetch } = useQuery(MY_SESSION_ACCESS, {
    skip: !user, fetchPolicy: 'network-only', pollInterval: 30000,
    skipPollAttempt: () => document.visibilityState === 'hidden',
  });
  const [request, { loading: requesting }] = useMutation(REQUEST_SESSION_ACCESS, {
    update(cache, result) {
      if (result.data?.requestSessionCreationAccess) cache.writeQuery({ query: MY_SESSION_ACCESS,
        data: { mySessionCreationAccess: result.data.requestSessionCreationAccess } });
    },
  });
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState !== 'hidden') refetch().catch(() => {});
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId, refetch]);
  const access = user && data?.mySessionCreationAccess?.user?.id === user.id ? data.mySessionCreationAccess : null;
  return { access, loading, error, refetch, requesting, request: reason => request({ variables: { reason } }) };
}
