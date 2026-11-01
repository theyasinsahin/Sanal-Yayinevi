import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../UI/Button';
import { bookPath } from '../../../utils/publicPaths';
import { GET_PRINTED_READINGS, REMOVE_PRINTED_READING } from '../../../graphql/printedReadings';

export default function PrintedReadingLibrary({ userId }) {
  const { user, ensureSession } = useAuth();
  const own = user?.id === userId;
  const [page, setPage] = useState(1);
  const [failure, setFailure] = useState('');
  const [removingId, setRemovingId] = useState(null);
  const processing = useRef(false);
  const { data, loading, error, refetch } = useQuery(GET_PRINTED_READINGS, { variables: { userId, page }, fetchPolicy: 'network-only', context: { queryDeduplication: false } });
  const [remove] = useMutation(REMOVE_PRINTED_READING);
  const shelf = data?.getPrintedReadings;
  useEffect(() => { if (shelf && page > Math.max(1, shelf.totalPages)) setPage(Math.max(1, shelf.totalPages)); }, [shelf, page]);
  async function discard(bookId) {
    if (processing.current || !ensureSession()) return;
    processing.current = true; setRemovingId(bookId); setFailure('');
    try {
      await remove({ variables: { bookId } });
      try { await refetch(); } catch { setFailure('Kitap kaldırıldı; liste yenilenemedi. Tekrar deneyin.'); }
    } catch (problem) { setFailure(problem.message); }
    finally { processing.current = false; setRemovingId(null); }
  }
  return <section aria-label="Okuduğum Basılı Kitaplar">
    <h2>Okuduğum Basılı Kitaplar</h2>
    {loading && <p role="status">Kitaplık yükleniyor…</p>}
    {error && <p role="alert">Kitaplık yüklenemedi. {error.message} <Button onClick={() => refetch().catch(() => {})}>Tekrar dene</Button></p>}
    {failure && <p role="alert">{failure}</p>}
    {shelf && !shelf.canView && <p>Bu kullanıcının kitaplığı gizli.</p>}
    {shelf?.canView && <>
      <p>{shelf.total} basılı kitap okundu.</p>
      {shelf.total === 0 && <p>{own ? 'Henüz okuduğunuz bir basılı kitap eklemediniz. Kitap detayından puan vererek kitaplığınıza ekleyebilirsiniz.' : 'Henüz okunan bir basılı kitap eklenmemiş.'} {own && <Link to="/printed-books" className="ui-text-link">Basılı kitapları keşfet</Link>}</p>}
      <div className="printed-reading-grid">{shelf.items.map(item => <article className="printed-reading-card" key={item.id}>
        <div className="printed-reading-book">
          {item.book.imageUrl && <img src={item.book.imageUrl} alt={`${item.book.title} kapağı`} loading="lazy" />}
          <div><h3><Link to={bookPath(item.book)} className="ui-text-link">{item.book.title}</Link></h3><p>{item.book.printedAuthor}</p><small>{item.book.publisher}</small></div>
        </div>
        <p className="printed-reading-stars" aria-label={`${item.rating} / 5 puan`}><span aria-hidden="true">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span> · {item.rating} / 5</p>
        <p className="printed-reading-review">{item.review || 'Bu kitap için henüz yorum yazılmamış.'}</p>
        <small>Okundu olarak eklendi: {new Date(item.readAt).toLocaleDateString('tr-TR')}</small>
        {own && <div className="printed-reading-actions"><Link to={bookPath(item.book)} className="ui-text-link">Değerlendirmeyi düzenle</Link><Button variant="ghost" onClick={() => discard(item.book.id)} disabled={Boolean(removingId)}>Kitaplığımdan kaldır</Button></div>}
      </article>)}</div>
      {shelf.totalPages > 1 && <div className="printed-reading-actions"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Önceki</Button><span>{page} / {shelf.totalPages}</span><Button variant="outline" disabled={loading || page >= shelf.totalPages} onClick={() => setPage(value => value + 1)}>Sonraki</Button></div>}
    </>}
  </section>;
}
