import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../UI/Button';
import { Textarea } from '../../UI/Textarea';
import { MY_PRINTED_READING, SAVE_PRINTED_READING, REMOVE_PRINTED_READING } from '../../../graphql/printedReadings';

export default function PrintedReadingEditor({ bookId }) {
  const { user, ensureSession } = useAuth();
  const [rating, setRating] = useState('');
  const [review, setReview] = useState('');
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const processing = useRef(false);
  const { data, loading, error, refetch } = useQuery(MY_PRINTED_READING, {
    variables: { bookId }, skip: !user, fetchPolicy: 'network-only', context: { queryDeduplication: false },
  });
  const record = user && data?.myPrintedBookReading?.userId === user.id ? data.myPrintedBookReading : null;
  useEffect(() => { setRating(record ? String(record.rating) : ''); setReview(record?.review || ''); }, [record]);
  const [save, { loading: saving }] = useMutation(SAVE_PRINTED_READING, {
    update(cache, result) {
      if (result.data?.savePrintedBookReading) cache.writeQuery({ query: MY_PRINTED_READING, variables: { bookId }, data: { myPrintedBookReading: result.data.savePrintedBookReading } });
    },
  });
  const [remove, { loading: removing }] = useMutation(REMOVE_PRINTED_READING, {
    update(cache) { cache.writeQuery({ query: MY_PRINTED_READING, variables: { bookId }, data: { myPrintedBookReading: null } }); },
  });
  const busy = saving || removing;
  async function submit(event) {
    event.preventDefault();
    if (processing.current || !ensureSession()) return;
    setFailure(''); setNotice('');
    if (!rating) { setFailure('Lütfen 1–5 arasında bir puan seçin.'); return; }
    processing.current = true;
    try {
      await save({ variables: { bookId, rating: Number(rating), review: review.trim() } });
      setNotice('Değerlendirmeniz kaydedildi. Kitap profilinizdeki Okuduğum Basılı Kitaplar bölümünde görünüyor.');
    } catch (problem) { setFailure(problem.message); }
    finally { processing.current = false; }
  }
  async function discard() {
    if (processing.current || !ensureSession()) return;
    processing.current = true; setFailure(''); setNotice('');
    try { await remove({ variables: { bookId } }); setRating(''); setReview(''); setNotice('Kitap okuduklarınızdan kaldırıldı.'); }
    catch (problem) { setFailure(problem.message); }
    finally { processing.current = false; }
  }
  return <section className="printed-panel printed-reading-editor" id="okuma-degerlendirmem">
    <h2>Okudum ve değerlendirdim</h2>
    {!user ? <p><Link to="/login" className="ui-text-link">Okuduklarınıza eklemek ve puan vermek için giriş yapın</Link></p> : <>
      <p>Okuduğunuz basılı kitabı puanlayın. Değerlendirmeniz profilinizdeki ayrı kitaplıkta, kitaplık gizlilik ayarınıza göre görünür.</p>
      {loading && !data ? <p role="status">Değerlendirmeniz yükleniyor…</p> : error ? <p role="alert">{error.message} <Button variant="outline" onClick={() => refetch().catch(() => {})}>Tekrar dene</Button></p> : <form onSubmit={submit} aria-label="Basılı kitap değerlendirmesi">
        <label className="printed-rating-label" htmlFor={`reading-rating-${bookId}`}>Puanınız (5 üzerinden)
          <select id={`reading-rating-${bookId}`} value={rating} onChange={event => setRating(event.target.value)} required disabled={busy}>
            <option value="">Puan seçin</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}
          </select>
        </label>
        <Textarea label="Kitap hakkındaki yorumunuz (isteğe bağlı)" name={`reading-review-${bookId}`} value={review} onChange={event => setReview(event.target.value)} maxLength={3000} disabled={busy} />
        <div className="printed-actions"><Button type="submit" disabled={busy} isLoading={saving}>{record ? 'Değerlendirmeyi güncelle' : 'Okudum, kitaplığıma ekle'}</Button>
          {record && <Button variant="ghost" onClick={discard} disabled={busy}>Okuduklarımdan kaldır</Button>}
        </div>
      </form>}
      {failure && <p className="ui-notice ui-notice--error" role="alert">{failure}</p>}
      {notice && <p role="status" className="ui-notice ui-notice--success">{notice}</p>}
    </>}
  </section>;
}
