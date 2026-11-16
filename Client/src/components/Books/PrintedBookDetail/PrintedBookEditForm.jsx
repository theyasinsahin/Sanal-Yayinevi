import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Input } from '../../UI/Input';
import { Textarea } from '../../UI/Textarea';
import { Button } from '../../UI/Button';
import { REQUEST_PRINTED_BOOK_EDIT } from '../../../graphql/printedBooks';

const fields = [
  ['isbn', 'ISBN', 32], ['title', 'Kitap adı', 200], ['originalTitle', 'Orijinal adı', 200],
  ['printedAuthor', 'Kitapta yazan yazar adı', 300], ['translator', 'Çeviren', 300],
  ['preparedBy', 'Yayına hazırlayan', 300], ['publisher', 'Yayınevi / Basım adı', 200],
  ['publicationYear', 'Bu baskının yılı', null], ['editionNumber', 'Kaçıncı baskı', null],
  ['pageCount', 'Basılı sayfa sayısı', null], ['coverDesigner', 'Kapak tasarımı', 300],
  ['pageDesigner', 'Sayfa uygulama', 300], ['printingPlace', 'Baskı yeri', 200],
  ['imageUrl', 'Kapak görseli bağlantısı', 1500], ['purchaseUrl', 'Satın alma bağlantısı', 1500],
];
const numeric = new Set(['publicationYear', 'editionNumber', 'pageCount']);
const optional = new Set(['isbn', 'originalTitle', 'translator', 'preparedBy', 'editionNumber', 'coverDesigner', 'pageDesigner', 'printingPlace', 'imageUrl', 'purchaseUrl']);
const initialFor = book => Object.fromEntries([...fields.map(([key]) => [key, String(book[key] ?? '')]), ['description', book.description || '']]);

export default function PrintedBookEditForm({ book, refresh }) {
  const [form, setForm] = useState(() => initialFor(book));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [request, { loading }] = useMutation(REQUEST_PRINTED_BOOK_EDIT);
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  async function send(event) {
    event.preventDefault(); setError('');
    const input = {};
    for (const key of Object.keys(form)) {
      if (form[key] !== String(book[key] ?? '')) input[key] = numeric.has(key) ? (form[key] ? Number(form[key]) : null) : form[key];
    }
    if (!Object.keys(input).length) { setError('En az bir bilgi değişikliği yapın.'); return; }
    try {
      await request({ variables: { bookId: book.id, input, reason: reason.trim() } });
      setSubmitted(true);
      await refresh();
    } catch (failure) { setError(failure.message); }
  }
  if (book.myEditRequest?.status === 'PENDING' || submitted) return <p className="ui-notice" role="status">Bilgi düzenleme isteğiniz inceleniyor.</p>;
  return <details className="printed-panel"><summary>Kitap bilgilerinde düzeltme öner</summary>
    {book.myEditRequest?.reviewNote && <p className="ui-notice">Önceki isteğiniz: {book.myEditRequest.reviewNote}</p>}
    <p>Öneriniz Betik tarafından incelenir. Onaylanana kadar mevcut bilgiler görünür.</p>
    <form onSubmit={send}>
      <div className="printed-form-grid">{fields.map(([key, label, maxLength]) => <Input key={key} label={`${label}${optional.has(key) ? ' (isteğe bağlı)' : ''}`} name={key} type={numeric.has(key) ? 'number' : key.endsWith('Url') ? 'url' : 'text'} value={form[key]} onChange={change} disabled={loading} required={!optional.has(key)} maxLength={maxLength || undefined} min={key === 'publicationYear' ? 1400 : numeric.has(key) ? 1 : undefined} max={key === 'publicationYear' ? new Date().getFullYear() : key === 'editionNumber' ? 1000 : key === 'pageCount' ? 50000 : undefined} />)}</div>
      <Textarea label="Kitap tanıtımı" name="description" value={form.description} onChange={change} disabled={loading} required minLength={20} maxLength={5000} />
      <Textarea label="Düzeltme gerekçesi" name="edit-reason" value={reason} onChange={event => setReason(event.target.value)} disabled={loading} required minLength={10} maxLength={1000} />
      {error && <p className="ui-notice ui-notice--error" role="alert">{error}</p>}
      <Button type="submit" isLoading={loading}>Düzenleme isteği gönder</Button>
    </form>
  </details>;
}
