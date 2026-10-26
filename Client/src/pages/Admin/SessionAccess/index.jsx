import React, { useRef, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { Button } from '../../../components/UI/Button';
import { Textarea } from '../../../components/UI/Textarea';
import { SESSION_ACCESS_REQUESTS, REVIEW_SESSION_ACCESS } from '../../../graphql/sessionAccess';
import { adminDate } from '../../../utils/admin';
import '../../PrintedBooks/PrintedBooks.css';

function AccessReview({ item, refresh }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const processing = useRef(false);
  const [review, { loading }] = useMutation(REVIEW_SESSION_ACCESS);
  async function decide(approve) {
    if (processing.current || completed) return;
    setError('');
    if (!approve && note.trim().length < 5) { setError('Ret veya izin kaldırma için en az 5 karakterlik gerekçe girin.'); return; }
    processing.current = true;
    try {
      await review({ variables: { userId: item.user.id, revision: item.revision, approve, note: note.trim() } });
      setCompleted(true);
      try { await refresh(); } catch { setError('Karar kaydedildi; liste yenilenemedi. Listeyi yenileyin.'); }
    } catch (failure) { setError(failure.message); }
    finally { processing.current = false; }
  }
  const busy = loading || completed;
  return <article className="printed-panel">
    <h2>{item.user.fullName} (@{item.user.username})</h2><p>{item.user.email}</p>
    <p>Başvuru: {adminDate(item.requestedAt)}</p>
    <p className="printed-description">{item.reason}</p>
    {item.reviewedAt && <p>Son karar: {adminDate(item.reviewedAt)} · {item.reviewNote || 'Onaylandı'}</p>}
    {item.status !== 'REJECTED' && <>
      <Textarea label="Karar notu / Ret veya izin kaldırma gerekçesi" name={`session-review-${item.user.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={500} disabled={busy} />
      <div className="printed-actions">
        {item.status === 'PENDING' && <Button onClick={() => decide(true)} disabled={busy}>Onayla</Button>}
        <Button variant="danger" onClick={() => decide(false)} disabled={busy}>{item.status === 'APPROVED' ? 'İzni kaldır' : 'Reddet'}</Button>
      </div>
    </>}
    {completed && <p role="status">Karar kaydedildi.</p>}
    {error && <p role="alert" className="ui-notice ui-notice--error">{error}</p>}
  </article>;
}

export default function AdminSessionAccess() {
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const { data, loading, error, refetch } = useQuery(SESSION_ACCESS_REQUESTS, {
    variables: { status, page }, fetchPolicy: 'network-only', pollInterval: 30000,
    skipPollAttempt: () => document.visibilityState === 'hidden',
  });
  const result = data?.sessionAccessRequests;
  return <AdminLayout title="Oturum İzinleri">
    <p>Oturum oluşturma ücretsizdir. Başvuruları inceleyin; onay verdiğiniz kullanıcılar oturum açabilir. Verilmiş bir izni kaldırmak mevcut oturumları kapatmaz.</p>
    <div className="printed-actions">
      <label>Başvuru durumu <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="PENDING">Onay bekleyenler</option><option value="APPROVED">İzin verilenler</option><option value="REJECTED">Reddedilen / izni kaldırılanlar</option>
      </select></label>
      <Button variant="outline" disabled={loading} onClick={() => refetch().catch(() => {})}>Listeyi yenile</Button>
    </div>
    {loading && <p role="status">Başvurular yükleniyor…</p>}
    {error && <p role="alert" className="ui-notice ui-notice--error">{error.message}</p>}
    {result && <>
      <p>{result.total} başvuru</p>
      {result.items.map(item => <AccessReview key={`${item.user.id}:${item.revision}`} item={item} refresh={refetch} />)}
      {result.total === 0 && <p>Bu durumda başvuru yok.</p>}
      {result.totalPages > 1 && <div className="printed-actions"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Önceki</Button><span>{page} / {result.totalPages}</span><Button variant="outline" disabled={loading || page >= result.totalPages} onClick={() => setPage(value => value + 1)}>Sonraki</Button></div>}
    </>}
  </AdminLayout>;
}
