import { bookPath } from '../../../utils/publicPaths';
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import AdminLayout from '../../../components/Admin/AdminLayout';
import { Button } from '../../../components/UI/Button';
import { Textarea } from '../../../components/UI/Textarea';
import { GET_PRINTED_REVIEWS, REVIEW_PRINTED_BOOK, REVIEW_BOOK_CLAIM, GET_PRINTED_EDIT_REVIEWS, REVIEW_PRINTED_BOOK_EDIT } from '../../../graphql/printedBooks';
import '../../PrintedBooks/PrintedBooks.css';
import './AdminPrintedBooks.css';

function Review({ item, claim, refresh }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const processing = useRef(false);
  const [reviewBook, { loading: reviewingBook }] = useMutation(REVIEW_PRINTED_BOOK);
  const [reviewClaim, { loading: reviewingClaim }] = useMutation(REVIEW_BOOK_CLAIM);
  const busy = reviewingBook || reviewingClaim || completed;
  const book = (claim ? item.book : item) || { title: 'Kitap kaydı bulunamadı', printedAuthor: '', isbn: '' };
  async function review(approve) {
    if (processing.current || completed) return;
    setError('');
    if (!approve && note.trim().length < 5) { setError('Reddetmek için en az 5 karakterlik bir gerekçe girin.'); return; }
    try {
      processing.current = true;
      const mutate = claim ? reviewClaim : reviewBook;
      await mutate({ variables: { [claim ? 'claimId' : 'bookId']: item.id, approve, note: note.trim() } });
      setCompleted(true);
      try { await refresh(); } catch { setError('Karar kaydedildi; liste yenilenemedi. Sayfayı yenileyebilirsiniz.'); }
    } catch (failure) { setError(failure.message); }
    finally { processing.current = false; }
  }
  return <article className="printed-panel"><h3>{book.title}</h3><p>{book.printedAuthor} · {book.isbn || 'ISBN belirtilmedi'}</p>
    <p>Gönderen: {(claim ? item.claimant?.fullName || item.claimant?.username : item.submittedBy?.fullName || item.submittedBy?.username) || 'Hesap bulunamadı'}</p>
    {claim && (!item.book || !item.claimant) && <p className="ui-notice" role="alert">Bağlı kitap veya hesap bulunamadı. İstek onaylanamaz; gerekçesiyle reddedilebilir.</p>}
    {claim ? <><p className="printed-description">{item.evidence}</p>{item.evidenceUrl && <a className="ui-text-link" href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">Hak talebini destekleyen bağlantı ↗</a>}<p className="ui-notice">Onay verdiğinizde bu hesaba kitaba bölüm ekleme ve düzenleme yetkisi tanınır. Yazarlık ve dijital yayın yetkisini inceleyin.</p></> : <><p>{book.publisher} · {book.publicationYear} · {book.pageCount} sayfa</p><p className="printed-description">{book.description}</p><div className="printed-actions"><Link className="ui-text-link" to={bookPath(book)}>Kitap önizlemesi</Link><a className="ui-text-link" href={book.publicationEvidenceUrl} target="_blank" rel="noopener noreferrer">Baskı doğrulama bağlantısı ↗</a>{book.purchaseUrl && <a className="ui-text-link" href={book.purchaseUrl} target="_blank" rel="noopener noreferrer">Satın alma bağlantısı ↗</a>}</div></>}
    <Textarea label="İnceleme notu / Ret gerekçesi" name={`review-${item.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={busy} />
    {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
    {completed && <p role="status">İnceleme kararı kaydedildi.</p>}
    <div className="printed-actions"><Button onClick={() => review(true)} disabled={busy || (claim && (!item.book || !item.claimant))}>Onayla</Button><Button variant="danger" onClick={() => review(false)} disabled={busy}>Reddet</Button></div>
  </article>;
}
const editLabels = { isbn: 'ISBN', title: 'Kitap adı', printedAuthor: 'Yazar', publisher: 'Yayınevi', publicationYear: 'Basım yılı', pageCount: 'Sayfa sayısı', description: 'Tanıtım', imageUrl: 'Kapak bağlantısı', purchaseUrl: 'Satın alma bağlantısı', originalTitle: 'Orijinal adı', translator: 'Çeviren', preparedBy: 'Yayına hazırlayan', editionNumber: 'Baskı sayısı', coverDesigner: 'Kapak tasarımı', pageDesigner: 'Sayfa uygulama', printingPlace: 'Baskı yeri' };
function EditReview({ item, refresh }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [reviewEdit, { loading }] = useMutation(REVIEW_PRINTED_BOOK_EDIT);
  async function review(approve) {
    setError('');
    if (!approve && note.trim().length < 5) { setError('Reddetmek için en az 5 karakterlik bir gerekçe girin.'); return; }
    try {
      await reviewEdit({ variables: { requestId: item.id, approve, note: note.trim() } });
      setCompleted(true);
      await refresh();
    } catch (failure) { setError(failure.message); }
  }
  return <article className="printed-panel"><h3>{item.book?.title || 'Kitap kaydı bulunamadı'}</h3>
    <p>Gönderen: {item.requester?.fullName || item.requester?.username || 'Hesap bulunamadı'}</p>
    <p>Gerekçe: {item.reason}</p>
    <dl className="printed-metadata">{item.changes.map(change => <div key={change.field}><dt>{editLabels[change.field] || change.field}</dt><dd>{change.before || 'Boş'} → {change.after || 'Boş'}</dd></div>)}</dl>
    {item.book && <Link className="ui-text-link" to={bookPath(item.book)}>Kitabı görüntüle</Link>}
    <Textarea label="İnceleme notu / Ret gerekçesi" name={`edit-review-${item.id}`} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={loading || completed} />
    {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
    {completed && <p role="status">İnceleme kararı kaydedildi.</p>}
    <div className="printed-actions"><Button onClick={() => review(true)} disabled={loading || completed || !item.book}>Onayla</Button><Button variant="danger" onClick={() => review(false)} disabled={loading || completed}>Reddet</Button></div>
  </article>;
}
export default function AdminPrintedBooks() {
  const { data, loading, error, refetch } = useQuery(GET_PRINTED_REVIEWS, { fetchPolicy: 'network-only', pollInterval: 30000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  const { data: edits, loading: editsLoading, error: editsError, refetch: refreshEdits } = useQuery(GET_PRINTED_EDIT_REVIEWS, { fetchPolicy: 'network-only', pollInterval: 30000, skipPollAttempt: () => document.visibilityState === 'hidden' });
  return <AdminLayout title="Basılı Kitaplar ve Hak Talepleri" className="admin-printed-books">
    <p className="ui-notice">Bu ekran yayımlanmış basılı kitapların katalog ve yazar hak talepleri içindir. <Link className="ui-text-link" to="/admin/print-funding">Yeni basım ve destek başvurularını incele</Link></p>
    {loading && <p role="status">İstekler yükleniyor…</p>}{error && <p className="ui-notice ui-notice--error" role="alert">{error.message} <button className="ui-text-link" onClick={() => refetch()}>Tekrar dene</button></p>}
    <h2>Kitap ekleme istekleri</h2>{data?.getPrintedBookReviews?.map(item => <Review key={item.id} item={item} refresh={refetch} />)}{data?.getPrintedBookReviews?.length === 0 && <p>Bekleyen kitap isteği yok.</p>}
    <h2>Bilgi düzenleme istekleri</h2>{editsLoading && <p role="status">Düzenleme istekleri yükleniyor…</p>}{editsError && <p role="alert">{editsError.message}</p>}{edits?.getPrintedBookEditReviews?.map(item => <EditReview key={item.id} item={item} refresh={refreshEdits} />)}{edits?.getPrintedBookEditReviews?.length === 0 && <p>Bekleyen düzenleme isteği yok.</p>}
    <h2>Yazar hak talepleri</h2>{data?.getBookClaimReviews?.map(item => <Review key={item.id} item={item} claim refresh={refetch} />)}{data?.getBookClaimReviews?.length === 0 && <p>Bekleyen hak talebi yok.</p>}
  </AdminLayout>;
}
