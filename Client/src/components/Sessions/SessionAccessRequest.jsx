import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../UI/Button';
import { Textarea } from '../UI/Textarea';

export default function SessionAccessRequest({ user, access, loading, error, refetch, request, requesting }) {
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState('');
  const processing = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (processing.current) return;
    if (reason.trim().length < 10) { setFailure('Lütfen en az 10 karakterlik bir açıklama yazın.'); return; }
    processing.current = true; setFailure('');
    try { await request(reason.trim()); setReason(''); }
    catch (problem) { setFailure(problem.message); }
    finally { processing.current = false; }
  }
  if (!user) return <div className="sessions-access-cta"><p>Oturum oluşturma iznine ücretsiz başvurabilirsiniz.</p><Link to="/login" className="ui-text-link">Başvurmak için giriş yapın</Link></div>;
  if (error) return <div className="sessions-access-cta" role="alert"><p>Oturum oluşturma izniniz kontrol edilemedi. {error.message}</p><Button variant="outline" onClick={() => refetch().catch(() => {})}>Tekrar dene</Button></div>;
  if (!access) return <p role="status">Oturum oluşturma izni kontrol ediliyor…</p>;
  if (access.status === 'PENDING') return <div className="sessions-access-cta" role="status"><p>Oturum açma başvurunuz yönetici onayını bekliyor.</p><Button variant="outline" disabled={loading} onClick={() => refetch().catch(() => {})}>Durumu yenile</Button></div>;
  return <section className="sessions-access-cta">
    <h2>Oturum açmak ister misin?</h2>
    <p>Oturum oluşturmak ücretsizdir. Kısa bir açıklamayla izin isteyin; yönetici onayından sonra kendi oturumlarınızı açabilirsiniz.</p>
    {access.status === 'REJECTED' && <p role="status">Başvurunuz onaylanmadı veya izniniz kaldırıldı. {access.reviewNote} Yeniden başvurabilirsiniz.</p>}
    <form onSubmit={submit} aria-label="Oturum oluşturma izni başvurusu">
      <Textarea label="Nasıl oturumlar düzenlemek istiyorsunuz?" name="session-access-reason" value={reason} onChange={event => setReason(event.target.value)} required minLength={10} maxLength={1000} disabled={requesting} />
      {failure && <p role="alert">{failure}</p>}
      <Button type="submit" disabled={requesting} isLoading={requesting}>{access.status === 'REJECTED' ? 'Yeniden izin iste' : 'Oturum açma izni iste'}</Button>
    </form>
  </section>;
}
