import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import { MainLayout } from '../../Layout/MainLayout';
import { Container } from '../../UI/Container';
import { Button } from '../../UI/Button';
import { Input } from '../../UI/Input';
import { Textarea } from '../../UI/Textarea';
import { Badge } from '../../UI/Badge';
import CommentList from '../../Comments/CommentList';
import QuoteCard from '../../Quote/QuoteCard';
import { useAuth } from '../../../context/AuthContext';
import { GET_QUOTES_BY_BOOK } from '../../../graphql/queries/quote';
import { CREATE_PRINTED_QUOTE, REQUEST_BOOK_CLAIM } from '../../../graphql/printedBooks';
import './PrintedBookDetail.css';
import BookShareButton from '../BookShareButton';

function ClaimForm({ book, refresh }) {
  const [evidence, setEvidence] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [request, { loading }] = useMutation(REQUEST_BOOK_CLAIM);
  async function submit(event) {
    event.preventDefault(); setError('');
    try { await request({ variables: { bookId: book.id, evidence, evidenceUrl } }); setSubmitted(true); await refresh(); }
    catch (failure) { setError(failure.message); }
  }
  if (book.myClaim?.status === 'PENDING' || (submitted && !book.myClaim)) return <div className="ui-notice"><p role="status">Yazar hak talebiniz inceleniyor. Onaydan sonra bölüm ekleyebilirsiniz.</p><Button variant="outline" size="small" onClick={() => refresh().catch(failure => setError(failure.message))}>Durumu yenile</Button>{error && <p role="alert">{error}</p>}</div>;
  return <details className="printed-panel"><summary>Bu kitabın yazarı mısınız? Hak talebinde bulunun</summary>
    {book.myClaim?.reviewNote && <p className="ui-notice ui-notice--warning">Önceki talebiniz: {book.myClaim.reviewNote}</p>}
    <p>ISBN veya kitabı eklemiş olmak yazarlık yetkisi vermez. Yazarlığınızı ve dijital yayın yetkinizi destekleyen bilgileri Betik yönetimiyle paylaşın.</p>
    <form onSubmit={submit}><Textarea label="Hak talebi açıklaması" name="claim-evidence" value={evidence} onChange={event => setEvidence(event.target.value)} required minLength={20} maxLength={3000} disabled={loading} />
      <Input label="Destekleyici bağlantı (isteğe bağlı)" name="claim-url" type="url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} placeholder="https://…" maxLength={1500} disabled={loading} />
      <p className="printed-detail-hint">Bu bilgiler yalnızca siz ve Betik yönetimi tarafından görülebilir.</p>
      {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
      <Button type="submit" isLoading={loading}>Hak talebini gönder</Button>
    </form>
  </details>;
}

export default function PrintedBookDetail({ book, comments, commentsLoading, currentUserId, commentText, onCommentChange, onCommentSubmit, commentSending, refresh }) {
  const { user } = useAuth();
  const approved = book.publicationStatus === 'APPROVED';
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [page, setPage] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSent, setQuoteSent] = useState(false);
  const [failedUrl, setFailedUrl] = useState(null);
  const { data, loading, error, refetch } = useQuery(GET_QUOTES_BY_BOOK, { variables: { bookId: book.id }, skip: !approved, fetchPolicy: 'cache-and-network' });
  const [quote, { loading: quoting }] = useMutation(CREATE_PRINTED_QUOTE);
  async function shareQuote(event) {
    event.preventDefault(); setQuoteError(''); setQuoteSent(false);
    try {
      await quote({ variables: { bookId: book.id, text: text.trim(), pageNumber: Number(page), note: note.trim(), isSpoiler: spoiler } });
      setText(''); setNote(''); setPage(''); setSpoiler(false); setQuoteSent(true); await refetch();
    } catch (failure) { setQuoteError(failure.message.includes('QUOTE_EXISTS:') ? 'Bu alıntı daha önce paylaşıldı. Kitabın alıntılarını inceleyebilirsiniz.' : failure.message); }
  }
  return <MainLayout><div className="printed-page"><Container maxWidth="5xl">
    <Link to="/printed-books" className="ui-text-link">← Basılı kitaplara dön</Link>
    <article className="printed-detail-layout">
      <aside className="printed-detail-cover">{book.imageUrl && failedUrl !== book.imageUrl ? <img src={book.imageUrl} alt={`${book.title} kapağı`} onError={() => setFailedUrl(book.imageUrl)} /> : <div className="printed-cover-placeholder">{book.title}</div>}</aside>
      <div className="printed-detail-intro"><Badge variant="neutral">Basılı eser</Badge><h1>{book.title}</h1><p className="printed-detail-author">{book.printedAuthor}</p>
        <dl className="printed-metadata"><div><dt>Yayınevi</dt><dd>{book.publisher}</dd></div><div><dt>Basım yılı</dt><dd>{book.publicationYear}</dd></div><div><dt>Sayfa</dt><dd>{book.pageCount}</dd></div><div><dt>ISBN</dt><dd>{book.isbn || 'Belirtilmedi'}</dd></div></dl>
        <div className="printed-actions">{approved && book.purchaseUrl && <a className="btn btn-primary btn-medium" href={book.purchaseUrl} target="_blank" rel="noopener noreferrer">Satın alma sayfası ↗</a>}{approved && book.chapters?.length > 0 && <Link className="ui-text-link" to={`/book-reader/${book.id}`}>Yazarın paylaştığı bölümleri oku</Link>}{book.canEditContent && <Link className="ui-text-link" to={`/dashboard/${book.id}`}>Bölüm ekle / düzenle</Link>}</div>
        {book.author && <p className="printed-detail-hint">Betik'te onaylanan yazar: <Link to={`/user/${book.author.id}`} className="ui-text-link">{book.author.fullName || book.author.username}</Link></p>}
      </div>
    </article>
    {approved && <BookShareButton book={book} />}
    {!approved && <p className="ui-notice ui-notice--warning" role="status">{book.publicationStatus === 'PENDING' ? 'Bu başvuru Betik incelemesinde. Henüz herkese açık katalogda yer almıyor.' : `Başvurunuz için düzenleme gerekiyor. ${book.reviewNote || ''} Bilgileri düzelterek basılı kitaplar sayfasından yeniden başvurabilirsiniz.`}</p>}
    <section className="printed-panel"><h2>Kitap hakkında</h2><p className="printed-description">{book.description}</p></section>
    {approved && user && !book.authorId && <ClaimForm book={book} refresh={refresh} />}
    {approved && <>
      <section className="printed-panel"><h2>Okur yorumları</h2>{user ? <form onSubmit={event => { event.preventDefault(); onCommentSubmit(); }}><Textarea label="Yorumunuz" name="printed-comment" value={commentText} onChange={onCommentChange} required maxLength={5000} disabled={commentSending} /><Button type="submit" isLoading={commentSending}>Yorum gönder</Button></form> : <p><Link className="ui-text-link" to="/login">Yorum yazmak için giriş yapın</Link></p>}{commentsLoading ? <p role="status">Yorumlar yükleniyor…</p> : <CommentList comments={comments} currentUserId={currentUserId} bookId={book.id} />}</section>
      <section className="printed-panel"><h2>Kitaptan alıntılar</h2>{user ? <details className="printed-quote-form"><summary>Alıntı paylaş</summary><form onSubmit={shareQuote}>
        <Textarea label="Kısa alıntı" name="printed-quote" value={text} onChange={event => setText(event.target.value)} required minLength={10} maxLength={1000} disabled={quoting} />
        <Input label="Basılı kitaptaki sayfa numarası" name="printed-page-number" type="number" value={page} onChange={event => setPage(event.target.value)} required min={1} max={book.pageCount} disabled={quoting} />
        <Textarea label="Notunuz (isteğe bağlı)" name="printed-quote-note" value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={quoting} />
        <label className="printed-check"><input type="checkbox" checked={spoiler} onChange={event => setSpoiler(event.target.checked)} disabled={quoting} /> Spoiler içeriyor</label>
        <Button type="submit" isLoading={quoting}>Alıntıyı paylaş</Button>
      </form></details> : <p><Link className="ui-text-link" to="/login">Alıntı paylaşmak için giriş yapın</Link></p>}
      {quoteError && <p className="ui-notice ui-notice--error" role="alert">{quoteError}</p>}{quoteSent && <p className="ui-notice ui-notice--success" role="status">Alıntınız paylaşıldı.</p>}
      {loading && <p role="status">Alıntılar yükleniyor…</p>}{error && <p className="ui-notice ui-notice--error" role="alert">Alıntılar yüklenemedi. {error.message}</p>}
      <div className="printed-quotes">{data?.getQuotesByBook?.map(item => <QuoteCard key={item.id} quote={item} />)}{!loading && !error && data?.getQuotesByBook?.length === 0 && <p>Bu kitaptan henüz bir alıntı paylaşılmadı.</p>}</div>
      </section>
    </>}
  </Container></div></MainLayout>;
}
