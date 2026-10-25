import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApolloClient, useMutation, useQuery } from '@apollo/client';
import { Button } from '../UI/Button';
import { GET_INCOMING_FOLLOW_REQUESTS, RESPOND_TO_FOLLOW_REQUEST } from '../../graphql/followRequests';

export default function FollowRequests() {
  const client = useApolloClient();
  const { data, loading, error, refetch, fetchMore, startPolling, stopPolling } = useQuery(GET_INCOMING_FOLLOW_REQUESTS, {
    variables: { limit: 20, offset: 0 }, fetchPolicy: 'network-only', pollInterval: 15000,
  });
  const [respond] = useMutation(RESPOND_TO_FOLLOW_REQUEST);
  const [busy, setBusy] = useState(false);
  const processing = useRef(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const requests = data?.getIncomingFollowRequests?.items || [];
  const total = data?.getIncomingFollowRequests?.total || 0;
  useEffect(() => {
    // Do not replace additional pages while someone is reviewing older requests.
    if (requests.length > 20) stopPolling();
    else startPolling(15000);
    return () => stopPolling();
  }, [requests.length, startPolling, stopPolling]);

  const handleResponse = async (requestId, accept) => {
    if (processing.current) return;
    processing.current = true; setBusy(true); setActionError(''); setMessage('');
    try {
      const response = await respond({ variables: { requestId, accept } });
      setMessage(response.data.respondToFollowRequest.message);
      await Promise.all([
        refetch(),
        client.refetchQueries({ include: 'active', onQueryUpdated: query =>
          ['GetUnreadNotificationCount', 'GetNotifications', 'GetUserById'].includes(query.queryName) ? query.refetch() : false,
        }),
      ]);
    } catch (failure) {
      setActionError(failure.message || 'Takip isteği yanıtlanamadı.');
      // A concurrent cancellation may have removed the request from the inbox.
      await refetch().catch(() => {});
    } finally { processing.current = false; setBusy(false); }
  };
  const loadMore = async () => {
    setLoadingMore(true); setActionError('');
    try {
      await fetchMore({ variables: { offset: requests.length }, updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        const items = new Map([...previous.getIncomingFollowRequests.items, ...fetchMoreResult.getIncomingFollowRequests.items].map(item => [item.id, item]));
        return { getIncomingFollowRequests: { ...fetchMoreResult.getIncomingFollowRequests, items: [...items.values()] } };
      } });
    } catch { setActionError('Diğer takip istekleri yüklenemedi.'); }
    finally { setLoadingMore(false); }
  };

  return <section aria-label="Takip istekleri" className="follow-requests">
    <h3>Takip İstekleri{total > 0 ? ` (${total})` : ''}</h3>
    {loading && !data && <p role="status">Takip istekleri yükleniyor…</p>}
    {error && <p role="alert">Takip istekleri yüklenemedi. <button onClick={() => refetch()}>Tekrar dene</button></p>}
    {actionError && <p role="alert">{actionError}</p>}
    {message && <p role="status">{message}</p>}
    {!loading && !error && total === 0 && <p className="notif-message">Onay bekleyen takip isteği yok.</p>}
    {requests.map(request => <div className="follow-request-item" key={request.id}>
      <Link to={`/user/${request.requester.id}`} className="follow-request-person">
        {request.requester.profilePicture && <img src={request.requester.profilePicture} alt="" />}
        <span><strong>{request.requester.fullName || request.requester.username}</strong><br />@{request.requester.username}</span>
      </Link>
      <p className="notif-message">Sizi takip etmek istiyor.</p>
      <div className="follow-request-actions">
        <Button size="small" disabled={busy} onClick={() => handleResponse(request.id, true)} aria-label={`${request.requester.username} için kabul et`}>Kabul Et</Button>
        <Button size="small" variant="outline" disabled={busy} onClick={() => handleResponse(request.id, false)} aria-label={`${request.requester.username} için reddet`}>Reddet</Button>
      </div>
    </div>)}
    {requests.length < total && <Button size="small" variant="outline" onClick={loadMore} isLoading={loadingMore}>Diğer İstekler</Button>}
  </section>;
}
