import React, { useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Input } from '../../UI/Input';
import { Textarea } from '../../UI/Textarea';
import { Button } from '../../UI/Button';
import { LOOKUP_PRINTED_BOOK, SUBMIT_PRINTED_BOOK } from '../../../graphql/printedBooks';
import { useAuth } from '../../../context/AuthContext';

const initial = { isbn: '', title: '', printedAuthor: '', publisher: '', publicationYear: '', pageCount: '', description: '', imageUrl: '', purchaseUrl: '', publicationEvidenceUrl: '' };
export default function PrintedBookSubmissionForm({ onSubmitted, onClose }) {
  const { ensureSession } = useAuth();
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lookup, { loading: looking }] = useLazyQuery(LOOKUP_PRINTED_BOOK, { fetchPolicy: 'network-only' });
  const [submit, { loading: sending }] = useMutation(SUBMIT_PRINTED_BOOK);
  const busy = looking || sending;
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function find() {
    if (!ensureSession()) return;
    setError(''); setMessage('');
    try {
      const { data } = await lookup({ variables: { isbn: form.isbn } });
      const result = data.lookupPrintedBook;
      setForm(current => ({ ...current, isbn: result.isbn, ...(result.found ? Object.fromEntries(['title', 'printedAuthor', 'publisher', 'publicationYear', 'pageCount', 'imageUrl'].filter(key => result[key]).map(key => [key, String(result[key])])) : {}) }));
      setMessage(result.found ? 'Kitap bilgileri getirildi. Baskı bilgilerini kontrol edip eksik alanları tamamlayın.' : 'Bu ISBN için bilgi getirilemedi. Künye bilgilerini elle girerek başvurabilirsiniz.');
    } catch (failure) { setError(failure.message); }
  }
  async function send(event) {
    event.preventDefault(); setError('');
    if (!ensureSession()) return;
    try {
      await submit({ variables: { input: { ...form, publicationYear: Number(form.publicationYear), pageCount: Number(form.pageCount) } } });
      onSubmitted();
    } catch (failure) { setError(failure.message); }
  }
  return <section className="printed-panel" aria-labelledby="printed-submit-title">
    <h2 id="printed-submit-title">Basılı kitap başvurusu</h2>
    <p className="ui-notice">Başvurunuz Betik tarafından incelendikten sonra listelenir. Kitabı eklemek, içerik yayımlama yetkisi vermez. Yazarsanız onaylanan kitap üzerinden ayrıca hak talebinde bulunabilirsiniz.</p>
    <form onSubmit={send}>
      <div className="printed-isbn-row">
        <Input label="ISBN (varsa)" name="isbn" value={form.isbn} onChange={change} disabled={busy} placeholder="978…" maxLength={32} />
        <Button type="button" variant="outline" onClick={find} isLoading={looking} disabled={busy || !form.isbn.trim()}>ISBN ile bul</Button>
      </div>
      {message && <p className="ui-notice" role="status">{message}</p>}
      <div className="printed-form-grid">
        <Input label="Kitap adı" name="title" value={form.title} onChange={change} disabled={busy} required maxLength={200} />
        <Input label="Kitapta yazan yazar adı" name="printedAuthor" value={form.printedAuthor} onChange={change} disabled={busy} required minLength={2} maxLength={300} />
        <Input label="Yayınevi / Basım adı" name="publisher" value={form.publisher} onChange={change} disabled={busy} required minLength={2} maxLength={200} />
        <Input label="Bu baskının yılı" name="publicationYear" type="number" value={form.publicationYear} onChange={change} disabled={busy} required min={1400} max={new Date().getFullYear()} />
        <Input label="Basılı sayfa sayısı" name="pageCount" type="number" value={form.pageCount} onChange={change} disabled={busy} required min={1} max={50000} />
        <Input label="Kapak görseli bağlantısı (isteğe bağlı)" name="imageUrl" type="url" value={form.imageUrl} onChange={change} disabled={busy} placeholder="https://…" maxLength={1500} />
      </div>
      <Textarea label="Kitap tanıtımı" name="description" value={form.description} onChange={change} disabled={busy} required minLength={20} maxLength={5000} />
      <Input label="Satın alma bağlantısı (isteğe bağlı)" name="purchaseUrl" type="url" value={form.purchaseUrl} onChange={change} disabled={busy} placeholder="https://…" maxLength={1500} />
      <Input label="Baskıyı doğrulayan yayınevi veya katalog bağlantısı" name="publicationEvidenceUrl" type="url" value={form.publicationEvidenceUrl} onChange={change} disabled={busy} required placeholder="https://…" maxLength={1500} />
      {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
      <div className="printed-actions"><Button type="submit" isLoading={sending} disabled={busy}>Betik onayına gönder</Button><Button variant="ghost" onClick={onClose} disabled={busy}>Vazgeç</Button></div>
    </form>
  </section>;
}
