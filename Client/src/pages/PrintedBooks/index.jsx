import ClassificationFilters from '../../components/Books/Classification/ClassificationFilters';
import { bookPath } from '../../utils/publicPaths';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { MainLayout } from '../../components/Layout/MainLayout';
import { Container } from '../../components/UI/Container';
import { Typography } from '../../components/UI/Typography';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Badge } from '../../components/UI/Badge';
import PrintedBookCard from '../../components/Books/PrintedBookCard';
import PrintedBookSubmissionForm from '../../components/Books/PrintedBookSubmissionForm';
import { useAuth } from '../../context/AuthContext';
import { GET_PRINTED_BOOKS, GET_MY_PRINTED_SUBMISSIONS } from '../../graphql/printedBooks';
import './PrintedBooks.css';

export const reviewLabels = { PENDING: 'İncelemede', APPROVED: 'Onaylandı', REJECTED: 'Düzenleme gerekiyor' };
export default function PrintedBooksPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get('page') || 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
  const search = (params.get('search') || '').slice(0, 150);
  const classification = Object.fromEntries(['formats', 'genres', 'tags', 'features', 'audiences'].map(key => [key, params.getAll(key)]));
  const hasClassification = Object.values(classification).some(values => values.length);
  const [adding, setAdding] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageDirection, setPageDirection] = useState(1);
  useEffect(() => { setAdding(false); setSubmitted(false); }, [user?.id]);
  const { data, previousData, loading, error, refetch } = useQuery(GET_PRINTED_BOOKS, { variables: { page, search, ...(hasClassification ? { classification } : {}) }, fetchPolicy: 'cache-and-network', notifyOnNetworkStatusChange: true });
  const { data: mine, error: mineError, refetch: refreshMine } = useQuery(GET_MY_PRINTED_SUBMISSIONS, { skip: !user, fetchPolicy: 'network-only' });
  const catalog = (data || previousData)?.getPrintedBooks;
  const changePage = direction => {
    if (loading || page + direction < 1 || page + direction > catalog.totalPages) return;
    setPageDirection(direction);
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('page', String(page + direction));
      return next;
    }, { replace: true, preventScrollReset: true });
  };
  return <MainLayout><div className="printed-page"><Container maxWidth="6xl">
    <header className="printed-heading"><Typography variant="caption">BETİK KİTAPLIĞI</Typography><Typography variant="h1" weight="bold">Basılı Kitaplar</Typography><Typography variant="body" color="muted">Raflarda yerini almış eserleri keşfedin. Kitaplar, Türkiye’deki genel okur bilinirliği esas alınarak hazırlanan editoryal sırayla listelenir.</Typography>
      <div className="printed-actions">{user ? <Button onClick={() => { setAdding(value => !value); setSubmitted(false); }}>{adding ? 'İstek formunu kapat' : 'Basılı kitap ekle'}</Button> : <Link className="ui-text-link" to="/login">Kitap eklemek için giriş yapın</Link>}</div>
    </header>
    {submitted && <p className="ui-notice ui-notice--success" role="status">İsteğiniz Betik'e iletildi. Onaydan sonra kitabınız burada listelenecek.</p>}
    {adding && user && <PrintedBookSubmissionForm onClose={() => setAdding(false)} onSubmitted={() => { setAdding(false); setSubmitted(true); refreshMine().catch(() => {}); }} />}
    {user && mine?.getMyPrintedSubmissions?.length > 0 && <details className="printed-panel"><summary>Basılı Kitap Katkılarım ({mine.getMyPrintedSubmissions.length})</summary><ul className="printed-submissions">{mine.getMyPrintedSubmissions.map(book => <li key={book.id}><Link to={bookPath(book)} className="ui-text-link">{book.title}</Link><Badge variant={book.publicationStatus === 'APPROVED' ? 'success' : book.publicationStatus === 'REJECTED' ? 'danger' : 'warning'}>{reviewLabels[book.publicationStatus]}</Badge>{book.reviewNote && <p>{book.reviewNote}</p>}</li>)}</ul></details>}
    {user && mineError && <p className="ui-notice ui-notice--error" role="alert">Basılı kitap katkılarınız yüklenemedi. {mineError.message}</p>}
    <form className="printed-search" role="search" onSubmit={event => event.preventDefault()}><Input type="search" label="Kitap, yazar, yayınevi veya ISBN ara" name="printed-search" value={search} onChange={event => {
      const value = event.target.value.slice(0, 150);
      setParams(previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set('search', value); else next.delete('search');
        next.set('page', '1');
        return next;
      }, { replace: true, preventScrollReset: true });
    }} maxLength={150} /></form>
    <details className="printed-panel"><summary>Eser biçimi, tür ve diğer filtreler</summary><ClassificationFilters value={classification} onChange={value => setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const key of ['formats', 'genres', 'tags', 'features', 'audiences']) { next.delete(key); for (const code of value[key] || []) next.append(key, code); }
      next.set('page', '1'); return next;
    })} /></details>
    {loading && !catalog && <p role="status">Basılı kitaplar yükleniyor…</p>}
    {error && <div className="ui-notice ui-notice--error" role="alert"><p>{error.message}</p><Button onClick={() => refetch()}>Tekrar dene</Button></div>}
    {catalog && <><p className="printed-count">{catalog.total} basılı eser</p>{catalog.books.length ? <section className={`printed-catalog${catalog.totalPages > 1 ? ' printed-catalog--paginated' : ''}`} aria-label="Basılı kitap listesi" aria-busy={loading}>
      {catalog.totalPages > 1 && <button type="button" className="printed-page-arrow printed-page-arrow--previous" aria-label="Önceki kitaplar" title="Önceki kitaplar" aria-controls="printed-book-list" disabled={loading || page <= 1} onClick={() => changePage(-1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>}
      <div className={`printed-catalog-viewport${loading ? ' is-loading' : ''}`}>
        <div id="printed-book-list" className="printed-grid printed-grid--transition" key={`${catalog.page}:${search}:${JSON.stringify(classification)}`} style={{ '--printed-enter-x': `${pageDirection * 18}px` }}>
          {catalog.books.map(book => <PrintedBookCard key={book.id} book={book} coverOnly />)}
          {catalog.totalPages > 1 && Array.from({ length: Math.max(0, 12 - catalog.books.length) }, (_, index) => <div key={`empty-${index}`} className="printed-grid-spacer" aria-hidden="true" />)}
        </div>
      </div>
      {catalog.totalPages > 1 && <button type="button" className="printed-page-arrow printed-page-arrow--next" aria-label="Sonraki kitaplar" title="Sonraki kitaplar" aria-controls="printed-book-list" disabled={loading || page >= catalog.totalPages} onClick={() => changePage(1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>}
    </section> : !error && <section className="printed-panel printed-empty"><h2>{search ? 'Aramanıza uygun bir eser bulunamadı' : 'Raflarımız ilk eserlerini bekliyor'}</h2><p>{search ? 'Başka bir kitap adı, yazar veya ISBN ile arayın.' : 'Fiziksel olarak yayımlanmış bir kitabı incelemeye göndererek kataloğa katkıda bulunabilirsiniz.'}</p></section>}
      <p className="printed-sr-only" role="status">{loading ? 'Basılı kitaplar yükleniyor…' : `Sayfa ${catalog.page} / ${catalog.totalPages}`}</p>
    </>}
  </Container></div></MainLayout>;
}
