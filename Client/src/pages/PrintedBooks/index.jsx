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
  const [term, setTerm] = useState(search);
  const [adding, setAdding] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => setTerm(search), [search]);
  const { data, loading, error, refetch } = useQuery(GET_PRINTED_BOOKS, { variables: { page, search }, fetchPolicy: 'cache-and-network' });
  const { data: mine, error: mineError, refetch: refreshMine } = useQuery(GET_MY_PRINTED_SUBMISSIONS, { skip: !user, fetchPolicy: 'network-only' });
  const catalog = data?.getPrintedBooks;
  return <MainLayout><div className="printed-page"><Container maxWidth="6xl">
    <header className="printed-heading"><Typography variant="caption">BETİK KİTAPLIĞI</Typography><Typography variant="h1" weight="bold">Basılı Kitaplar</Typography><Typography variant="body" color="muted">Raflarda yerini almış eserleri keşfedin. Okur yorumlarıyla tanışın, sevdiğiniz satırları paylaşın.</Typography>
      <div className="printed-actions">{user ? <Button onClick={() => { setAdding(value => !value); setSubmitted(false); }}>{adding ? 'Başvuruyu kapat' : 'Basılı kitap ekle'}</Button> : <Link className="ui-text-link" to="/login">Kitap eklemek için giriş yapın</Link>}</div>
    </header>
    {submitted && <p className="ui-notice ui-notice--success" role="status">Başvurunuz Betik'e iletildi. Onaydan sonra kitabınız burada listelenecek.</p>}
    {adding && user && <PrintedBookSubmissionForm onClose={() => setAdding(false)} onSubmitted={() => { setAdding(false); setSubmitted(true); refreshMine().catch(() => {}); }} />}
    {user && mine?.getMyPrintedSubmissions?.length > 0 && <details className="printed-panel"><summary>Başvurularım ({mine.getMyPrintedSubmissions.length})</summary><ul className="printed-submissions">{mine.getMyPrintedSubmissions.map(book => <li key={book.id}><Link to={bookPath(book)} className="ui-text-link">{book.title}</Link><Badge variant={book.publicationStatus === 'APPROVED' ? 'success' : book.publicationStatus === 'REJECTED' ? 'danger' : 'warning'}>{reviewLabels[book.publicationStatus]}</Badge>{book.reviewNote && <p>{book.reviewNote}</p>}</li>)}</ul></details>}
    {mineError && <p className="ui-notice ui-notice--error" role="alert">Başvurularınız yüklenemedi. {mineError.message}</p>}
    <form className="printed-search" onSubmit={event => { event.preventDefault(); setParams({ search: term.trim(), page: '1' }); }}><Input label="Kitap, yazar, yayınevi veya ISBN ara" name="printed-search" value={term} onChange={event => setTerm(event.target.value)} maxLength={150} /><Button type="submit" variant="outline">Ara</Button></form>
    {loading && <p role="status">Basılı kitaplar yükleniyor…</p>}
    {error && <div className="ui-notice ui-notice--error" role="alert"><p>{error.message}</p><Button onClick={() => refetch()}>Tekrar dene</Button></div>}
    {!error && catalog && <><p className="printed-count">{catalog.total} basılı eser</p>{catalog.books.length ? <div className="printed-grid">{catalog.books.map(book => <PrintedBookCard key={book.id} book={book} />)}</div> : <section className="printed-panel printed-empty"><h2>{search ? 'Aramanıza uygun bir eser bulunamadı' : 'Raflarımız ilk eserlerini bekliyor'}</h2><p>{search ? 'Başka bir kitap adı, yazar veya ISBN ile arayın.' : 'Fiziksel olarak yayımlanmış bir kitabı incelemeye göndererek kataloğa katkıda bulunabilirsiniz.'}</p></section>}
      {catalog.totalPages > 1 && <nav className="printed-actions" aria-label="Basılı kitap sayfaları"><Button variant="outline" disabled={page <= 1} onClick={() => setParams({ search, page: String(page - 1) })}>Önceki</Button><span>{page} / {catalog.totalPages}</span><Button variant="outline" disabled={page >= catalog.totalPages} onClick={() => setParams({ search, page: String(page + 1) })}>Sonraki</Button></nav>}</>}
  </Container></div></MainLayout>;
}
